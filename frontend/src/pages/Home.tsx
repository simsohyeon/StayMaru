import { useEffect, useMemo, useState } from 'react'
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
import RailwayKickoff from '@/components/RailwayKickoff'
import { CURATED_COURSES, type CuratedCourse } from '@/constants/curatedCourses'
import { fetchRainChance } from '@/api/weather'
import type { KtxStation } from '@/constants/ktxStations'
import { toast } from '@/stores/toasts'
import type { CourseProfile, DateRange, Festival, Lang, TripDuration } from '@/types/domain'

const DURATIONS: TripDuration[] = ['day', '1n2d', '2n3d', 'custom']
const PROFILES: CourseProfile[] = [
  'hanok_emotion',
  'temple_healing',
  'experience_focus',
  'festival_link',
  'hidden_gb',
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

export default function Home() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const lang = useSettings((s) => s.lang)
  const hiddenMode = useSettings((s) => s.hiddenMode)
  const setHiddenMode = useSettings((s) => s.setHiddenMode)
  const profile = useSettings((s) => s.profile)
  const setProfile = useSettings((s) => s.setProfile)
  const favorites = useFavorites((s) => s.places)
  const setCurrent = useCourses((s) => s.setCurrent)

  const [duration, setDuration] = useState<TripDuration>('1n2d')
  const [range, setRange] = useState<DateRange | undefined>()
  const [selectedSigungus, setSelectedSigungus] = useState<number[]>([])
  const [generating, setGenerating] = useState(false)
  const [stage, setStage] = useState<number>(-1)
  const [nlInput, setNlInput] = useState('')
  const [nlMatched, setNlMatched] = useState<string[]>([])
  /** 빌더에 NL/큐레이션이 막 적용됐을 때 하이라이트 */
  const [builderJustApplied, setBuilderJustApplied] = useState(false)
  /** 빌더 disclosure — 기본 닫힘. 사용자가 직접 조정하고 싶을 때만 펼침. */
  const [builderOpen, setBuilderOpen] = useState(false)
  /** KTX 거점 선택 시 활성 역 슬러그 — 칩 시각 피드백용 */
  const [activeStation, setActiveStation] = useState<string | undefined>(undefined)

  const [showcaseFestivals, setShowcaseFestivals] = useState<Festival[]>([])

  // 빌더 모달 — ESC 닫기 + body scroll lock
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

  // 사용자가 한 가지라도 골랐으면 sticky CTA 노출
  const hasSelection =
    selectedSigungus.length > 0 || profile !== undefined || nlMatched.length > 0
  const summary = useMemo(
    () => buildSummary({ selectedSigungus, duration, profile, lang, t }),
    [selectedSigungus, duration, profile, lang, t],
  )

  function applyNlIntent() {
    const intent = parseTripIntent(nlInput)
    if (intent.sigunguCodes && intent.sigunguCodes.length > 0)
      setSelectedSigungus(intent.sigunguCodes)
    if (intent.duration) setDuration(intent.duration)
    if (intent.profile) setProfile(intent.profile)
    if (intent.profile === 'hidden_gb') setHiddenMode(true)
    setNlMatched(intent.matched)
    if (intent.matched.length > 0) {
      toast(t('home.nlAppliedToast'), { type: 'success' })
      setBuilderJustApplied(true)
      window.setTimeout(() => setBuilderJustApplied(false), 1500)
    } else {
      toast(t('home.nlNoMatchToast'), { type: 'info', duration: 3800 })
    }
  }

  function applyCurated(c: CuratedCourse) {
    setSelectedSigungus(c.sigunguCodes)
    setProfile(c.profile)
    setDuration(c.duration)
    if (c.profile === 'hidden_gb') setHiddenMode(true)
    setBuilderJustApplied(true)
    window.setTimeout(() => setBuilderJustApplied(false), 1500)
    toast(t('home.curatedAppliedToast', { title: c.i18n[lang].title }), { type: 'success' })
  }

  function applyChip(curatedId: string) {
    const c = CURATED_COURSES.find((x) => x.id === curatedId)
    if (c) applyCurated(c)
  }

  function applyRailway(st: KtxStation) {
    setSelectedSigungus(st.nearby)
    setActiveStation(st.slug)
    toast(
      t('railway.appliedToast', { name: st.label[lang], count: st.nearby.length }),
      { type: 'success' },
    )
  }

  const toggleSigungu = (code: number) => {
    setSelectedSigungus((cur) =>
      cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code].slice(-3),
    )
  }

  async function handleGenerate() {
    setGenerating(true)
    setStage(0)
    try {
      const dateRange = duration === 'custom' ? range : derivedRange(duration)
      const usedAuto = selectedSigungus.length === 0
      const sigunguCodes = usedAuto ? suggestSigungu(profile) : selectedSigungus
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
      const festRange = dateRange
        ? { startYmd: isoToYmd(dateRange.start), endYmd: isoToYmd(dateRange.end) }
        : undefined
      const festivals = await searchFestivals(lang, festRange)

      setStage(3)
      const weatherStartDate = dateRange?.start ? new Date(dateRange.start) : new Date()
      const weather =
        sigunguCodes.length > 0
          ? await fetchRainChance(sigunguCodes[0], weatherStartDate)
          : undefined
      const course = generateCourse({
        candidates,
        festivals,
        baseSigungus: sigunguCodes,
        duration,
        dateRange,
        profile,
        hiddenMode,
        favorites,
        rainHint: weather?.hint,
        lang,
      })
      setStage(STAGES.length - 1)
      setCurrent(course)
      window.setTimeout(() => nav('/course'), 250)
    } finally {
      window.setTimeout(() => {
        setGenerating(false)
        setStage(-1)
      }, 500)
    }
  }

  return (
    <div className={clsx('bg-canvas', hasSelection && 'pb-28 md:pb-24')}>
      <OnboardingTour />

      {/* ═══════ HERO — 단일 NL 입력 + 빠른 시작 칩 ═══════ */}
      <section className="px-5 pt-10 pb-8 md:px-10 md:pt-section md:pb-10">
        <div className="max-w-3xl animate-fade-up">
          <p className="eyebrow">{t('home.heroEyebrow')}</p>
          <h1 className="mt-5 text-display-lg md:text-display-mega text-ink break-keep">
            {t('home.heroTitleNew1')}<br />
            <span className="text-primary">{t('home.heroTitleNew2')}</span>
          </h1>
          <p className="mt-6 max-w-lg text-body-md text-body break-keep">
            {t('home.heroSubtitleNew')}
          </p>
        </div>

        {/* 큰 NL 입력 카드 */}
        <div className="mt-8 max-w-3xl">
          <div className="card-pad space-y-4">
            <div className="flex items-center justify-between">
              <span className="eyebrow">{t('home.nlEyebrowNew')}</span>
              <span className="font-mono text-[10px] text-muted-soft">no LLM · regex</span>
            </div>
            <textarea
              value={nlInput}
              onChange={(e) => setNlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  applyNlIntent()
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
                onClick={applyNlIntent}
                disabled={!nlInput.trim()}
                className="btn-secondary disabled:opacity-40"
              >
                {t('home.nlApply')}
              </button>
            </div>
          </div>
        </div>

        {/* 빠른 시작 칩 — 양옆 hairline 으로 NL 입력과 분리. */}
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
                onClick={() => applyChip(c.id)}
                className="chip-lg"
              >
                <span aria-hidden>{c.emoji}</span>
                {t(`home.quickChips.${c.key}`)}
              </button>
            ))}
          </div>
        </div>

        {/* "직접 빌더 열기" — 클릭 시 모달 오픈 */}
        <div className="mt-8 max-w-3xl">
          <button
            type="button"
            onClick={() => setBuilderOpen(true)}
            className="btn-ghost"
            aria-haspopup="dialog"
            aria-expanded={builderOpen}
          >
            <span aria-hidden>⚙</span>
            {t('home.builderDisclosure')}
          </button>
        </div>
      </section>

      {/* ═══════ CURATED — Hero 바로 아래로 끌어올림 (자연스러운 흐름, divider 없음) ═══════ */}
      <section className="px-5 pb-section md:px-10 pt-section">
        <div className="max-w-3xl">
          <p className="eyebrow">{t('curated.eyebrow')}</p>
          <h2 className="mt-3 section-title break-keep">{t('home.curatedTitleHome')}</h2>
          <p className="mt-3 text-body-sm text-body max-w-prose break-keep">
            {t('home.curatedSubtitleHome')}
          </p>
        </div>
        <ul className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {CURATED_COURSES.map((c) => (
            <li key={c.id}>
              <CuratedCard c={c} lang={lang} onPick={applyCurated} />
            </li>
          ))}
        </ul>
      </section>

      {/* ═══════ DIRECT BUILDER — 모달 (데스크탑) / 하단 시트 (모바일) ═══════ */}
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
          <div
            className={clsx(
              'w-full md:max-w-3xl max-h-[92vh] md:max-h-[85vh] flex flex-col',
              'bg-canvas border-t md:border border-hairline rounded-t-xl md:rounded-xl',
              'shadow-2xl animate-fade-up',
              builderJustApplied && 'animate-highlight',
            )}
          >
            {/* 헤더 — sticky 안에서도 보임 */}
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
              <button
                type="button"
                onClick={() => setBuilderOpen(false)}
                aria-label={t('common.close')}
                className="flex-shrink-0 -mr-2 rounded-md p-2 text-muted hover:text-ink hover:bg-canvas-soft transition-colors"
              >
                ✕
              </button>
            </header>

            {/* 본문 — 스크롤 영역 */}
            <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6 md:py-6 space-y-7">
              {builderJustApplied && (
                <p className="font-mono text-eyebrow uppercase text-primary">
                  ✦ {t('home.builderJustApplied')}
                </p>
              )}

              {/* Known/Hidden 토글 */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex rounded-md border border-hairline-strong bg-canvas p-0.5">
                  <ToggleSeg
                    active={!hiddenMode}
                    onClick={() => setHiddenMode(false)}
                    label={t('home.knownToggle')}
                  />
                  <ToggleSeg
                    active={hiddenMode}
                    onClick={() => setHiddenMode(true)}
                    label={t('home.hiddenToggle')}
                    accent
                  />
                </div>
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-soft">
                  {selectedSigungus.length > 0
                    ? t('home.builderRegionsHint', { count: selectedSigungus.length })
                    : t('home.builderRegionsAny')}
                </span>
              </div>

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
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {DURATIONS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDuration(d)}
                        className={clsx(
                          'rounded-md border h-11 text-sm font-medium transition-colors',
                          duration === d
                            ? 'border-ink bg-ink text-canvas'
                            : 'border-hairline-strong bg-card text-ink hover:bg-canvas-soft',
                        )}
                      >
                        {t(`duration.${d === '1n2d' ? 'n1d2' : d === '2n3d' ? 'n2d3' : d}`)}
                      </button>
                    ))}
                  </div>
                  {duration === 'custom' && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        className="input"
                        value={range?.start ?? ''}
                        onChange={(e) =>
                          setRange({ start: e.target.value, end: range?.end ?? e.target.value })
                        }
                      />
                      <input
                        type="date"
                        className="input"
                        value={range?.end ?? ''}
                        onChange={(e) =>
                          setRange({ start: range?.start ?? e.target.value, end: e.target.value })
                        }
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="eyebrow">{t('home.pickProfile')}</label>
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                    {PROFILES.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setProfile(profile === p ? undefined : p)}
                        className={clsx(
                          'rounded-md border px-3 h-11 text-sm font-medium transition-colors',
                          profile === p
                            ? 'border-ink bg-ink text-canvas'
                            : 'border-hairline-strong bg-card text-ink hover:bg-canvas-soft',
                        )}
                      >
                        {PROFILE_LABELS[p][lang]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 부가 — KTX & SmartHints */}
              <div className="space-y-4 pt-2 border-t border-hairline">
                <RailwayKickoff onPick={applyRailway} activeStation={activeStation} />
                <SmartHints sigunguCodes={selectedSigungus} startDate={range?.start} />
              </div>

              {/* 생성 단계 인디케이터 */}
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

            {/* 푸터 — 요약 + 코스 생성 */}
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
                onClick={() => {
                  setBuilderOpen(false)
                  void handleGenerate()
                }}
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
              <h2 className="mt-3 section-title break-keep">{t('home.ongoingTitle')}</h2>
              <p className="mt-3 text-body-md text-body max-w-prose break-keep">
                {t('home.ongoingSubtitle')}
              </p>
            </div>
            <Link to="/festivals" className="btn-text">
              {t('home.viewMore')}
            </Link>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {showcaseFestivals.slice(0, 6).map((f) => {
              const status = festivalStatus(f, toYmdLocal(new Date()))
              const ended = status === 'ended'
              return (
                <Link
                  key={f.id}
                  to={`/festivals/${f.id}`}
                  state={{ festival: f }}
                  className={clsx(
                    'card-hover overflow-hidden flex relative',
                    ended && 'opacity-60 grayscale',
                  )}
                >
                  <div className="w-32 flex-shrink-0">
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

      {/* ═══════ Sticky CTA Bar — 선택이 있고 모달이 닫혔을 때만 ═══════ */}
      {hasSelection && !builderOpen && (
        <StickyCTABar
          summary={summary}
          generating={generating}
          onGenerate={() => void handleGenerate()}
          onOpenBuilder={() => setBuilderOpen(true)}
          builderOpen={builderOpen}
        />
      )}
    </div>
  )
}

/** 큐레이션 카드 — Hero 직후 그리드용. 이전 CuratedCourses 컴포넌트와 동일 디자인. */
function CuratedCard({
  c,
  lang,
  onPick,
}: {
  c: CuratedCourse
  lang: Lang
  onPick: (c: CuratedCourse) => void
}) {
  const { t } = useTranslation()
  const tr = c.i18n[lang]
  const sgNames = c.sigunguCodes
    .map((code) => SIGUNGUS.find((s) => s.code === code)?.[lang])
    .filter(Boolean)
    .join(' · ')
  return (
    <button
      type="button"
      onClick={() => onPick(c)}
      className="group card-hover h-full w-full text-left overflow-hidden"
    >
      <div className="h-2 w-full" style={{ backgroundColor: c.accent }} aria-hidden />
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
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-hairline">
          <span className="badge-soft">{PROFILE_LABELS[c.profile][lang]}</span>
          <span className="badge-soft">{t(`duration.${durKey(c.duration)}`)}</span>
          {sgNames && (
            <span className="font-mono text-caption text-muted truncate">{sgNames}</span>
          )}
          <span className="ml-auto font-mono text-caption text-muted-soft group-hover:text-primary transition-colors">
            {t('curated.apply')} →
          </span>
        </div>
      </div>
    </button>
  )
}

/** 하단 sticky CTA — 선택값 요약과 코스 생성 버튼. 어디서든 즉시 생성 가능. */
function StickyCTABar({
  summary,
  generating,
  onGenerate,
  onOpenBuilder,
  builderOpen,
}: {
  summary: string
  generating: boolean
  onGenerate: () => void
  onOpenBuilder: () => void
  builderOpen: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 surface-float">
      <div className="mx-auto max-w-5xl px-4 py-3 md:px-6 md:py-4 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-soft">
            {t('home.sticky.eyebrow')}
          </p>
          <p className="mt-0.5 text-sm md:text-base text-ink truncate">{summary}</p>
        </div>
        {!builderOpen && (
          <button
            type="button"
            onClick={onOpenBuilder}
            className="btn-secondary text-xs hidden md:inline-flex"
          >
            {t('home.sticky.adjust')}
          </button>
        )}
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          className="btn-download whitespace-nowrap disabled:opacity-50"
        >
          {generating ? t('course.generating') : t('home.sticky.generate')}
        </button>
      </div>
    </div>
  )
}

function buildSummary({
  selectedSigungus,
  duration,
  profile,
  lang,
  t,
}: {
  selectedSigungus: number[]
  duration: TripDuration
  profile?: CourseProfile
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
  if (profile) parts.push(PROFILE_LABELS[profile][lang])
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

function ToggleSeg({
  active,
  onClick,
  label,
  accent,
}: {
  active: boolean
  onClick: () => void
  label: string
  accent?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-sm px-4 h-8 text-xs font-medium transition-colors',
        active
          ? accent
            ? 'bg-primary text-on-primary'
            : 'bg-ink text-canvas'
          : 'text-muted hover:text-ink',
      )}
    >
      {label}
    </button>
  )
}

function durKey(d: CuratedCourse['duration']): string {
  return d === '1n2d' ? 'n1d2' : d === '2n3d' ? 'n2d3' : d
}

function derivedRange(duration: TripDuration): DateRange | undefined {
  if (duration === 'custom') return undefined
  const today = new Date()
  const start = today.toISOString().slice(0, 10)
  const days = duration === 'day' ? 0 : duration === '1n2d' ? 1 : 2
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + days)
  return { start, end: endDate.toISOString().slice(0, 10) }
}

function suggestSigungu(profile?: CourseProfile): number[] {
  if (profile === 'hidden_gb') return [21, 8]
  if (profile === 'festival_link') return [11, 3]
  if (profile === 'temple_healing') return [2, 14]
  return [11]
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
