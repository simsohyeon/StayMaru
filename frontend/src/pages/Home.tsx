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
import CollabStart from '@/components/CollabStart'
import { useCollab } from '@/stores/collab'
import { CURATED_COURSES, type CuratedCourse } from '@/constants/curatedCourses'
import { fetchRainChance } from '@/api/weather'
import { loadVisitorBoost } from '@/lib/visitorIndex'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { toast } from '@/stores/toasts'
import type { Companion, Course, CourseProfile, DateRange, Festival, Lang, Place, TripDuration } from '@/types/domain'

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
  const saveCourse = useCourses((s) => s.save)

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

      // 성능 — 축제·날씨·방문자 통계는 장소 검색과 독립이므로 '지금 동시에' 시작해 둔다.
      // (이전엔 장소→축제→날씨→방문자를 순차 await 해 합산 지연이 컸다. 이제 max(...) 로 단축.)
      // 각 소스가 실패해도 코스 생성이 막히지 않도록 안전 폴백.
      const effRange = isValidRange(input.range) ? input.range : undefined
      const festRange = effRange
        ? { startYmd: isoToYmd(effRange.start), endYmd: isoToYmd(effRange.end) }
        : undefined
      const festivalsP = searchFestivals(lang, festRange, { ogImages: false }).catch(
        () => [] as Festival[],
      )
      const weatherStartDate = effRange ? new Date(effRange.start) : new Date()
      const weatherP = (
        sigunguCodes.length > 0
          ? fetchRainChance(sigunguCodes[0], weatherStartDate)
          : Promise.resolve(undefined)
      ).catch(() => undefined)
      const visitorP = loadVisitorBoost().catch(() => undefined)

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

      // 위에서 장소 검색과 동시에 시작해 둔 독립 소스들을 이제 수거한다(이미 병렬 진행됨).
      // 축제·날씨는 코스 내용/점수에 직접 쓰이므로 대기. 방문자 통계(DataLab)는 '쉼 지수'·숨은지역
      // 보너스 용도로 정적 폴백(populationDensity/hiddenBoost)이 있어, 생성을 막지 않고 백그라운드 로드.
      setStage(2)
      const festivals = await festivalsP
      setStage(3)
      const weather = await weatherP
      void visitorP // 비블로킹 — 준비되면 쉼 지수에 반영, 아니면 정적 폴백
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
      // 협업 방이 활성화된 상태(빈 코스로 함께 시작 등)면, 생성 결과를 그 방에 채워 실시간 공유한다.
      const collab = useCollab.getState()
      const cur = useCourses.getState().current
      if (collab.code && cur?.collabCode === collab.code) {
        const linked: Course = {
          ...course,
          id: cur.id,
          collabCode: collab.code,
          contributors: cur.contributors,
          companionsByContributor: cur.companionsByContributor,
          items: course.items.map((it) => ({ ...it, addedBy: it.addedBy ?? collab.me.id })),
        }
        setCurrent(linked)
        saveCourse(linked)
        collab.publish(linked)
      } else {
        setCurrent(course)
      }
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
    <div className="page">
      <OnboardingTour />

      {/* ═══════ HERO — 챗봇 + 빠른 시작 칩 ═══════ */}
      <section className="home__hero">
        <div className="home__hero-lead animate-fade-up">
          <h1 className="home__hero-title">
            {t('home.heroTitleNew1')}<br />
            <span className="home__hero-title-accent">{t('home.heroTitleNew2')}</span>
          </h1>
          <p className="home__hero-subtitle">
            {t('home.heroSubtitleNew')}
          </p>
        </div>

        {/* 메인 — 챗봇과 대화하며 코스 만들기 (버튼식 시나리오 봇, LLM 없음).
           폭은 하단 큐레이션·축제 그리드와 동일하게 콘텐츠 풀폭으로 통일. */}
        <div className="home__chatbot">
          <TripChatbot
            variant="embedded"
            lang={lang}
            busy={generating}
            onComplete={(r) => void generateFromChatbot(r)}
          />
        </div>

        {/* 빠른 시작 칩 — 클릭 즉시 코스 생성 */}
        <div className="home__quick">
          <div className="home__quick-divider" aria-hidden>
            <span className="home__quick-rule" />
            <span className="home__quick-label">
              {t('home.quickChipsEyebrow')}
            </span>
            <span className="home__quick-rule" />
          </div>
          <div className="home__quick-chips">
            {QUICK_CHIPS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => generateFromChip(c.id)}
                disabled={generating}
                className="chip-lg home__quick-chip"
              >
                <span aria-hidden>{c.emoji}</span>
                {t(`home.quickChips.${c.key}`)}
              </button>
            ))}
          </div>
        </div>

        {/* 함께 짜는 코스 — 코스를 먼저 만들지 않아도 시작/참여 (실시간 협업) */}
        <div className="home__collab">
          <CollabStart />
        </div>

      </section>

      {/* ═══════ CURATED — 카드 클릭 즉시 코스 생성 ═══════ */}
      <section className="home__curated">
        <div className="home__curated-head">
          <p className="eyebrow">{t('curated.eyebrow')}</p>
          <h2 className="home__curated-title">
            {t('home.curatedTitleHome')}
          </h2>
          <p className="home__curated-subtitle">
            {t('home.curatedSubtitleHome')}
          </p>
        </div>
        <ul className="home__curated-grid">
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
          className="home__modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBuilderOpen(false)
          }}
        >
          <div className="home__modal animate-fade-up">

            {/* ── Header — eyebrow + title + tight subtitle ── */}
            <header className="home__modal-header">
              <div className="home__modal-header-text">
                <p className="eyebrow">{t('home.builderEyebrow')}</p>
                <h2
                  id="builder-modal-title"
                  className="home__modal-title"
                >
                  {t('home.builderTitleNew')}
                </h2>
                <p className="home__modal-subtitle">
                  {t('home.builderSubtitleNew')}
                </p>
              </div>
              <div className="home__modal-actions">
                <button
                  type="button"
                  onClick={resetBuilder}
                  className="home__modal-reset"
                >
                  <span aria-hidden>↺</span>
                  {t('home.builderReset')}
                </button>
                <button
                  type="button"
                  onClick={() => setBuilderOpen(false)}
                  aria-label={t('common.close')}
                  className="home__modal-close"
                >
                  ✕
                </button>
              </div>
            </header>

            {/* ── Body — 3-step picker ── */}
            <div className="home__modal-body">

              {/* Step 01 — 지역 */}
              <section>
                <header className="home__step-head">
                  <span className="home__step-num">01</span>
                  <label className="eyebrow">{t('home.pickRegion')}</label>
                </header>
                <div className="home__region-chips">
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
              <div className="home__step-grid">

                {/* Step 02 — 기간 */}
                <section>
                  <header className="home__step-head">
                    <span className="home__step-num">02</span>
                    <label className="eyebrow">{t('home.pickDuration')}</label>
                  </header>
                  <div className="home__date-grid">
                    <label className="home__date-field">
                      <span className="home__date-label">{t('home.dateStart')}</span>
                      <input
                        type="date"
                        className="input home__date-input"
                        value={range.start}
                        min={todayPlusYmd(0)}
                        max={range.end}
                        onChange={(e) => {
                          const start = e.target.value
                          setRange({ start, end: range.end < start ? start : range.end })
                        }}
                      />
                    </label>
                    <label className="home__date-field">
                      <span className="home__date-label">{t('home.dateEnd')}</span>
                      <input
                        type="date"
                        className="input home__date-input"
                        value={range.end}
                        min={range.start}
                        onChange={(e) => {
                          const end = e.target.value
                          setRange({ start: range.start > end ? end : range.start, end })
                        }}
                      />
                    </label>
                  </div>
                  <p className="home__duration-note">
                    {t(`duration.${duration === '1n2d' ? 'n1d2' : duration === '2n3d' ? 'n2d3' : duration}`)}
                    {duration === 'custom' &&
                      isValidRange(range) &&
                      ` · ${t('duration.nightsDays', { n: rangeNights(range), m: rangeNights(range) + 1 })}`}
                  </p>
                </section>

                {/* Step 03 — 유형 */}
                <section>
                  <header className="home__step-head">
                    <span className="home__step-num">03</span>
                    <label className="eyebrow">{t('home.pickProfile')}</label>
                  </header>
                  <p className="home__profile-hint">{t('home.pickProfileHintMulti')}</p>
                  <div className="home__profile-grid">
                    {PROFILES.map((p) => {
                      const active = profiles.includes(p)
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => toggleProfile(p)}
                          className={clsx(
                            'home__profile-btn',
                            active ? 'home__profile-btn--active' : 'home__profile-btn--idle',
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
              <div className="home__hints">
                <SmartHints sigunguCodes={selectedSigungus} startDate={range?.start} />
              </div>

              {/* Agent timeline — 생성 중에만 */}
              {generating && (
                <div className="surface-pane">
                  <p className="home__timeline-label">{t('home.builderTimeline')}</p>
                  <div className="home__timeline-pills">
                    {STAGES.map((s, i) => (
                      <span
                        key={s.key}
                        className={clsx(
                          s.pill,
                          'home__pill',
                          i > stage && 'home__pill--dim',
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
              className="home__modal-footer"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
            >
              <div className="home__footer-text">
                <p className="home__footer-eyebrow">{t('home.sticky.eyebrow')}</p>
                <p className="home__footer-summary">{summary}</p>
              </div>
              <button
                type="button"
                onClick={() => void generateFromBuilder()}
                disabled={generating}
                className="btn-primary home__generate-btn"
              >
                {generating ? t('course.generating') : t('home.sticky.generate')}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ═══════ FESTIVALS ═══════ */}
      {showcaseFestivals.length > 0 && (
        <section className="home__fest">
          <div className="home__fest-head">
            <div>
              <p className="eyebrow">{t('home.ongoingEyebrow')}</p>
              <h2 className="home__fest-title">
                {t('home.ongoingTitle')}
              </h2>
              <p className="home__fest-subtitle">
                {t('home.ongoingSubtitle')}
              </p>
            </div>
            <Link to="/festivals" className="btn-text">
              {t('home.viewMore')}
            </Link>
          </div>
          <div className="home__fest-grid">
            {showcaseFestivals.slice(0, 6).map((f) => {
              const status = festivalStatus(f, toYmdLocal(new Date()))
              const ended = status === 'ended'
              return (
                <Link
                  key={f.id}
                  to={`/festivals/${f.id}`}
                  state={{ festival: f }}
                  className={clsx(
                    'card-hover home__fest-card',
                    ended && 'home__fest-card--ended',
                  )}
                >
                  <div className="home__fest-media">
                    <Thumbnail src={f.thumbnail} alt={f.name} category="festival" compact />
                  </div>
                  <div className="home__fest-body">
                    <div className="home__fest-badges">
                      <CategoryBadge category="festival" lang={lang} />
                      <StatusBadge status={status} />
                    </div>
                    <h3 className="card-title home__fest-name">{f.name}</h3>
                    <p
                      className={clsx(
                        'home__fest-dates',
                        ended ? 'home__fest-dates--ended' : 'home__fest-dates--active',
                      )}
                    >
                      {prettyYmd(f.eventStartDate)} → {prettyYmd(f.eventEndDate)}
                    </p>
                    <p className="home__fest-address">{f.address}</p>
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
          className="home__overlay"
        >
          <div className="surface-pane home__overlay-pane">
            <div className="home__overlay-head">
              <span className="home__overlay-label">
                {t('home.builderTimeline')}
              </span>
            </div>
            <div className="home__overlay-pills">
              {STAGES.map((s, i) => (
                <span
                  key={s.key}
                  className={clsx(
                    s.pill,
                    'home__pill',
                    i > stage && 'home__pill--dim',
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
      className="group card-hover curated-card"
    >
      <div
        className="curated-card__media"
        style={{ backgroundColor: c.accent }}
      >
        {thumb ? (
          <img
            src={thumb}
            alt=""
            aria-hidden
            loading="lazy"
            className="curated-card__img"
          />
        ) : (
          <>
            <div
              className="curated-card__gradient"
              style={{
                background: `linear-gradient(135deg, ${c.accent} 0%, ${c.accent}cc 55%, ${c.accent}77 100%)`,
              }}
              aria-hidden
            />
            <span
              aria-hidden
              className="curated-card__emoji"
            >
              {(() => {
                const first = c.themes[0]
                const def = CATEGORIES.find((x) => x.id === first)
                return def?.emoji ?? '◇'
              })()}
            </span>
          </>
        )}
        <div className="curated-card__scrim" aria-hidden />
        {sgNames && (
          <span className="curated-card__region">
            {sgNames}
          </span>
        )}
      </div>
      <div className="curated-card__body">
        <div className="curated-card__themes">
          {c.themes.slice(0, 3).map((tid) => {
            const def = CATEGORIES.find((x) => x.id === tid)
            if (!def) return null
            return (
              <span
                key={tid}
                title={def.label[lang]}
                className="curated-card__theme"
                aria-label={def.label[lang]}
              >
                {def.emoji}
              </span>
            )
          })}
          <span className="curated-card__badge">
            {c.badge}
          </span>
        </div>
        <h3 className="curated-card__title">
          {tr.title}
        </h3>
        <p className="curated-card__desc">{tr.desc}</p>
        <div className="curated-card__meta">
          <div className="curated-card__tags">
            <span className="badge-soft">{PROFILE_LABELS[c.profile][lang]}</span>
            <span className="badge-soft">{t(`duration.${durKey(c.duration)}`)}</span>
            {sgNames && (
              <span className="curated-card__sg">{sgNames}</span>
            )}
          </div>
          <div className="curated-card__apply-row">
            <span className="curated-card__apply">
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
    ongoing: 'status-badge--ongoing',
    upcoming: 'status-badge--upcoming',
    ended: 'status-badge--ended',
  } as const
  const dotStyles: Record<typeof status, string> = {
    ongoing: 'status-dot--ongoing',
    upcoming: 'status-dot--upcoming',
    ended: 'status-dot--ended',
  } as const
  return (
    <span className={clsx('status-badge', styles[status])}>
      <span className={clsx('status-dot', dotStyles[status])} aria-hidden />
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
