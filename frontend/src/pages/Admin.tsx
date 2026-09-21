import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import TopBar from '@/components/TopBar'
import KhsPageHeader from '@/components/khs/KhsPageHeader'
import CuratedEditor from '@/components/admin/CuratedEditor'
import { useCourses } from '@/stores/courses'
import { useFavorites } from '@/stores/favorites'
import { findSigungu } from '@/constants/sigungu'
import { useSettings } from '@/stores/settings'
import { useAdminSession } from '@/stores/adminSession'
import { CATEGORY_MAP, PROFILE_LABELS } from '@/constants/categories'
import type { CategoryId, CourseProfile } from '@/types/domain'

// 언어 코드 → 모국어 표기 (언어 통계용)
const LANG_NAMES: Record<string, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  zh: '中文',
}

const API = '/api/admin'

/** api/admin.ts 의 stats 응답 */
interface Stats {
  courses: number
  clients: number
  places: number
  latest: string | null
  sampled: boolean
  byLang: [string, number][]
  byProfile: [string, number][]
  byRegion: [string, number][]
  byCategory: [string, number][]
}

/**
 * 화면 상태.
 * 관문은 서버(api/admin.ts)에 있고 여기서는 응답 코드만 읽는다 —
 * 번들은 공개되므로 프런트가 비밀번호를 알거나 비교하는 일은 없다.
 *   locked : 401 (쿠키 없음/만료) → 로그인 폼
 *   ready  : 200. stats 가 null 이면 인증은 됐지만 Supabase 미설정이라 서버 집계가 비어 있는 상태.
 *   off    : 503 — 서버에 ADMIN_PASSWORD 가 없거나 너무 짧아 기능 자체가 꺼짐
 */
type Gate =
  | { kind: 'loading' }
  | { kind: 'locked'; failed?: boolean }
  | { kind: 'ready'; stats: Stats | null }
  | { kind: 'off'; reason: string }
  | { kind: 'error' }

export default function Admin() {
  const { t } = useTranslation()
  const setAuthedHint = useAdminSession((s) => s.setAuthed)
  const [gate, setGate] = useState<Gate>({ kind: 'loading' })
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}?action=stats`, { credentials: 'same-origin' })
      // 메뉴에 '관리자'를 띄울지의 힌트 — 권한 자체는 매 요청마다 서버가 쿠키로 확인한다.
      setAuthedHint(res.status !== 401)
      if (res.status === 401) return setGate({ kind: 'locked' })
      if (res.status === 503) {
        const reason = String(((await res.json().catch(() => ({}))) as { reason?: string }).reason ?? '')
        // DB 만 없는 경우는 로그인 성공 상태를 유지한 채 로컬 통계라도 보여 준다.
        return setGate(reason === 'db-not-configured' ? { kind: 'ready', stats: null } : { kind: 'off', reason })
      }
      if (!res.ok) return setGate({ kind: 'error' })
      setGate({ kind: 'ready', stats: (await res.json()) as Stats })
    } catch {
      setGate({ kind: 'error' })
    }
  }, [setAuthedHint])

  // 마운트 시 한 번 세션을 확인한다 — 쿠키가 살아 있으면 곧장 통계, 아니면 401 → 로그인 폼.
  useEffect(() => {
    async function run() {
      await load()
    }
    void run()
  }, [load])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`${API}?action=login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password }),
      })
      setPassword('')
      if (!res.ok) return setGate({ kind: 'locked', failed: true })
      setAuthedHint(true)
      setGate({ kind: 'loading' })
      await load()
    } catch {
      setGate({ kind: 'locked', failed: true })
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    try {
      await fetch(`${API}?action=logout`, { method: 'POST', credentials: 'same-origin' })
    } catch {
      /* 쿠키를 지우지 못해도 화면은 잠근다 — 서버 쿠키는 만료시각이 있어 스스로 끊긴다. */
    }
    setAuthedHint(false)
    setGate({ kind: 'locked' })
  }

  return (
    <div className="page khs-page">
      <TopBar title={t('admin.title')} />
      <KhsPageHeader title={t('admin.title')} trail={[{ label: t('admin.title') }]} />

      {gate.kind === 'loading' && <p className="admin__status">{t('admin.loading')}</p>}

      {gate.kind === 'error' && (
        <div className="admin__gate">
          <p className="admin__gate-error">{t('admin.loadFailed')}</p>
          <button type="button" className="btn-secondary" onClick={() => { setGate({ kind: 'loading' }); void load() }}>
            {t('admin.retry')}
          </button>
        </div>
      )}

      {gate.kind === 'off' && (
        <div className="admin__gate">
          <h2 className="admin__gate-title">{t('admin.offTitle')}</h2>
          <p className="admin__gate-hint">
            {gate.reason === 'admin-password-too-short' ? t('admin.offTooShort') : t('admin.offNotSet')}
          </p>
          <code className="admin__gate-code">ADMIN_PASSWORD</code>
        </div>
      )}

      {gate.kind === 'locked' && (
        <form className="admin__gate" onSubmit={submit}>
          <h2 className="admin__gate-title">{t('admin.lockTitle')}</h2>
          <p className="admin__gate-hint">{t('admin.lockHint')}</p>
          <input
            className="input"
            type="password"
            name="password"
            autoComplete="current-password"
            autoFocus
            required
            aria-label={t('admin.passwordLabel')}
            placeholder={t('admin.passwordLabel')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {gate.failed && <p className="admin__gate-error" role="alert">{t('admin.loginFailed')}</p>}
          {/* 빈 입력은 required 가 막는다 — 비활성 버튼은 khs 테마에서 대비가 무너져 쓰지 않는다. */}
          <button type="submit" className="btn-primary admin__gate-submit" disabled={busy}>
            {busy ? t('admin.loginBusy') : t('admin.login')}
          </button>
        </form>
      )}

      {gate.kind === 'ready' && <Dashboard stats={gate.stats} onLogout={logout} />}
    </div>
  )
}

/* ── 대시보드 ─────────────────────────────────────────────────────── */

function Dashboard({ stats, onLogout }: { stats: Stats | null; onLogout: () => void }) {
  const { t } = useTranslation()
  // 테마 코스가 먼저 — 로그인해서 하는 일은 대개 문구를 고치는 쪽이다.
  const [tab, setTab] = useState<'curated' | 'stats'>('curated')
  const lang = useSettings((s) => s.lang)
  const saved = useCourses((s) => s.saved)
  const recent = useCourses((s) => s.recent)
  const favPlaces = useFavorites((s) => s.places)

  const byRegion = aggregateRegions(saved.flatMap((c) => c.items.map((i) => i.place.sigunguCode)))
  const byCategory = aggregate(favPlaces.map((p) => p.category))
  const byLang = aggregate(saved.map((c) => c.lang))

  return (
    <div className="page-body khs-page__body khs-page__body--single admin__wrap">
      <div className="admin__head">
        <div className="admin__tabs" role="tablist">
          {(['curated', 'stats'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              className={clsx('admin__tab', tab === k && 'admin__tab--on')}
              onClick={() => setTab(k)}
            >
              {t(k === 'curated' ? 'admin.tabCurated' : 'admin.tabStats')}
            </button>
          ))}
        </div>
        <button type="button" className="btn-ghost-outline" onClick={onLogout}>
          {t('admin.logout')}
        </button>
      </div>

      {tab === 'curated' && <CuratedEditor />}

      {tab === 'stats' && (
        <div className="admin__scope">
          <h2 className="admin__scope-title">{stats ? t('admin.serverTitle') : t('admin.dbOffTitle')}</h2>
          <p className="admin__scope-hint">{stats ? t('admin.serverHint') : t('admin.dbOffHint')}</p>
        </div>
      )}

      {tab === 'stats' && stats && (
        <div className="admin__body">
          <Card title={t('admin.statCourses')} value={`${stats.courses}`} />
          <Card title={t('admin.statClients')} value={`${stats.clients}`} />
          <Card title={t('admin.statPlaces')} value={`${stats.places}`} />
          <Card title={t('admin.statLatest')} value={stats.latest ? formatWhen(stats.latest, lang) : '—'} />

          <Section title={t('admin.popularByRegion')}>
            <Rows rows={stats.byRegion} label={(code) => regionName(code, lang, t('admin.unknown'))} />
          </Section>

          <Section title={t('admin.favoriteCategory')}>
            <Rows rows={stats.byCategory} label={(k) => categoryName(k, lang)} />
          </Section>

          <Section title={t('admin.byProfile')}>
            <Rows rows={stats.byProfile} label={(k) => PROFILE_LABELS[k as CourseProfile]?.[lang] ?? k} />
          </Section>

          <Section title={t('admin.usageByLang')}>
            <Rows rows={stats.byLang} label={(k) => LANG_NAMES[k] ?? k} />
          </Section>

          {stats.sampled && <p className="admin__note">{t('admin.sampledNote', { n: stats.courses })}</p>}
        </div>
      )}

      {tab === 'stats' && (
        <h2 className="admin__scope-title admin__scope-title--local">{t('admin.localTitle')}</h2>
      )}
      {tab === 'stats' && (
      <div className="admin__body">
        <Card title={t('admin.coursesGenerated')} value={`${saved.length} / ${recent.length}`} />
        <Card title={t('admin.favoritePlaces')} value={`${favPlaces.length}`} />

        <Section title={t('admin.popularByRegion')}>
          <Rows rows={byRegion.slice(0, 10)} label={(code) => regionName(code, lang, t('admin.unknown'))} />
        </Section>

        <Section title={t('admin.favoriteCategory')}>
          <Rows rows={byCategory} label={(k) => categoryName(k, lang)} />
        </Section>

        <Section title={t('admin.usageByLang')}>
          <Rows rows={byLang} label={(k) => LANG_NAMES[k] ?? k} />
        </Section>

        <p className="admin__note">{t('admin.note')}</p>
      </div>
      )}
    </div>
  )
}

function Rows({ rows, label }: { rows: [string, number][]; label: (key: string) => string }) {
  const { t } = useTranslation()
  if (rows.length === 0) return <p className="admin__empty">{t('admin.noData')}</p>
  return (
    <ul className="admin__list">
      {rows.map(([k, n]) => (
        <li key={k} className="admin__row">
          <span className="admin__row-label">{label(k)}</span>
          <span className="admin__row-value">{n}</span>
        </li>
      ))}
    </ul>
  )
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="card-pad admin__card">
      <div className="eyebrow">{title}</div>
      <div className="stat-value">{value}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-pad">
      <h3 className="eyebrow">{title}</h3>
      <div className="admin__section-body">{children}</div>
    </section>
  )
}

/* ── 라벨·집계 헬퍼 ───────────────────────────────────────────────── */

type Lang = 'ko' | 'en' | 'ja' | 'zh'

function regionName(code: string, lang: string, fallback: string): string {
  const sg = code ? findSigungu(Number(code)) : undefined
  return sg ? sg[lang as Lang] : fallback
}

function categoryName(key: string, lang: string): string {
  return CATEGORY_MAP[key as CategoryId]?.label[lang as Lang] ?? key
}

function formatWhen(iso: string, lang: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(lang, { month: 'short', day: 'numeric' })
}

function aggregate<T>(arr: T[]): [string, number][] {
  const m = new Map<string, number>()
  for (const v of arr) {
    const k = String(v ?? '')
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

function aggregateRegions(arr: (number | undefined)[]): [string, number][] {
  return aggregate(arr.filter((x): x is number => !!x).map(String))
}
