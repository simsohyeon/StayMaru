import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { useSettings } from '@/stores/settings'
import { useFavorites } from '@/stores/favorites'
import { PROFILE_LABELS, CATEGORIES } from '@/constants/categories'
import { SIGUNGUS, findSigungu } from '@/constants/sigungu'
import { searchFestivals, searchPlaces, searchAccessiblePlaces, searchPetFriendlyPlaces, isoToYmd } from '@/api/tour'
import { generateCourse } from '@/lib/courseEngine'
import { useCourses } from '@/stores/courses'
import CategoryBadge from '@/components/CategoryBadge'
import Thumbnail from '@/components/Thumbnail'
import OnboardingTour from '@/components/OnboardingTour'
import SmartHints from '@/components/SmartHints'
import TripChatbot, { type ChatbotResult } from '@/components/TripChatbot'
import JoinByKey from '@/components/JoinByKey'
import { CURATED_COURSES, type CuratedCourse } from '@/constants/curatedCourses'
import { fetchRainChance } from '@/api/weather'
import { loadVisitorBoost } from '@/lib/visitorIndex'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { toast } from '@/stores/toasts'
import type { Companion, CourseProfile, DateRange, Festival, Lang, Place, TripDuration } from '@/types/domain'

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
  /** 동반자 — 카테고리 가중치 + 무장애/반려동물 장소 가산. 기본 [] */
  companions?: Companion[]
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
  const [showcaseFestivals, setShowcaseFestivals] = useState<Festival[]>([])

  // 빌더 모달 전용 상태 — 헤더 '코스 만들기' 버튼으로만 열린다
  const [builderOpen, setBuilderOpen] = useState(false)
  const builderRef = useRef<HTMLDivElement>(null)
  // 빌더 모달 — Tab 트랩 + 열릴 때 초기 포커스 이동, 닫힐 때 직전 포커스 복원.
  useFocusTrap(builderRef, builderOpen)
  useEffect(() => {
    if (!builderOpen) return
    const prevFocus = document.activeElement as HTMLElement | null
    builderRef.current
      ?.querySelector<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])')
      ?.focus()
    return () => prevFocus?.focus?.()
  }, [builderOpen])
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
    }).catch(() => setShowcaseFestivals([]))
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
      const companions = input.companions ?? []
      const accessible = companions.includes('accessible')
      const petFriendly = companions.includes('pet')
      // 동반자에 맞는 전용 소스로 후보를 받는다 — 무장애: KorWithService2 / 반려동물: KorPetTourService.
      // 둘 다 선택 시 합집합. 전용 소스가 없으면 일반 검색.
      const sources: Array<(c: number) => Promise<{ items: Place[] }>> = []
      if (accessible) sources.push((c) => searchAccessiblePlaces({ sigunguCode: c, lang }))
      if (petFriendly) sources.push((c) => searchPetFriendlyPlaces({ sigunguCode: c, lang }))
      if (sources.length === 0) sources.push((c) => searchPlaces({ sigunguCode: c, lang }))

      // 시군 한 곳의 일시적 API 실패가 코스 생성 전체를 막지 않도록 부분 성공을 허용한다.
      const placeResults = await Promise.allSettled(
        sigunguCodes.flatMap((c) => sources.map((fn) => fn(c))),
      )
      let bucketed = placeResults.flatMap((r) => (r.status === 'fulfilled' ? r.value.items : []))
      // 전용 소스(무장애/반려동물) 결과가 비면 일반 검색으로 폴백 — 빈 코스보다 낫다.
      if ((accessible || petFriendly) && bucketed.length === 0) {
        const general = await Promise.allSettled(sigunguCodes.map((c) => searchPlaces({ sigunguCode: c, lang })))
        bucketed = general.flatMap((r) => (r.status === 'fulfilled' ? r.value.items : []))
      }
      const fallback = bucketed.length === 0 ? (await searchPlaces({ lang })).items : []
      // 합집합 — 같은 장소가 여러 소스에서 오면 id 기준 dedup.
      // 무장애+반려동물 동시 선택 시 뒤에 온 소스의 accessibility 플래그가 유실되지 않도록 병합한다.
      const byId = new Map<string, Place>()
      for (const p of [...bucketed, ...fallback]) {
        const prev = byId.get(p.id)
        byId.set(
          p.id,
          prev ? { ...prev, accessibility: { ...(prev.accessibility ?? {}), ...(p.accessibility ?? {}) } } : p,
        )
      }
      const candidates = [...byId.values()]

      setStage(2)
      // 빌더에서 date input 을 비운 채 생성하면 ''/Invalid Date 가 전파된다 — 무효 기간은 버린다.
      const effRange = isValidRange(input.range) ? input.range : undefined
      const festRange = effRange
        ? { startYmd: isoToYmd(effRange.start), endYmd: isoToYmd(effRange.end) }
        : undefined
      const festivals = await searchFestivals(lang, festRange, { ogImages: false })

      setStage(3)
      const weatherStartDate = effRange ? new Date(effRange.start) : new Date()
      const weather =
        sigunguCodes.length > 0
          ? await fetchRainChance(sigunguCodes[0], weatherStartDate)
          : undefined
      // DataLab 실방문자 기반 한적함 보너스 로드(IDB 캐시) — 코스 점수에 반영.
      await loadVisitorBoost()
      const course = generateCourse({
        candidates,
        festivals,
        baseSigungus: sigunguCodes,
        duration: input.duration,
        dateRange: effRange,
        profiles: effectiveProfiles,
        favorites,
        rainHint: weather?.hint,
        companions: input.companions,
        lang,
      })
      // 축제 연계를 골랐는데 해당 지역·기간에 축제가 없어 코스에 못 넣은 경우 안내.
      if (
        effectiveProfiles.includes('festival_link') &&
        !course.items.some((it) => it.place.category === 'festival')
      ) {
        const names = sigunguCodes
          .map((c) => findSigungu(c))
          .filter(Boolean)
          .map((s) => s![lang as 'ko' | 'en' | 'ja' | 'zh'])
          .join(' · ')
        toast(t('home.noFestivalToast', { names: names || t('home.sticky.autoBase') }), {
          type: 'info',
          duration: 4500,
        })
      }
      setStage(STAGES.length - 1)
      setCurrent(course)
      window.setTimeout(() => nav('/course'), 250)
    } catch (err) {
      console.error('[generateFromInput] failed', err)
      toast(t('course.generateFailed'), { type: 'error', duration: 3500 })
    } finally {
      window.setTimeout(() => {
        setGenerating(false)
        setStage(-1)
      }, 500)
    }
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

  /** 챗봇 완료 — 봇이 모은 값으로 한 줄 입력과 동일한 코스 엔진 호출 */
  async function generateFromChatbot(r: ChatbotResult) {
    const range = r.dateRange ?? rangeFromDuration(r.duration)
    await generateFromInput({
      sigunguCodes: r.sigunguCodes,
      range,
      profiles: r.profiles,
      duration: r.duration,
      companions: r.companions,
    })
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

      {/* ═══════ HERO — 챗봇 + 빠른 시작 칩 ═══════ */}
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

        {/* 메인 — 챗봇과 대화하며 코스 만들기 (버튼식 시나리오 봇, LLM 없음) */}
        <div className="mt-8 max-w-2xl">
          <TripChatbot
            variant="embedded"
            lang={lang}
            busy={generating}
            onComplete={(r) => void generateFromChatbot(r)}
          />
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
          {/* 친구 코스 키로 참여 — 실시간 협업 */}
          <div className="mt-5">
            <JoinByKey />
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

      {/* ═══════ DIRECT BUILDER — 모달 (헤더 '코스 만들기' 버튼으로만 진입) ═══════
         Cursor 디자인: cream canvas 위의 흰 카드 + hairline-only. drop-shadow 없음. */}
      {builderOpen && (
        <div
          ref={builderRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="builder-modal-title"
          className="fixed inset-0 z-[55] flex items-end md:items-center justify-center bg-ink/55 backdrop-blur-sm md:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBuilderOpen(false)
          }}
        >
          <div className="w-full md:max-w-3xl max-h-[92vh] md:max-h-[85vh] flex flex-col bg-card border-t md:border border-hairline rounded-t-lg md:rounded-lg animate-fade-up">

            {/* ── Header — eyebrow + title + tight subtitle ── */}
            <header className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-5 md:px-7 md:py-6">
              <div className="min-w-0">
                <p className="eyebrow">{t('home.builderEyebrow')}</p>
                <h2
                  id="builder-modal-title"
                  className="mt-2 font-display text-display-sm text-ink break-keep"
                >
                  {t('home.builderTitleNew')}
                </h2>
                <p className="mt-2 text-body-sm text-body break-keep max-w-xl">
                  {t('home.builderSubtitleNew')}
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={resetBuilder}
                  className="inline-flex items-center gap-1.5 rounded-md border border-hairline-strong bg-card px-3 h-8 text-xs font-medium text-body hover:text-ink hover:bg-canvas-soft transition-colors"
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

            {/* ── Body — 3-step picker ── */}
            <div className="flex-1 overflow-y-auto px-5 py-6 md:px-7 md:py-8 space-y-8">

              {/* Step 01 — 지역 */}
              <section>
                <header className="flex items-baseline gap-3">
                  <span className="eyebrow text-muted-soft">01</span>
                  <label className="eyebrow">{t('home.pickRegion')}</label>
                </header>
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
              </section>

              {/* Step 02 + 03 — 기간 / 유형 (데스크탑 2-up) */}
              <div className="grid gap-8 md:grid-cols-2">

                {/* Step 02 — 기간 */}
                <section>
                  <header className="flex items-baseline gap-3">
                    <span className="eyebrow text-muted-soft">02</span>
                    <label className="eyebrow">{t('home.pickDuration')}</label>
                  </header>
                  <div className="mt-3 grid grid-cols-2 gap-2.5 md:gap-3">
                    <label className="block">
                      <span className="eyebrow block text-muted-soft">{t('home.dateStart')}</span>
                      <input
                        type="date"
                        className="input mt-1.5"
                        value={range.start}
                        min={todayPlusYmd(0)}
                        max={range.end}
                        onChange={(e) => {
                          const start = e.target.value
                          setRange({ start, end: range.end < start ? start : range.end })
                        }}
                      />
                    </label>
                    <label className="block">
                      <span className="eyebrow block text-muted-soft">{t('home.dateEnd')}</span>
                      <input
                        type="date"
                        className="input mt-1.5"
                        value={range.end}
                        min={range.start}
                        onChange={(e) => {
                          const end = e.target.value
                          setRange({ start: range.start > end ? end : range.start, end })
                        }}
                      />
                    </label>
                  </div>
                  <p className="mt-2.5 font-mono text-[11px] tracking-wide text-muted">
                    {t(`duration.${duration === '1n2d' ? 'n1d2' : duration === '2n3d' ? 'n2d3' : duration}`)}
                    {duration === 'custom' &&
                      isValidRange(range) &&
                      ` · ${t('duration.nightsDays', { n: rangeNights(range), m: rangeNights(range) + 1 })}`}
                  </p>
                </section>

                {/* Step 03 — 유형 */}
                <section>
                  <header className="flex items-baseline gap-3">
                    <span className="eyebrow text-muted-soft">03</span>
                    <label className="eyebrow">{t('home.pickProfile')}</label>
                  </header>
                  <p className="mt-2 text-caption text-muted">{t('home.pickProfileHintMulti')}</p>
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
                </section>
              </div>

              {/* Smart hints — KTX 거점·날씨·5일장 */}
              <div className="pt-2 border-t border-hairline">
                <SmartHints sigunguCodes={selectedSigungus} startDate={range?.start} />
              </div>

              {/* Agent timeline — 생성 중에만 */}
              {generating && (
                <div className="surface-pane">
                  <p className="eyebrow text-muted mb-3">{t('home.builderTimeline')}</p>
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

            {/* ── Footer — sticky summary + primary CTA ── */}
            <footer
              className="flex items-center justify-between gap-4 border-t border-hairline bg-canvas-soft px-5 py-4 md:px-7 md:py-4"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
            >
              <div className="min-w-0 flex-1">
                <p className="eyebrow text-muted-soft">{t('home.sticky.eyebrow')}</p>
                <p className="mt-1 text-sm text-ink truncate">{summary}</p>
              </div>
              <button
                type="button"
                onClick={() => void generateFromBuilder()}
                disabled={generating}
                className="btn-primary whitespace-nowrap disabled:opacity-50"
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
  // 로컬(KST) 기준 — toISOString()은 UTC라 자정~09시 사이 하루가 어긋난다.
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
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

/** date input 을 Delete 로 비우면 value='' — NaN 박 표시·Invalid Date 전파를 막는다. */
function isValidRange(r: DateRange | undefined): r is DateRange {
  return (
    !!r?.start &&
    !!r.end &&
    !Number.isNaN(new Date(r.start).getTime()) &&
    !Number.isNaN(new Date(r.end).getTime())
  )
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
