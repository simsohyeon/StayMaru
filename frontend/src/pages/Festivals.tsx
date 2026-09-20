import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import TopBar from '@/components/TopBar'
import KhsPageHeader from '@/components/khs/KhsPageHeader'
import CategoryBadge from '@/components/CategoryBadge'
import KakaoMap from '@/components/KakaoMap'
import FestivalCalendar from '@/components/FestivalCalendar'
import Thumbnail from '@/components/Thumbnail'
import FavoriteStar from '@/components/FavoriteStar'
import ErrorRetry from '@/components/ErrorRetry'
import { SkeletonGrid } from '@/components/Skeleton'
import { useSettings } from '@/stores/settings'
import { useFavorites } from '@/stores/favorites'
import { searchFestivals } from '@/api/tour'
import { SparkleIcon, CalendarIcon, CheckIcon, StarIcon } from '@/components/icons'
import { SIGUNGUS } from '@/constants/sigungu'
import type { Festival } from '@/types/domain'

type Filter = 'all' | 'ongoing' | 'upcoming' | 'ended'
type Status = 'ongoing' | 'upcoming' | 'ended'
type FestSort = 'start' | 'name'

export default function Festivals() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const lang = useSettings((s) => s.lang)
  const togglefestival = useFavorites((s) => s.togglefestival)
  const favFestivals = useFavorites((s) => s.festivals)
  const favIds = useMemo(() => new Set(favFestivals.map((f) => f.id)), [favFestivals])

  const [filter, setFilter] = useState<Filter>('all')
  // 조건 바(F1) — 지역 · 정렬 · 찜한 축제만. 기간(월)은 캘린더 보기와 겹쳐 두지 않는다.
  const [sigunguCode, setSigunguCode] = useState<number | undefined>(undefined)
  const [sort, setSort] = useState<FestSort>('start')
  const [favOnly, setFavOnly] = useState(false)
  const [view, setView] = useState<'list' | 'map' | 'calendar'>('list')
  const [items, setItems] = useState<Festival[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [retryTick, setRetryTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setFetchError(false)
      try {
        // 사진: TourAPI 행사 풀 매칭 → 없으면 주최 시·군 대표 사진(searchFestivals 안에서 처리).
        const res = await searchFestivals(lang)
        if (cancelled) return
        setItems(res)
        // 빈 배열이고 네트워크가 끊긴 경우는 fetchError 로 표시
        if (res.length === 0 && typeof navigator !== 'undefined' && !navigator.onLine) {
          setFetchError(true)
        }
      } catch {
        if (!cancelled) setFetchError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [lang, retryTick])

  // 진행중 → 예정 → 종료 순으로 정렬해두면 필터 'all' 일 때도 자연스럽다.
  const today = toYmd(new Date())
  const sorted = useMemo(() => {
    const order = (s: Status) => (s === 'ongoing' ? 0 : s === 'upcoming' ? 1 : 2)
    return [...items].sort((a, b) => {
      const sa = festivalStatus(a, today)
      const sb = festivalStatus(b, today)
      const d = order(sa) - order(sb)
      if (d !== 0) return d
      if (sa === 'ended') return b.eventEndDate.localeCompare(a.eventEndDate)
      return a.eventStartDate.localeCompare(b.eventStartDate)
    })
  }, [items, today])

  // 상태 필터 — '전체'는 현재+예정만(종료된 축제가 다수라 목록을 채우는 걸 막는다. '종료' 탭에서만 과거 확인).
  const byStatus = useMemo(() => {
    if (filter === 'all') return sorted.filter((f) => festivalStatus(f, today) !== 'ended')
    return sorted.filter((f) => festivalStatus(f, today) === filter)
  }, [sorted, filter, today])

  // 상태 탭 건수 — 클라이언트 계산(전체 목록이 이미 있다).
  const statusCounts = useMemo(() => {
    const c = { all: 0, ongoing: 0, upcoming: 0, ended: 0 }
    for (const f of sorted) {
      const s = festivalStatus(f, today)
      c[s] += 1
      if (s !== 'ended') c.all += 1
    }
    return c
  }, [sorted, today])

  // 지역 탭 — 현재 상태 필터 안에서 축제가 있는 시군만(건수 포함). 22개를 다 늘어놓지 않는다.
  const regionCounts = useMemo(() => {
    const m = new Map<number, number>()
    for (const f of byStatus) if (f.sigunguCode) m.set(f.sigunguCode, (m.get(f.sigunguCode) ?? 0) + 1)
    return m
  }, [byStatus])
  const regionTabs = useMemo(
    () => SIGUNGUS.filter((sg) => regionCounts.has(sg.code) || sg.code === sigunguCode),
    [regionCounts, sigunguCode],
  )

  const filtered = useMemo(() => {
    let list = byStatus
    if (sigunguCode) list = list.filter((f) => f.sigunguCode === sigunguCode)
    if (favOnly) list = list.filter((f) => favIds.has(f.id))
    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name, lang))
    return list
  }, [byStatus, sigunguCode, favOnly, sort, favIds, lang])

  return (
    <div className="page khs-page">
      <TopBar title={t('festivals.title')} />

      <KhsPageHeader
        title={t('festivals.title')}
        trail={[{ label: t('khs.gnb.festival') }, { label: t('festivals.title') }]}
      />

      <div className="page-body festivals__stack khs-page__body khs-page__body--single explore--tabs">
        {/* ── 조건 바 (F1) — 탐색 화면(C1-b)과 같은 문법: 1행 상태 탭(건수) · 2행 지역 탭(건수) + 우측 정렬/찜 텍스트 컨트롤 ── */}
        <div className="explore__bars">
          <div className="explore__bar">
            <span className="explore__bar-label">{t('khs.status')}</span>
            <div className="explore__tabs" role="tablist">
              {(['all', 'ongoing', 'upcoming', 'ended'] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => {
                    setFilter(f)
                    setSigunguCode(undefined)
                  }}
                  className={clsx('explore__tab', filter === f && 'explore__tab--active')}
                >
                  {f === 'all' ? t('festivals.all') : t(`festivals.${f}`)}
                  {!loading && <span className="explore__tab-count">{statusCounts[f]}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="explore__bar explore__bar--split">
            <div className="explore__bar-main">
              <span className="explore__bar-label">{t('khs.home.region')}</span>
              <div className="explore__tabs">
                <button
                  type="button"
                  onClick={() => setSigunguCode(undefined)}
                  className={clsx('explore__tab explore__tab--sm', !sigunguCode && 'explore__tab--region-active')}
                >
                  {t('explore.categoryAll')}
                  {!loading && <span className="explore__tab-count">{byStatus.length}</span>}
                </button>
                {regionTabs.map((sg) => (
                  <button
                    key={sg.code}
                    type="button"
                    onClick={() => setSigunguCode(sigunguCode === sg.code ? undefined : sg.code)}
                    className={clsx('explore__tab explore__tab--sm', sigunguCode === sg.code && 'explore__tab--region-active')}
                  >
                    {sg[lang as 'ko' | 'en' | 'ja' | 'zh']}
                    <span className="explore__tab-count">{regionCounts.get(sg.code) ?? 0}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="explore__textctls">
              <label className="explore__textctl">
                <span className="explore__textctl-label">{t('explore.sortLabel')}</span>
                <select
                  className="explore__textctl-select"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as FestSort)}
                >
                  <option value="start">{t('festivals.sortStart')}</option>
                  <option value="name">{t('festivals.sortName')}</option>
                </select>
              </label>
              <span className="explore__textctl-divider" aria-hidden />
              <button
                type="button"
                onClick={() => setFavOnly((v) => !v)}
                aria-pressed={favOnly}
                className={clsx('explore__textctl explore__textctl--toggle', favOnly && 'explore__textctl--on')}
              >
                <StarIcon aria-hidden filled={favOnly} width={13} height={13} /> {t('festivals.favOnly')}
              </button>
            </div>
          </div>
        </div>

        {/* 결과 컬럼 — 결과 헤더(건수 + 보기) · 목록/캘린더/지도 */}
        <div className="khs-result-col">
        <div className="khs-result-head">
          <span className="khs-result-count">
            {loading ? '' : t('khs.resultCount', { n: filtered.length })}
          </span>
          <div className="festivals__view-toggle">
            {(['list', 'calendar', 'map'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={clsx(
                  'festivals__view-btn',
                  view === v ? 'festivals__view-btn--active' : 'festivals__view-btn--idle',
                )}
              >
                {t(`festivals.view.${v}`)}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <SkeletonGrid count={6} cols="festival" />
        ) : fetchError ? (
          <ErrorRetry message={t('error.apiFailed')} onRetry={() => setRetryTick((n) => n + 1)} />
        ) : view === 'map' ? (
          <KakaoMap places={filtered} className="festivals__map" />
        ) : view === 'calendar' ? (
          <FestivalCalendar festivals={filtered} />
        ) : filtered.length === 0 ? (
          <div className="festivals__empty">
            <p className="festivals__empty-title">{t('explore.empty')}</p>
            <p className="festivals__empty-hint">{t('explore.emptyHint')}</p>
            {(filter !== 'all' || sigunguCode || favOnly) && (
              <button
                type="button"
                className="btn-secondary festivals__empty-btn"
                onClick={() => {
                  setFilter('all')
                  setSigunguCode(undefined)
                  setFavOnly(false)
                }}
              >
                {t('explore.clearFilters')}
              </button>
            )}
          </div>
        ) : (
          <ul className="festivals__grid">
            {filtered.map((f) => {
              const status = festivalStatus(f, today)
              const ended = status === 'ended'
              return (
                <li
                  key={f.id}
                  role="button"
                  tabIndex={0}
                  aria-label={f.name}
                  className={clsx(
                    'festivals__card',
                    ended && 'festivals__card--ended',
                  )}
                  onClick={() => nav(`/festivals/${f.id}`, { state: { festival: f } })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      nav(`/festivals/${f.id}`, { state: { festival: f } })
                    }
                  }}
                >
                  <div className="festivals__card-media">
                    <Thumbnail src={f.thumbnail} alt={f.name} category="festival" />
                    <FavoriteStar
                      active={favIds.has(f.id)}
                      disabled={ended}
                      overlay
                      className="festivals__fav"
                      onClick={(e) => {
                        e.stopPropagation()
                        togglefestival(f)
                      }}
                    />
                  </div>
                  <div className="festivals__card-body">
                    <div className="festivals__card-badges">
                      <CategoryBadge category="festival" lang={lang} />
                      <StatusBadge status={status} />
                    </div>
                    <h3 className="card-title festivals__card-title">{f.name}</h3>
                    <p
                      className={clsx(
                        'festivals__card-dates',
                        ended ? 'festivals__card-dates--ended' : 'festivals__card-dates--active',
                      )}
                    >
                      {prettyYmd(f.eventStartDate)} ~ {prettyYmd(f.eventEndDate)}
                    </p>
                    <p className="festivals__card-address">{f.address}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        </div>
      </div>
    </div>
  )
}

const STATUS_STYLES: Record<Status, string> = {
  ongoing: 'status-badge--ongoing',
  upcoming: 'status-badge--upcoming',
  ended: 'status-badge--ended',
}
const STATUS_ICONS: Record<Status, ComponentType<SVGProps<SVGSVGElement>>> = {
  ongoing: SparkleIcon,
  upcoming: CalendarIcon,
  ended: CheckIcon,
}

function StatusBadge({ status }: { status: Status }) {
  const { t } = useTranslation()
  const Icon = STATUS_ICONS[status]
  return (
    <span className={clsx('status-badge', STATUS_STYLES[status])}>
      <Icon className="status-icon" aria-hidden />
      {t(`festivals.${status}`)}
    </span>
  )
}

function festivalStatus(f: Festival, today: string): Status {
  if (f.eventEndDate < today) return 'ended'
  if (f.eventStartDate > today) return 'upcoming'
  return 'ongoing'
}

function toYmd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function prettyYmd(ymd: string) {
  if (!ymd || ymd.length !== 8) return ymd
  return `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}.${ymd.slice(6, 8)}`
}
