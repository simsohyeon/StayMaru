import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { CURATED_COURSES, type CuratedCourse } from '@/constants/curatedCourses'
import { CATEGORIES, PROFILE_LABELS } from '@/constants/categories'
import { SIGUNGUS } from '@/constants/sigungu'
import { useSettings } from '@/stores/settings'
import { useContent, resetContentHydration } from '@/stores/content'
import { toast } from '@/stores/toasts'
import { askConfirm } from '@/stores/confirm'
import { ChevronDownIcon, PencilIcon, TrashIcon } from '@/components/icons'
import type { CategoryId, CourseProfile, Lang, TripDuration } from '@/types/domain'

/**
 * 테마 코스 편집 — 홈·테마 화면에 걸리는 추천 코스를 운영자가 직접 고친다.
 *
 * 저장은 항상 목록 전체를 한 번에 보낸다(서버가 일괄 upsert).
 * 순서 바꾸기도 결국 sort 를 다시 매기는 일이라, 한 건씩 보내면 중간에 끊겼을 때 순서가 엉킨다.
 * 쓰기 응답은 DB 가 가진 최종 목록이므로 그대로 화면에 세운다 — 낙관적 추정을 남기지 않는다.
 */

const LANGS: Lang[] = ['ko', 'en', 'ja', 'zh']
const DURATIONS: TripDuration[] = ['day', '1n2d', '2n3d', 'custom']
const MAX_REGIONS = 3
const MAX_THEMES = 6
const ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/

/** i18n 의 기간 키는 숫자로 시작할 수 없어 n1d2/n2d3 로 둔다 (Home 과 동일 규칙). */
const durKey = (d: TripDuration) => (d === '1n2d' ? 'n1d2' : d === '2n3d' ? 'n2d3' : d)

export interface AdminCurated extends CuratedCourse {
  sort: number
  published: boolean
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ready' }
  /** 서버 저장소가 없어 편집 자체가 불가능 — 앱은 코드 기본값으로 계속 돈다. */
  | { kind: 'off' }
  | { kind: 'error'; detail: string }

type Result =
  | { ok: true; items: AdminCurated[] }
  | { ok: false; status: number; reason: string; detail: string }

async function api(method: string, body?: unknown, qs = ''): Promise<Result> {
  try {
    const res = await fetch(`/api/admin?action=curated${qs}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as { items?: AdminCurated[]; reason?: string; detail?: string }
    if (!res.ok) {
      return { ok: false, status: res.status, reason: String(data.reason ?? ''), detail: String(data.detail ?? '') }
    }
    return { ok: true, items: (data.items ?? []).slice().sort((a, b) => a.sort - b.sort) }
  } catch (err) {
    return { ok: false, status: 0, reason: 'network', detail: err instanceof Error ? err.message : String(err) }
  }
}

/** 코드에 있는 기본 코스를 저장 가능한 형태로 — 처음 한 번 표를 채울 때 쓴다. */
function seedItems(): AdminCurated[] {
  return CURATED_COURSES.map((c, i) => ({ ...c, sort: i, published: true }))
}

function blankDraft(index: number): AdminCurated {
  return {
    id: `theme-${index + 1}`,
    sort: index,
    published: true,
    sigunguCodes: [],
    profile: 'known_gb',
    duration: '1n2d',
    themes: [],
    accent: '#3D8B81',
    i18n: {
      ko: { title: '', desc: '' },
      en: { title: '', desc: '' },
      ja: { title: '', desc: '' },
      zh: { title: '', desc: '' },
    },
  }
}

export default function CuratedEditor() {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const [items, setItems] = useState<AdminCurated[]>([])
  const [status, setStatus] = useState<Status>({ kind: 'loading' })
  const [draft, setDraft] = useState<AdminCurated | null>(null)
  const [draftIsNew, setDraftIsNew] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  /** 쓰기가 끝나면 앱이 보는 공개 목록도 다시 받아 온다 — 운영자가 결과를 바로 확인할 수 있게. */
  const refreshPublic = useCallback(() => {
    resetContentHydration()
    void useContent.getState().hydrate()
  }, [])

  const apply = useCallback((r: Result): boolean => {
    if (r.ok) {
      setItems(r.items)
      setStatus({ kind: 'ready' })
      return true
    }
    if (r.status === 503 && r.reason === 'db-not-configured') setStatus({ kind: 'off' })
    else setStatus({ kind: 'error', detail: r.detail || r.reason || String(r.status) })
    return false
  }, [])

  const load = useCallback(async () => {
    apply(await api('GET'))
  }, [apply])

  useEffect(() => {
    async function run() {
      await load()
    }
    void run()
  }, [load])

  /** 목록 전체 저장. 성공하면 서버가 돌려준 목록으로 갈아 끼운다. */
  async function saveAll(next: AdminCurated[], onDone?: () => void) {
    setBusy(true)
    setFormError('')
    const r = await api('PUT', { items: next.map((c, i) => ({ ...c, sort: i })) })
    setBusy(false)
    if (!r.ok) {
      // 저장 실패는 화면을 통째로 바꾸지 않는다 — 입력한 내용을 잃지 않도록 폼 안에서만 알린다.
      setFormError(r.detail || t('admin.curated.saveFailed'))
      return
    }
    apply(r)
    refreshPublic()
    toast(t('admin.curated.savedToast'), { type: 'success' })
    onDone?.()
  }

  async function removeCourse(c: AdminCurated) {
    const ok = await askConfirm({
      title: t('admin.curated.removeConfirmTitle'),
      message: t('admin.curated.removeConfirm', { title: c.i18n.ko.title || c.id }),
      confirmLabel: t('admin.curated.remove'),
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    const r = await api('DELETE', undefined, `&id=${encodeURIComponent(c.id)}`)
    setBusy(false)
    if (!apply(r)) return
    refreshPublic()
    toast(t('admin.curated.removedToast'), { type: 'success' })
  }

  function move(index: number, dir: -1 | 1) {
    const next = items.slice()
    const to = index + dir
    if (to < 0 || to >= next.length) return
    ;[next[index], next[to]] = [next[to], next[index]]
    setItems(next)
    void saveAll(next)
  }

  function togglePublished(index: number) {
    const next = items.slice()
    next[index] = { ...next[index], published: !next[index].published }
    setItems(next)
    void saveAll(next)
  }

  function submitDraft() {
    if (!draft) return
    const err = validate(draft, items, draftIsNew, t)
    if (err) {
      setFormError(err)
      return
    }
    const next = draftIsNew
      ? [...items, draft]
      : items.map((c) => (c.id === draft.id ? draft : c))
    void saveAll(next, () => {
      setDraft(null)
      setFormError('')
    })
  }

  if (status.kind === 'loading') return <p className="admin__status">{t('admin.loading')}</p>

  if (status.kind === 'off') {
    return (
      <section className="card-pad adm__notice">
        <h3 className="adm__notice-title">{t('admin.curated.dbOffTitle')}</h3>
        <p className="adm__notice-body">{t('admin.curated.dbOff')}</p>
      </section>
    )
  }

  if (status.kind === 'error') {
    return (
      <section className="card-pad adm__notice">
        <h3 className="adm__notice-title">{t('admin.curated.loadFailed')}</h3>
        <p className="adm__notice-body">{t('admin.curated.tableMissing')}</p>
        <code className="adm__notice-detail">{status.detail}</code>
        <button type="button" className="btn-secondary" onClick={() => { setStatus({ kind: 'loading' }); void load() }}>
          {t('admin.retry')}
        </button>
      </section>
    )
  }

  return (
    <section className="adm">
      <header className="adm__head">
        <div>
          <h3 className="adm__title">{t('admin.curated.title')}</h3>
          <p className="adm__hint">{t('admin.curated.hint')}</p>
        </div>
        <div className="adm__head-actions">
          {items.length === 0 && (
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => void saveAll(seedItems())}>
              {t('admin.curated.seed')}
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !!draft}
            onClick={() => { setDraft(blankDraft(items.length)); setDraftIsNew(true); setFormError('') }}
          >
            {t('admin.curated.add')}
          </button>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="adm__empty">{t('admin.curated.empty')}</p>
      ) : (
        <ul className="adm__list">
          {items.map((c, i) => (
            <li key={c.id} className={clsx('adm-row', !c.published && 'adm-row--hidden')}>
              <div className="adm-row__order">
                <button
                  type="button"
                  className="adm-row__move"
                  disabled={busy || i === 0}
                  onClick={() => move(i, -1)}
                  aria-label={t('admin.curated.up')}
                  title={t('admin.curated.up')}
                >
                  <ChevronDownIcon className="adm-row__move-icon adm-row__move-icon--up" width={16} height={16} />
                </button>
                <button
                  type="button"
                  className="adm-row__move"
                  disabled={busy || i === items.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={t('admin.curated.down')}
                  title={t('admin.curated.down')}
                >
                  <ChevronDownIcon className="adm-row__move-icon" width={16} height={16} />
                </button>
              </div>

              <div className="adm-row__body">
                <p className="adm-row__name">{c.i18n[lang]?.title || c.i18n.ko.title || c.id}</p>
                <p className="adm-row__meta">
                  {c.sigunguCodes.map((code) => SIGUNGUS.find((s) => s.code === code)?.[lang] ?? code).join(' · ')}
                  {' · '}
                  {PROFILE_LABELS[c.profile]?.[lang] ?? c.profile}
                  {' · '}
                  {t(`duration.${durKey(c.duration)}`)}
                </p>
              </div>

              <button
                type="button"
                className={clsx('adm-row__flag', c.published ? 'adm-row__flag--on' : 'adm-row__flag--off')}
                disabled={busy}
                onClick={() => togglePublished(i)}
              >
                {t(c.published ? 'admin.curated.published' : 'admin.curated.hidden')}
              </button>

              <button
                type="button"
                className="adm-row__icon"
                disabled={busy || !!draft}
                onClick={() => { setDraft(c); setDraftIsNew(false); setFormError('') }}
                aria-label={t('admin.curated.edit')}
                title={t('admin.curated.edit')}
              >
                <PencilIcon width={18} height={18} />
              </button>
              <button
                type="button"
                className="adm-row__icon adm-row__icon--danger"
                disabled={busy}
                onClick={() => void removeCourse(c)}
                aria-label={t('admin.curated.remove')}
                title={t('admin.curated.remove')}
              >
                <TrashIcon width={18} height={18} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {draft && (
        <CourseForm
          // 다른 코스를 열면 폼을 새로 세운다 — 언어 탭이 ko 로 돌아가고 화면도 폼으로 따라온다.
          key={draftIsNew ? '__new__' : draft.id}
          draft={draft}
          isNew={draftIsNew}
          busy={busy}
          error={formError}
          onChange={setDraft}
          onSubmit={submitDraft}
          onCancel={() => { setDraft(null); setFormError('') }}
        />
      )}
    </section>
  )
}

/* ── 입력 검증 (서버와 같은 규칙 — 왕복하기 전에 걸러 준다) ─────────── */

function validate(d: AdminCurated, items: AdminCurated[], isNew: boolean, t: (k: string) => string): string {
  if (!ID_RE.test(d.id)) return t('admin.curated.errId')
  if (isNew && items.some((c) => c.id === d.id)) return t('admin.curated.errDup')
  if (d.sigunguCodes.length < 1 || d.sigunguCodes.length > MAX_REGIONS) return t('admin.curated.errRegion')
  if (!d.i18n.ko.title.trim()) return t('admin.curated.errTitle')
  return ''
}

/* ── 폼 ───────────────────────────────────────────────────────────── */

function CourseForm({
  draft, isNew, busy, error, onChange, onSubmit, onCancel,
}: {
  draft: AdminCurated
  isNew: boolean
  busy: boolean
  error: string
  onChange: (d: AdminCurated) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const [tab, setTab] = useState<Lang>('ko')
  // 폼은 목록 아래에 열린다 — 목록이 길면 열린 줄 모르고 지나치므로 스스로 화면으로 들어온다.
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const set = (patch: Partial<AdminCurated>) => onChange({ ...draft, ...patch })
  const setText = (l: Lang, key: 'title' | 'desc', v: string) =>
    onChange({ ...draft, i18n: { ...draft.i18n, [l]: { ...draft.i18n[l], [key]: v } } })

  function toggleRegion(code: number) {
    const on = draft.sigunguCodes.includes(code)
    if (!on && draft.sigunguCodes.length >= MAX_REGIONS) return
    set({ sigunguCodes: on ? draft.sigunguCodes.filter((c) => c !== code) : [...draft.sigunguCodes, code] })
  }

  function toggleTheme(id: CategoryId) {
    const on = draft.themes.includes(id)
    if (!on && draft.themes.length >= MAX_THEMES) return
    set({ themes: on ? draft.themes.filter((c) => c !== id) : [...draft.themes, id] })
  }

  return (
    <form
      ref={formRef}
      className="adm-form card-pad"
      onSubmit={(e) => { e.preventDefault(); onSubmit() }}
    >
      <div className="adm-form__field">
        <label className="adm-form__label" htmlFor="adm-id">{t('admin.curated.fieldId')}</label>
        <input
          id="adm-id"
          className="input"
          value={draft.id}
          disabled={!isNew}
          onChange={(e) => set({ id: e.target.value })}
        />
        <p className="adm-form__hint">{t('admin.curated.fieldIdHint')}</p>
      </div>

      <div className="adm-form__field">
        <span className="adm-form__label">{t('admin.curated.fieldRegion')}</span>
        <div className="adm-form__chips">
          {SIGUNGUS.map((s) => (
            <button
              key={s.code}
              type="button"
              className={clsx('adm-chip', draft.sigunguCodes.includes(s.code) && 'adm-chip--on')}
              onClick={() => toggleRegion(s.code)}
            >
              {s[lang]}
            </button>
          ))}
        </div>
      </div>

      <div className="adm-form__row">
        <div className="adm-form__field">
          <label className="adm-form__label" htmlFor="adm-profile">{t('admin.curated.fieldProfile')}</label>
          <select
            id="adm-profile"
            className="input"
            value={draft.profile}
            onChange={(e) => set({ profile: e.target.value as CourseProfile })}
          >
            {(Object.keys(PROFILE_LABELS) as CourseProfile[]).map((p) => (
              <option key={p} value={p}>{PROFILE_LABELS[p][lang]}</option>
            ))}
          </select>
        </div>

        <div className="adm-form__field">
          <label className="adm-form__label" htmlFor="adm-duration">{t('admin.curated.fieldDuration')}</label>
          <select
            id="adm-duration"
            className="input"
            value={draft.duration}
            onChange={(e) => set({ duration: e.target.value as TripDuration })}
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>{t(`duration.${durKey(d)}`)}</option>
            ))}
          </select>
        </div>

        <div className="adm-form__field adm-form__field--color">
          <label className="adm-form__label" htmlFor="adm-accent">{t('admin.curated.fieldAccent')}</label>
          <input
            id="adm-accent"
            type="color"
            className="adm-form__color"
            value={draft.accent}
            onChange={(e) => set({ accent: e.target.value })}
          />
        </div>
      </div>

      <div className="adm-form__field">
        <span className="adm-form__label">{t('admin.curated.fieldThemes')}</span>
        <div className="adm-form__chips">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={clsx('adm-chip', draft.themes.includes(c.id) && 'adm-chip--on')}
              onClick={() => toggleTheme(c.id)}
            >
              {c.label[lang]}
            </button>
          ))}
        </div>
      </div>

      <div className="adm-form__field">
        <span className="adm-form__label">{t('admin.curated.fieldText')}</span>
        <div className="adm-form__langs">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              className={clsx('adm-chip', tab === l && 'adm-chip--on')}
              onClick={() => setTab(l)}
            >
              {l.toUpperCase()}
              {draft.i18n[l].title.trim() ? ' •' : ''}
            </button>
          ))}
        </div>
        <input
          className="input adm-form__text"
          placeholder={t('admin.curated.fieldTitle')}
          aria-label={t('admin.curated.fieldTitle')}
          value={draft.i18n[tab].title}
          onChange={(e) => setText(tab, 'title', e.target.value)}
        />
        <textarea
          className="input adm-form__textarea"
          rows={3}
          placeholder={t('admin.curated.fieldDesc')}
          aria-label={t('admin.curated.fieldDesc')}
          value={draft.i18n[tab].desc}
          onChange={(e) => setText(tab, 'desc', e.target.value)}
        />
        {tab !== 'ko' && <p className="adm-form__hint">{t('admin.curated.langFallback')}</p>}
      </div>

      {error && <p className="adm-form__error" role="alert">{error}</p>}

      <div className="adm-form__actions">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
          {t('admin.curated.cancel')}
        </button>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? t('admin.curated.saving') : t('admin.curated.save')}
        </button>
      </div>
    </form>
  )
}
