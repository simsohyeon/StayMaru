import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { useSettings } from '@/stores/settings'
import { useFavorites } from '@/stores/favorites'
import { PROFILE_LABELS, CATEGORIES } from '@/constants/categories'
import { SIGUNGUS, findSigungu } from '@/constants/sigungu'
import { searchFestivals, searchPlaces, isoToYmd } from '@/api/tour'
import { generateCourse } from '@/lib/courseEngine'
import { parseTripIntent } from '@/lib/parseTripIntent'
import { useCourses } from '@/stores/courses'
import CategoryBadge from '@/components/CategoryBadge'
import Thumbnail from '@/components/Thumbnail'
import OnboardingTour from '@/components/OnboardingTour'
import SmartHints from '@/components/SmartHints'
import { CURATED_COURSES, type CuratedCourse } from '@/constants/curatedCourses'
import { fetchRainChance } from '@/api/weather'
import { toast } from '@/stores/toasts'
import type { CourseProfile, DateRange, Festival, Lang, TripDuration } from '@/types/domain'

const PROFILES: CourseProfile[] = [
  'known_gb',
  'hidden_gb',
  'hanok_emotion',
  'temple_healing',
  'experience_focus',
  'festival_link',
]

// Hero 의 빠른 시작 칩 — 큐레이션 코스 ID 매칭. 칩과 카드가 같은 데이터를 공유한다.
const QUICK_CHIPS: { id: string; emoji: string; key: string }[] = [
  { id: 'andong-hanok-2n3d',                emoji: '🏯', key: 'andongHanok' },
  { id: 'gyeongju-silla-1n2d',              emoji: '🕊', key: 'gyeongjuSilla' },
  { id: 'yeongju-bonghwa-seowon-1n2d',      emoji: '📜', key: 'yeongjuSeowon' },
  { id: 'hidden-cheongsong-yeongyang-2n3d', emoji: '🌲', key: 'cheongsongHidden' },
  { id: 'mungyeong-experience-1n2d',        emoji: '🍵', key: 'mungyeongExperience' },
  { id: 'pohang-yeongdeok-coastal-1n2d',    emoji: '🌊', key: 'pohangCoast' },
]

// AI 코스 생성 단계 — Cursor 타임라인 pill 매핑
const STAGES = [
  { key: 'thinking', label: 'thinking', pill: 'pill-thinking' },
  { key: 'grep',     label: 'fetching', pill: 'pill-grep' },
  { key: 'read',     label: 'reading',  pill: 'pill-read' },
  { key: 'edit',     label: 'routing',  pill: 'pill-edit' },
  { key: 'done',     label: 'done',     pill: 'pill-done' },
] as const

interface GenInput {
  sigunguCodes: number[]
  range: DateRange
  profiles: CourseProfile[]
  duration: TripDuration
}

export default function Home() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const lang = useSettings((s) => s.lang)
  const favorites = useFavorites((s) => s.places)
  const setCurrent = useCourses((s) => s.setCurrent)

  // 공용 코스 생성 상태
  const [generating, setGenerating] = useState(false)
  const [stage, setStage] = useState<number>(-1)
  const [nlInput, setNlInput] = useState('')
  const [nlMatched, setNlMatched] = useState<string[]>([])
  const [showcaseFestivals, setShowcaseFestivals] = useState<Festival[]>([])
  const nlRef = useRef<HTMLTextAreaElement>(null)

  // 빌더 모달 전용 상태 — 헤더 '코스 만들기' 버튼으로만 열린다
  const [builderOpen, setBuilderOpen] = useState(false)
  const [selectedSigungus, setSelectedSigungus] = useState<number[]>([])
  const [range, setRange] = useState<DateRange>(() => defaultRange())
  const [profiles, setProfiles] = useState<CourseProfile[]>([])
  const duration: TripDuration = useMemo(() => durationFromRange(range), [range])

  // AppShell 헤더 '코스 만들기' → 빌더 모달 오픈
  useEffect(() => {
    const handler = () => setBuilderOpen(true)
    window.addEventListener('shimmaru:open-builder', handler)
    return () => window.removeEventListener('shimmaru:open-builder', handler)
  }, [])

  // 헤더 '코스 생성' 버튼이 NL 포커스 이벤트도 보낼 수 있다 — 빌더 우선이라 보통 호출되진 않음
  useEffect(() => {
    const handler = () => {
      nlRef.current?.focus()
      nlRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    window.addEventListener('shimmaru:focus-nl', handler)
    return () => window.removeEventListener('shimmaru:focus-nl', handler)
  }, [])

  // 빌더 모달 ESC + body scroll lock
  useEffect(() => {
    if (!builderOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBuilderOpen(false)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [builderOpen])

  useEffect(() => {
    void searchFestivals(lang).then((fests) => {
      const today = toYmdLocal(new Date())
      const enriched = fests
        .filter((f) => f.eventEndDate)
        .map((f) => ({ f, status: festivalStatus(f, today) }))
      const order = (s: 'ongoing' | 'upcoming' | 'ended') =>
        s === 'ongoing' ? 0 : s === 'upcoming' ? 1 : 2
      enriched.sort((a, b) => {
        const d = order(a.status) - order(b.status)
        if (d !== 0) return d
        if (a.status === 'ended') return b.f.eventEndDate.localeCompare(a.f.eventEndDate)
        return a.f.eventStartDate.localeCompare(b.f.eventStartDate)
      })
      setShowcaseFestivals(enriched.slice(0, 8).map((e) => e.f))
    })
  }, [lang])

  const summary = useMemo(
    () => buildSummary({ selectedSigungus, duration, profiles, lang, t }),
    [selectedSigungus, duration, profiles, lang, t],
  )

  function resetBuilder() {
    setSelectedSigungus([])
    setRange(defaultRange())
    setProfiles([])
    toast(t('home.builderResetToast'), { type: 'info', duration: 2000 })
  }

  function toggleProfile(p: CourseProfile) {
    setProfiles((cur) =>
      cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p],
    )
  }

  const toggleSigungu = (code: number) => {
    setSelectedSigungus((cur) =>
      cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code].slice(-3),
    )
  }

  async function generateFromInput(input: GenInput) {
    if (generating) return
    setGenerating(true)
    setStage(0)
    try {
      const usedAuto = input.sigunguCodes.length === 0
      const effectiveProfiles: CourseProfile[] =
        input.profiles.length > 0 ? input.profiles : ['known_gb']
      const sigunguCodes = usedAuto
        ? suggestSigungu(effectiveProfiles)
        : input.sigunguCodes

      if (usedAuto) {
        const names = sigunguCodes
          .map((c) => findSigungu(c))
          .filter(Boolean)
          .map((s) => s![lang as 'ko' | 'en' | 'ja' | 'zh'])
          .join(' · ')
        toast(t('home.autoSigunguToast', { names }), { type: 'info', duration: 4000 })
      }

      setStage(1)
      const placeBuckets = await Promise.all(
        sigunguCodes.map((c) => searchPlaces({ sigunguCode: c, lang })),
      )
      const bucketed = placeBuckets.flatMap((r) => r.items)
      const fallback = bucketed.length === 0 ? (await searchPlaces({ lang })).items : []
      const candidates = [...bucketed, ...fallback]

      setStage(2)
      const festRange = input.range
        ? { startYmd: isoToYmd(input.range.start), endYmd: isoToYmd(input.range.end) }
        : undefined
      const festivals = await searchFestivals(lang, festRange)

      setStage(3)
      const weatherStartDate = input.range?.start ? new Date(input.range.start) : new Date()
      const weather =
        sigunguCodes.length > 0
          ? await fetchRainChance(sigunguCodes[0], weatherStartDate)
          : undefined
      const course = generateCourse({
        candidates,
        festivals,
        baseSigungus: sigunguCodes,
        duration: input.duration,
        dateRange: input.range,
        profiles: effectiveProfiles,
        favorites,
        rainHint: weather?.hint,
        lang,
      })
      setStage(STAGES.length - 1)
      setCurrent(course)
      window.setTimeout(() => nav('/course'), 250)
    } catch (err) {
      console.error('[generateFromInput] failed', err)
      toast(t('home.nlNoMatchToast'), { type: 'error', duration: 3500 })
    } finally {
      window.setTimeout(() => {
        setGenerating(false)
        setStage(-1)
      }, 500)
    }
  }

  async function generateFromNL() {
    if (generating) return
    const intent = parseTripIntent(nlInput)
    setNlMatched(intent.matched)
    // 키워드 매칭이 없어도 폴백으로 곧장 코스 생성 — 사용자는 한 번 누르면 무조건 결과를 본다.
    if (intent.matched.length === 0) {
      toast(t('home.nlNoMatchToast'), { type: 'info', duration: 3000 })
    }
    const r: DateRange = intent.dateRange
      ? intent.dateRange
      : intent.duration
        ? rangeFromDuration(intent.duration)
        : defaultRange()
    await generateFromInput({
      sigunguCodes: intent.sigunguCodes ?? [],
      range: r,
      profiles: intent.profile ? [intent.profile] : [],
      duration: durationFromRange(r),
    })
  }

  async function generateFromCurated(c: CuratedCourse) {
    if (generating) return
    toast(t('home.curatedAppliedToast', { title: c.i18n[lang].title }), { type: 'success' })
    await generateFromInput({
      sigunguCodes: c.sigunguCodes,
      range: rangeFromDuration(c.duration),
      profiles: [c.profile],
      duration: c.duration,
    })
  }

  function generateFromChip(curatedId: string) {
    const c = CURATED_COURSES.find((x) => x.id === curatedId)
    if (c) void generateFromCurated(c)
  }

  /** 빌더 모달의 '코스 생성' — 모달에서 고른 값으로 생성 */
  async function generateFromBuilder() {
    setBuilderOpen(false)
    await generateFromInput({
      sigunguCodes: selectedSigungus,
      range,
      profiles,
      duration,
    })
  }

  return (
    <div className="bg-canvas">
      <OnboardingTour />

      {/* ═══════ HERO — 단일 NL 입력 + 빠른 시작 칩 ═══════ */}
      <section className="px-5 pt-10 pb-8 md:px-10 md:pt-section md:pb-10">
        <div className="max-w-3xl animate-fade-up">
          <h1 className="text-display-lg md:text-display-mega text-ink break-keep">
            {t('home.heroTitleNew1')}<br />
            <span className="text-primary">{t('home.heroTitleNew2')}</span>
          </h1>
          <p className="mt-6 max-w-lg text-body-md text-body break-keep">
            {t('home.heroSubtitleNew')}
          </p>
        </div>

        {/* 큰 NL 입력 카드 — 한 번 누르면 바로 코스 생성 */}
        <div className="mt-8 max-w-3xl">
          <div className="card-pad space-y-4">
            <div className="flex items-center justify-between">
              <span className="eyebrow">{t('home.nlEyebrowNew')}</span>
              <span className="font-mono text-[10px] text-muted-soft">no LLM · regex</span>
            </div>
            <textarea
              ref={nlRef}
              value={nlInput}
              onChange={(e) => setNlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  void generateFromNL()
                }
              }}
              placeholder={t('home.nlPlaceholder')}
              rows={2}
              className="input resize-none font-sans text-base"
              style={{ height: 'auto', minHeight: 60 }}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-caption text-muted-soft flex-1 min-w-0">
                {nlMatched.length > 0 ? (
                  <>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
                      {t('home.nlMatched')}
                    </span>{' '}
                    {nlMatched.join(' · ')}
                  </>
                ) : (
                  t('home.nlHint')
                )}
              </p>
              <button
                type="button"
                onClick={() => void generateFromNL()}
                disabled={!nlInput.trim() || generating}
                className="btn-download disabled:opacity-40"
              >
                {generating ? t('course.generating') : t('home.nlApply')}
              </button>
            </div>
          </div>
        </div>

        {/* 빠른 시작 칩 — 클릭 즉시 코스 생성 */}
        <div className="mt-7 max-w-3xl">
          <div className="flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-hairline" />
            <span className="font-mono text-[11px] uppercase tracking-[0.6px] text-muted-soft whitespace-nowrap">
              {t('home.quickChipsEyebrow')}
            </span>
            <span className="h-px flex-1 bg-hairline" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {QUICK_CHIPS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => generateFromChip(c.id)}
                disabled={generating}
                className="chip-lg disabled:opacity-40"
              >
                <span aria-hidden>{c.emoji}</span>
                {t(`home.quickChips.${c.key}`)}
              </button>
            ))}
          </div>
        </div>

      </section>

      {/* ═══════ CURATED — 카드 클릭 즉시 코스 생성 ═══════ */}
      <section className="px-5 pb-section md:px-10 pt-12 md:pt-section">
        <div className="max-w-3xl">
          <p className="eyebrow">{t('curated.eyebrow')}</p>
          <h2 className="mt-4 font-display text-display-md text-ink break-keep md:mt-3 md:text-display-lg">
            {t('home.curatedTitleHome')}
          </h2>
          <p className="mt-3 text-body-sm text-body max-w-prose break-keep md:mt-4 md:text-body-md">
            {t('home.curatedSubtitleHome')}
          </p>
        </div>
        <ul className="mt-7 grid gap-5 md:mt-10 md:grid-cols-2 lg:grid-cols-3">
          {CURATED_COURSES.map((c) => (
            <li key={c.id}>
              <CuratedCard c={c} lang={lang} onPick={generateFromCurated} disabled={generating} />
            </li>
          ))}
        </ul>
      </section>

      {/* ═══════ DIRECT BUILDER — 모달 (헤더 '코스 만들기' 버튼으로만 진입) ═══════ */}
      {builderOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="builder-modal-title"
          className="fixed inset-0 z-[55] flex items-end md:items-center justify-center bg-black/55 backdrop-blur-sm md:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBuilderOpen(false)
          }}
        >
          <div className="w-full md:max-w-3xl max-h-[92vh] md:max-h-[85vh] flex flex-col bg-canvas border-t md:border border-hairline rounded-t-xl md:rounded-xl shadow-2xl animate-fade-up">
            <header className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-4 md:px-6">
              <div className="min-w-0">
                <p className="eyebrow">{t('home.builderEyebrow')}</p>
                <h2
                  id="builder-modal-title"
                  className="mt-1 font-display text-display-sm text-ink break-keep"
                >
                  {t('home.builderTitleNew')}
                </h2>
                <p className="mt-1 text-caption text-body break-keep">
                  {t('home.builderSubtitleNew')}
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={resetBuilder}
                  className="inline-flex items-center gap-1 rounded-md border border-hairline-strong bg-card px-2.5 h-8 text-xs font-medium text-body hover:text-ink hover:bg-canvas-soft transition-colors"
                >
                  <span aria-hidden>↺</span>
                  {t('home.builderReset')}
                </button>
                <button
                  type="button"
                  onClick={() => setBuilderOpen(false)}
                  aria-label={t('common.close')}
                  className="-mr-2 rounded-md p-2 text-muted hover:text-ink hover:bg-canvas-soft transition-colors"
                >
                  ✕
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6 md:py-6 space-y-7">
              {/* 시군구 */}
              <div>
                <label className="eyebrow">{t('home.pickRegion')}</label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SIGUNGUS.map((sg) => {
                    const active = selectedSigungus.includes(sg.code)
                    return (
                      <button
                        key={sg.code}
                        type="button"
                        onClick={() => toggleSigungu(sg.code)}
                        className={clsx('chip', active && 'chip-active')}
                      >
                        {sg[lang as 'ko' | 'en' | 'ja' | 'zh']}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 기간 + 유형 */}
              <div className="grid gap-7 md:grid-cols-2">
                <div>
                  <label className="eyebrow">{t('home.pickDuration')}</label>
                  <div className="mt-3 grid grid-cols-2 gap-2.5 md:gap-3">
                    <label className="block">
                      <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-soft">
                        {t('home.dateStart')}
                      </span>
                      <input
                        type="date"
                        className="input mt-1"
                        value={range.start}
                        max={range.end}
                        onChange={(e) => {
                          const start = e.target.value
                          setRange({ start, end: range.end < start ? start : range.end })
                        }}
                      />
                    </label>
                    <label className="block">
                      <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-soft">
                        {t('home.dateEnd')}
                      </span>
                      <input
                        type="date"
                        className="input mt-1"
                        value={range.end}
                        min={range.start}
                        onChange={(e) => {
                          const end = e.target.value
                          setRange({ start: range.start > end ? end : range.start, end })
                        }}
                      />
                    </label>
                  </div>
                  <p className="mt-2 font-mono text-[10.5px] tracking-wide text-muted">
                    {t(`duration.${duration === '1n2d' ? 'n1d2' : duration === '2n3d' ? 'n2d3' : duration}`)}
                    {duration === 'custom' && ` · ${rangeNights(range)}박 ${rangeNights(range) + 1}일`}
                  </p>
                </div>
                <div>
                  <label className="eyebrow">{t('home.pickProfile')}</label>
                  <p className="mt-1 text-caption text-muted-soft">{t('home.pickProfileHintMulti')}</p>
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                    {PROFILES.map((p) => {
                      const active = profiles.includes(p)
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => toggleProfile(p)}
                          className={clsx(
                            'rounded-md border px-3 h-11 text-sm font-medium transition-colors',
                            active
                              ? 'border-ink bg-ink text-canvas'
                              : 'border-hairline-strong bg-card text-ink hover:bg-canvas-soft',
                          )}
                        >
                          {PROFILE_LABELS[p][lang]}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* 부가 — SmartHints */}
              <div className="space-y-4 pt-2 border-t border-hairline">
                <SmartHints sigunguCodes={selectedSigungus} startDate={range?.start} />
              </div>

              {generating && (
                <div className="surface-pane">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                      {t('home.builderTimeline')}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {STAGES.map((s, i) => (
                      <span
                        key={s.key}
                        className={clsx(
                          s.pill,
                          'animate-pill-pop',
                          i > stage && 'opacity-25 grayscale',
                        )}
                      >
                        {t(`timeline.${s.key}`)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <footer
              className="flex items-center justify-between gap-3 border-t border-hairline-strong bg-canvas/95 backdrop-blur px-5 py-3 md:px-6 md:py-4"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
            >
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.6px] text-muted-soft">
                  {t('home.sticky.eyebrow')}
                </p>
                <p className="mt-0.5 text-sm text-ink truncate">{summary}</p>
              </div>
              <button
                type="button"
                onClick={() => void generateFromBuilder()}
                disabled={generating}
                className="btn-download whitespace-nowrap disabled:opacity-50"
              >
                {generating ? t('course.generating') : t('home.sticky.generate')}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ═══════ FESTIVALS ═══════ */}
      {showcaseFestivals.length > 0 && (
        <section className="border-t border-hairline section-pad">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <p className="eyebrow">{t('home.ongoingEyebrow')}</p>
              <h2 className="mt-3 font-display text-display-md text-ink break-keep md:text-display-lg">
                {t('home.ongoingTitle')}
              </h2>
              <p className="mt-3 text-body-sm text-body max-w-prose break-keep md:text-body-md">
                {t('home.ongoingSubtitle')}
              </p>
            </div>
            <Link to="/festivals" className="btn-text">
              {t('home.viewMore')}
            </Link>
          </div>
          <div className="mt-8 grid gap-5 md:mt-10 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
            {showcaseFestivals.slice(0, 6).map((f) => {
              const status = festivalStatus(f, toYmdLocal(new Date()))
              const ended = status === 'ended'
              return (
                <Link
                  key={f.id}
                  to={`/festivals/${f.id}`}
                  state={{ festival: f }}
                  className={clsx(
                    'card-hover overflow-hidden flex flex-col sm:flex-row relative',
                    ended && 'opacity-60 grayscale',
                  )}
                >
                  <div className="aspect-[16/9] w-full overflow-hidden sm:aspect-auto sm:w-32 sm:flex-shrink-0">
                    <Thumbnail src={f.thumbnail} alt={f.name} category="festival" compact />
                  </div>
                  <div className="flex-1 min-w-0 p-5">
                    <div className="flex items-center gap-2">
                      <CategoryBadge category="festival" lang={lang} />
                      <StatusBadge status={status} />
                    </div>
                    <h3 className="mt-2 font-display text-title-md text-ink truncate">{f.name}</h3>
                    <p
                      className={clsx(
                        'mt-2 font-mono text-caption',
                        ended ? 'text-muted' : 'text-primary',
                      )}
                    >
                      {prettyYmd(f.eventStartDate)} → {prettyYmd(f.eventEndDate)}
                    </p>
                    <p className="mt-1 text-caption text-muted truncate">{f.address}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ═══════ Generating overlay — 코스 생성 중 단계 노출 (빌더 모달 밖에서 호출될 때만) ═══════ */}
      {generating && !builderOpen && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
        >
          <div className="surface-pane w-full max-w-md">
            <div className="flex items-center gap-2 mb-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                {t('home.builderTimeline')}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {STAGES.map((s, i) => (
                <span
                  key={s.key}
                  className={clsx(
                    s.pill,
                    'animate-pill-pop',
                    i > stage && 'opacity-25 grayscale',
                  )}
                >
                  {t(`timeline.${s.key}`)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** 큐레이션 카드 — 클릭하면 곧바로 코스 생성. */
function CuratedCard({
  c,
  lang,
  onPick,
  disabled,
}: {
  c: CuratedCourse
  lang: Lang
  onPick: (c: CuratedCourse) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const tr = c.i18n[lang]
  const sgNames = c.sigunguCodes
    .map((code) => SIGUNGUS.find((s) => s.code === code)?.[lang])
    .filter(Boolean)
    .join(' · ')
  const [thumb, setThumb] = useState<string | undefined>()

  // TourAPI 로 첫 거점 sigungu 의 대표 장소 사진을 한 장 가져와 카드 헤더에 노출.
  // 실패하면 그냥 accent strip 폴백.
  useEffect(() => {
    let cancelled = false
    void searchPlaces({ sigunguCode: c.sigunguCodes[0], lang, numOfRows: 8 })
      .then((res) => {
        if (cancelled) return
        const first = res.items.find((p) => !!p.thumbnail)
        if (first?.thumbnail) setThumb(first.thumbnail)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [c.sigunguCodes, lang])

  return (
    <button
      type="button"
      onClick={() => onPick(c)}
      disabled={disabled}
      className="group card-hover h-full w-full text-left overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div
        className="relative h-44 w-full overflow-hidden md:h-48"
        style={{ backgroundColor: c.accent }}
      >
        {thumb ? (
          <img
            src={thumb}
            alt=""
            aria-hidden
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <>
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${c.accent} 0%, ${c.accent}cc 55%, ${c.accent}77 100%)`,
              }}
              aria-hidden
            />
            <span
              aria-hidden
              className="absolute right-4 bottom-3 text-[72px] leading-none opacity-25 drop-shadow"
            >
              {(() => {
                const first = c.themes[0]
                const def = CATEGORIES.find((x) => x.id === first)
                return def?.emoji ?? '◇'
              })()}
            </span>
          </>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/45 to-transparent" aria-hidden />
        {sgNames && (
          <span className="absolute left-4 bottom-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white drop-shadow">
            {sgNames}
          </span>
        )}
      </div>
      <div className="p-5 md:p-6 space-y-4">
        <div className="flex items-center gap-2">
          {c.themes.slice(0, 3).map((tid) => {
            const def = CATEGORIES.find((x) => x.id === tid)
            if (!def) return null
            return (
              <span
                key={tid}
                title={def.label[lang]}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-canvas-soft text-base"
                aria-label={def.label[lang]}
              >
                {def.emoji}
              </span>
            )
          })}
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.16em] text-muted-soft">
            {c.badge}
          </span>
        </div>
        <h3 className="text-title-md text-ink break-keep group-hover:text-primary transition-colors">
          {tr.title}
        </h3>
        <p className="text-body-sm text-body line-clamp-3 break-keep">{tr.desc}</p>
        <div className="pt-3 border-t border-hairline space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="badge-soft">{PROFILE_LABELS[c.profile][lang]}</span>
            <span className="badge-soft">{t(`duration.${durKey(c.duration)}`)}</span>
            {sgNames && (
              <span className="font-mono text-caption text-muted">{sgNames}</span>
            )}
          </div>
          <div className="flex justify-end">
            <span className="font-mono text-caption text-muted-soft group-hover:text-primary transition-colors">
              {t('curated.apply')} →
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}

function buildSummary({
  selectedSigungus,
  duration,
  profiles,
  lang,
  t,
}: {
  selectedSigungus: number[]
  duration: TripDuration
  profiles: CourseProfile[]
  lang: Lang
  t: (k: string, v?: Record<string, unknown>) => string
}): string {
  const parts: string[] = []
  if (selectedSigungus.length > 0) {
    const names = selectedSigungus
      .slice(0, 2)
      .map((c) => findSigungu(c)?.[lang as 'ko' | 'en' | 'ja' | 'zh'])
      .filter(Boolean)
      .join(' · ')
    const more = selectedSigungus.length > 2 ? ` +${selectedSigungus.length - 2}` : ''
    parts.push(`${names}${more}`)
  } else {
    parts.push(t('home.sticky.autoBase'))
  }
  const durKeyShort = duration === '1n2d' ? 'n1d2' : duration === '2n3d' ? 'n2d3' : duration
  parts.push(t(`duration.${durKeyShort}`))
  if (profiles.length > 0) {
    const labels = profiles.slice(0, 2).map((p) => PROFILE_LABELS[p][lang])
    const tail = profiles.length > 2 ? ` +${profiles.length - 2}` : ''
    parts.push(labels.join(' · ') + tail)
  }
  return parts.join(' · ')
}

function StatusBadge({ status }: { status: 'ongoing' | 'upcoming' | 'ended' }) {
  const { t } = useTranslation()
  const styles: Record<typeof status, string> = {
    ongoing: 'bg-emerald-50 text-emerald-800',
    upcoming: 'bg-primary/10 text-primary',
    ended: 'bg-canvas-soft text-muted',
  } as const
  const dotStyles: Record<typeof status, string> = {
    ongoing: 'bg-emerald-500',
    upcoming: 'bg-primary',
    ended: 'bg-muted-soft',
  } as const
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotStyles[status]}`} aria-hidden />
      {t(`festivals.${status}`)}
    </span>
  )
}

function durKey(d: CuratedCourse['duration']): string {
  return d === '1n2d' ? 'n1d2' : d === '2n3d' ? 'n2d3' : d
}

function todayPlusYmd(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function defaultRange(): DateRange {
  return { start: todayPlusYmd(0), end: todayPlusYmd(1) }
}

function rangeNights(r: DateRange): number {
  const a = new Date(r.start)
  const b = new Date(r.end)
  const ms = b.getTime() - a.getTime()
  return Math.max(0, Math.round(ms / 86400000))
}

function durationFromRange(r: DateRange): TripDuration {
  const n = rangeNights(r)
  if (n === 0) return 'day'
  if (n === 1) return '1n2d'
  if (n === 2) return '2n3d'
  return 'custom'
}

function rangeFromDuration(d: TripDuration): DateRange {
  if (d === 'custom') return { start: todayPlusYmd(0), end: todayPlusYmd(3) }
  const nights = d === 'day' ? 0 : d === '1n2d' ? 1 : 2
  return { start: todayPlusYmd(0), end: todayPlusYmd(nights) }
}

function suggestSigungu(profiles: CourseProfile[]): number[] {
  if (profiles.includes('hidden_gb')) return [21, 8]
  if (profiles.includes('festival_link')) return [11, 3]
  if (profiles.includes('temple_healing')) return [2, 14]
  // known_gb/한옥/체험/빈 — 안동·경주 두 거점으로 유명 장소 범위 확보
  return [11, 2]
}

function prettyYmd(ymd: string) {
  if (!ymd || ymd.length !== 8) return ymd
  return `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}.${ymd.slice(6, 8)}`
}

function toYmdLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function festivalStatus(
  f: { eventStartDate: string; eventEndDate: string },
  today: string,
): 'ongoing' | 'upcoming' | 'ended' {
  if (f.eventEndDate < today) return 'ended'
  if (f.eventStartDate > today) return 'upcoming'
  return 'ongoing'
}
