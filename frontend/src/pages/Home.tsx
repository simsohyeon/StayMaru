import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { useSettings } from '@/stores/settings'
import { useFavorites } from '@/stores/favorites'
import { CATEGORIES, PROFILE_LABELS } from '@/constants/categories'
import { SIGUNGUS } from '@/constants/sigungu'
import { searchFestivals, searchPlaces, isoToYmd } from '@/api/tour'
import { generateCourse } from '@/lib/courseEngine'
import { useCourses } from '@/stores/courses'
import KakaoMap from '@/components/KakaoMap'
import CategoryBadge from '@/components/CategoryBadge'
import Thumbnail from '@/components/Thumbnail'
import type { CategoryId, CourseProfile, DateRange, Festival, Place, TripDuration } from '@/types/domain'

const DURATIONS: TripDuration[] = ['day', '1n2d', '2n3d', 'custom']
const PROFILES: CourseProfile[] = [
  'hanok_emotion',
  'temple_healing',
  'experience_focus',
  'festival_link',
  'hidden_gb',
]

// AI 코스 생성 단계 — Cursor 타임라인 pill 매핑
const STAGES = [
  { key: 'thinking', label: 'thinking',  pill: 'pill-thinking' },
  { key: 'grep',     label: 'fetching',  pill: 'pill-grep' },
  { key: 'read',     label: 'reading',   pill: 'pill-read' },
  { key: 'edit',     label: 'routing',   pill: 'pill-edit' },
  { key: 'done',     label: 'done',      pill: 'pill-done' },
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

  const [showcasePlaces, setShowcasePlaces] = useState<Place[]>([])
  const [showcaseFestivals, setShowcaseFestivals] = useState<Festival[]>([])
  /** 히어로 지도용 — 카테고리별 핑 데이터 (지도 ON/OFF 토글). */
  const [mapByCat, setMapByCat] = useState<Record<CategoryId, Place[]>>({} as Record<CategoryId, Place[]>)
  const [activeMapCats, setActiveMapCats] = useState<Set<CategoryId>>(
    () => new Set<CategoryId>(['hanok', 'temple', 'seowon', 'experience']),
  )

  useEffect(() => {
    void searchPlaces({ lang, numOfRows: 12 }).then((res) => setShowcasePlaces(res.items))

    // 히어로 지도용 — 카테고리별로 동시 호출하여 핑 데이터 모으기 (각 20개씩)
    const mapCats: CategoryId[] = ['hanok', 'temple', 'seowon', 'experience', 'market', 'attraction']
    void Promise.all(
      mapCats.map((c) =>
        searchPlaces({ category: c, lang, numOfRows: 20 }).then((res) => [c, res.items] as const),
      ),
    ).then((entries) => {
      const next = {} as Record<CategoryId, Place[]>
      for (const [c, items] of entries) next[c] = items
      setMapByCat(next)
    })

    void searchFestivals(lang).then((fests) => {
      // 진행 중·예정 우선, 종료된 축제는 정보성으로 함께 표시 (mask 처리).
      // 정렬: 진행중 → 예정(가까운 순) → 종료(최근 종료 순)
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

  const toggleSigungu = (code: number) => {
    setSelectedSigungus((cur) =>
      cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code].slice(-3),
    )
  }

  async function handleGenerate() {
    setGenerating(true)
    setStage(0)
    try {
      // 타임라인 단계 시각화 (NFR-P02 — 5초 이내)
      const stageTimers = [200, 600, 1100, 1700].map((ms, i) =>
        setTimeout(() => setStage(i + 1), ms),
      )

      const dateRange = duration === 'custom' ? range : derivedRange(duration)
      const sigunguCodes = selectedSigungus.length > 0 ? selectedSigungus : suggestSigungu(profile)
      const placeBuckets = await Promise.all(
        sigunguCodes.map((c) => searchPlaces({ sigunguCode: c, lang })),
      )
      const bucketed = placeBuckets.flatMap((r) => r.items)
      const fallback = bucketed.length === 0 ? (await searchPlaces({ lang })).items : []
      const candidates = [...bucketed, ...fallback]
      const festRange = dateRange
        ? { startYmd: isoToYmd(dateRange.start), endYmd: isoToYmd(dateRange.end) }
        : undefined
      const festivals = await searchFestivals(lang, festRange)
      const course = generateCourse({
        candidates,
        festivals,
        baseSigungus: sigunguCodes,
        duration,
        dateRange,
        profile,
        hiddenMode,
        favorites,
        lang,
      })
      stageTimers.forEach(clearTimeout)
      setStage(STAGES.length - 1)
      setCurrent(course)
      setTimeout(() => nav('/course'), 250)
    } finally {
      setTimeout(() => {
        setGenerating(false)
        setStage(-1)
      }, 600)
    }
  }

  const hiddenSpots = showcasePlaces.filter((p) => {
    const sg = SIGUNGUS.find((s) => s.code === p.sigunguCode)
    return sg && sg.hiddenBoost >= 0.6
  })

  function toggleMapCat(c: CategoryId) {
    setActiveMapCats((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }

  // 활성 카테고리들의 핑만 모아서 지도에 표시. 좌표 없는(0,0) 항목은 제외.
  const visiblePins: Place[] = Array.from(activeMapCats).flatMap(
    (c) => mapByCat[c]?.filter((p) => p.position.lat && p.position.lng) ?? [],
  )

  return (
    <div className="bg-canvas">
      {/* ═══════ HERO ═══════ */}
      <section className="px-5 pt-12 pb-section md:px-10 md:pt-section md:pb-section">
        <div className="grid gap-10 md:grid-cols-12 md:gap-12 md:items-end">
          <div className="md:col-span-7 animate-fade-up">
            <p className="eyebrow">{t('home.heroEyebrow')}</p>
            <h1
              className="mt-6 text-ink"
              style={{
                fontSize: 'clamp(36px, 8vw, 72px)',
                lineHeight: 1.05,
                letterSpacing: '-0.04em',
                fontWeight: 400,
              }}
            >
              {t('home.heroTitle1')}<br />
              <span className="text-primary">{t('home.heroTitle2')}</span> {t('home.heroTitle3')}
            </h1>
            <p className="mt-6 max-w-md text-body-md text-body">
              {t('home.heroSubtitle')}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#builder" className="btn-primary">
                {t('home.ctaScrollToBuilder')}
              </a>
              <Link to="/explore" className="btn-text">
                {t('home.ctaExplore')}
              </Link>
            </div>
          </div>

          {/* 우측 — 큰 통계/내러티브 콘솔 */}
          <div className="md:col-span-5">
            <div className="card-pad space-y-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                  {t('home.live')}
                </span>
                <span className="inline-flex h-2 w-2 rounded-full bg-success" />
              </div>
              <Stat label={t('home.statSpaces')} value={`${showcasePlaces.length}+`} unit={t('home.statSpacesUnit')} />
              <Stat label={t('home.statFestivals')} value={`${showcaseFestivals.length}`} unit={t('home.statFestivalsUnit')} />
              <Stat label={t('home.statSigungus')} value="23" unit={t('home.statSigungusUnit')} />
              <div className="flex flex-wrap gap-2 pt-2 border-t border-hairline">
                {CATEGORIES.slice(0, 5).map((c) => (
                  <span key={c.id} className="badge-soft">
                    {c.emoji} {c.label[lang]}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ 경북 문화공간 지도 ═══════
          참고 사이트(소곳소곳 김포)처럼 카테고리별 핑만 찍은 인터랙티브 지도.
          실제 데이터는 카테고리별로 fetch (cat3 정확 분류) 한 결과를 합쳐서 표시한다. */}
      <section className="px-5 pb-section md:px-10">
        <div className="card overflow-hidden">
          <header className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5 md:px-7 md:pt-7">
            <div>
              <p className="eyebrow">{t('home.mapPaneTitle')}</p>
              <h2 className="mt-1 font-display text-display-sm text-ink md:text-display-md">
                {t('home.categoryTitle')}
              </h2>
            </div>
            <span className="font-mono text-caption text-muted">
              {visiblePins.length} / {Object.values(mapByCat).reduce((a, b) => a + b.length, 0)}
            </span>
          </header>

          <div className="flex flex-wrap gap-2 px-5 pt-4 md:px-7">
            {(['hanok', 'temple', 'seowon', 'experience', 'market', 'attraction'] as CategoryId[]).map((c) => {
              const def = CATEGORIES.find((x) => x.id === c)
              if (!def) return null
              const active = activeMapCats.has(c)
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleMapCat(c)}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors',
                    active
                      ? 'border-ink bg-ink text-canvas'
                      : 'border-hairline-strong bg-card text-body hover:border-ink',
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: def.markerColor }}
                    aria-hidden
                  />
                  <span>{def.emoji} {def.label[lang]}</span>
                  <span
                    className={clsx(
                      'font-mono text-[10px]',
                      active ? 'opacity-70' : 'text-muted-soft',
                    )}
                  >
                    {mapByCat[c]?.length ?? 0}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="relative mt-4 h-80 md:h-[480px]">
            <KakaoMap
              places={visiblePins}
              className="absolute inset-0 h-full w-full !rounded-none !border-0"
            />
          </div>
        </div>
      </section>

      {/* ═══════ COURSE BUILDER ═══════ */}
      <section id="builder" className="border-t border-hairline section-pad bg-canvas">
        <div className="max-w-3xl">
          <p className="eyebrow">{t('home.builderEyebrow')}</p>
          <h2 className="mt-3 section-title">{t('home.builderTitle')}</h2>
          <p className="mt-3 text-body-md text-body max-w-prose">
            {t('home.builderSubtitle')}
          </p>
        </div>

        <div className="mt-10 card-pad space-y-8">
          {/* Known / Hidden 토글 */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex rounded-md border border-hairline-strong bg-card p-0.5">
              <ToggleSeg active={!hiddenMode} onClick={() => setHiddenMode(false)} label={t('home.knownToggle')} />
              <ToggleSeg active={hiddenMode} onClick={() => setHiddenMode(true)} label={t('home.hiddenToggle')} accent />
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-soft">
              {selectedSigungus.length > 0
                ? t('home.builderRegionsHint', { count: selectedSigungus.length })
                : t('home.builderRegionsAny')}
            </span>
          </div>

          {/* Region picker */}
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

          {/* Duration + Profile (2-col on md) */}
          <div className="grid gap-8 md:grid-cols-2">
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
                  <input type="date" className="input" value={range?.start ?? ''} onChange={(e) => setRange({ start: e.target.value, end: range?.end ?? e.target.value })} />
                  <input type="date" className="input" value={range?.end ?? ''} onChange={(e) => setRange({ start: range?.start ?? e.target.value, end: e.target.value })} />
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

          {/* Timeline pills — AI 단계 (generating 중에만 표시) */}
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

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-hairline">
            <span className="font-mono text-caption text-muted">
              {generating ? t('home.builderRunning') : t('home.builderReady')}
            </span>
            <button
              type="button"
              className="btn-download"
              onClick={() => void handleGenerate()}
              disabled={generating}
            >
              {generating ? t('course.generating') : t('home.builderSubmit')}
            </button>
          </div>
        </div>
      </section>

      {/* ═══════ CATEGORIES — feature grid 3-up ═══════ */}
      <section className="border-t border-hairline section-pad">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="eyebrow">{t('home.categoryEyebrow')}</p>
            <h2 className="mt-3 section-title">{t('home.categoryTitle')}</h2>
          </div>
          <Link to="/explore" className="btn-text">{t('home.viewAll')}</Link>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((c) => (
            <Link
              key={c.id}
              to={`/explore?cat=${c.id}`}
              className="card-hover p-6 group flex flex-col h-full"
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl">{c.emoji}</span>
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: c.markerColor }}
                />
              </div>
              <h3 className="mt-6 text-display-sm text-ink">{c.label[lang]}</h3>
              <p className="mt-2 text-body-sm text-body line-clamp-3">
                {t(`categoryDesc.${c.id}`, { defaultValue: t('categoryDesc.fallback') })}
              </p>
              <p className="mt-auto pt-6 text-caption text-muted-soft group-hover:text-ink transition-colors">
                {t('home.viewMore')}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ═══════ FEATURED PLACES ═══════ */}
      {showcasePlaces.length > 0 && (
        <section className="border-t border-hairline section-pad">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <p className="eyebrow">{t('home.featuredEyebrow')}</p>
              <h2 className="mt-3 section-title">{t('home.featuredTitle')}</h2>
            </div>
            <Link to="/explore" className="btn-text">{t('home.viewMore')}</Link>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3 lg:grid-cols-4">
            {showcasePlaces.slice(0, 8).map((p) => (
              <Link
                key={p.id}
                to={`/place/${p.id}`}
                state={{ place: p }}
                className="card-hover overflow-hidden"
              >
                <div className="aspect-[4/3] w-full overflow-hidden">
                  <Thumbnail src={p.thumbnail} alt={p.name} category={p.category} />
                </div>
                <div className="p-5">
                  <CategoryBadge category={p.category} lang={lang} />
                  <h3 className="mt-3 text-display-sm text-ink truncate">{p.name}</h3>
                  <p className="mt-1 text-caption text-muted truncate">{p.address}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ═══════ FESTIVALS ═══════ */}
      {showcaseFestivals.length > 0 && (
        <section className="border-t border-hairline section-pad">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <p className="eyebrow">{t('home.ongoingEyebrow')}</p>
              <h2 className="mt-3 section-title">{t('home.ongoingTitle')}</h2>
            </div>
            <Link to="/festivals" className="btn-text">{t('home.viewMore')}</Link>
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

      {/* ═══════ HIDDEN ═══════ */}
      {hiddenSpots.length > 0 && (
        <section className="border-t border-hairline section-pad">
          <div className="grid gap-8 md:grid-cols-12 md:items-end">
            <div className="md:col-span-7">
              <p className="eyebrow">{t('home.hiddenEyebrow')}</p>
              <h2 className="mt-3 section-title">{t('home.hiddenTitle1')}<br />{t('home.hiddenTitle2')}</h2>
              <p className="mt-4 max-w-md text-body-md text-body">
                {t('home.hiddenSubtitle')}
              </p>
              <button
                type="button"
                onClick={() => { setHiddenMode(true); nav('/explore') }}
                className="btn-secondary mt-6"
              >
                {t('home.hiddenCta')}
              </button>
            </div>
            <div className="md:col-span-5">
              <ul className="grid gap-3">
                {hiddenSpots.slice(0, 4).map((p, i) => (
                  <li key={p.id}>
                    <Link
                      to={`/place/${p.id}`}
                      state={{ place: p }}
                      className="card-hover flex items-center gap-4 p-4"
                    >
                      <span className="font-mono text-eyebrow uppercase text-muted-soft">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-title-sm text-ink truncate">{p.name}</div>
                        <div className="text-caption text-muted truncate">{p.address}</div>
                      </div>
                      <span className="font-mono text-xs text-muted-soft">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* ═══════ CTA BAND ═══════ */}
      <section className="border-t border-hairline">
        <div className="section-pad text-center">
          <h2 className="text-display-lg text-ink">
            {t('home.ctaBandTitle')}
          </h2>
          <p className="mt-3 text-body-md text-body">
            {t('home.ctaBandSubtitle')}
          </p>
          <a href="#builder" className="btn-primary mt-8">
            {t('home.ctaBandButton')}
          </a>
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-body-sm text-muted">{label}</span>
      <span className="flex items-baseline gap-1">
        <span className="font-display text-display-md text-ink" style={{ fontWeight: 400 }}>
          {value}
        </span>
        <span className="text-caption text-muted">{unit}</span>
      </span>
    </div>
  )
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
  // 시군구 기본값(거점 미지정 시) — 관광공사 실제 sigunguCode 기준
  if (profile === 'hidden_gb') return [21, 8] // 청송 · 봉화
  if (profile === 'festival_link') return [11, 3] // 안동 · 고령
  if (profile === 'temple_healing') return [2, 14] // 경주 · 영주
  return [11] // 기본 안동
}

function prettyYmd(ymd: string) {
  if (!ymd || ymd.length !== 8) return ymd
  return `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}.${ymd.slice(6, 8)}`
}

/** 오늘 날짜를 관광공사 YYYYMMDD 형식으로 (로컬 타임존 기준). */
function toYmdLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

/** 오늘(today, YYYYMMDD) 기준 축제 상태 — ongoing / upcoming / ended */
function festivalStatus(
  f: { eventStartDate: string; eventEndDate: string },
  today: string,
): 'ongoing' | 'upcoming' | 'ended' {
  if (f.eventEndDate < today) return 'ended'
  if (f.eventStartDate > today) return 'upcoming'
  return 'ongoing'
}
