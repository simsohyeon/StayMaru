import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import TopBar from '@/components/TopBar'
import CategoryBadge from '@/components/CategoryBadge'
import KakaoMap from '@/components/KakaoMap'
import FestivalCalendar from '@/components/FestivalCalendar'
import Thumbnail from '@/components/Thumbnail'
import ErrorRetry from '@/components/ErrorRetry'
import { SkeletonGrid } from '@/components/Skeleton'
import { useSettings } from '@/stores/settings'
import { useFavorites } from '@/stores/favorites'
import { searchFestivals } from '@/api/tour'
import type { Festival } from '@/types/domain'

type Filter = 'all' | 'ongoing' | 'upcoming' | 'ended'
type Status = 'ongoing' | 'upcoming' | 'ended'

export default function Festivals() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const lang = useSettings((s) => s.lang)
  const togglefestival = useFavorites((s) => s.togglefestival)
  const favFestivals = useFavorites((s) => s.festivals)
  const favIds = useMemo(() => new Set(favFestivals.map((f) => f.id)), [favFestivals])

  const [filter, setFilter] = useState<Filter>('all')
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

  const filtered = useMemo(() => {
    if (filter === 'all') return sorted
    return sorted.filter((f) => festivalStatus(f, today) === filter)
  }, [sorted, filter, today])

  return (
    <div className="page">
      <TopBar
        title={t('festivals.title')}
        right={
          <div className="festivals__view-toggle">
            {(['list', 'calendar', 'map'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={clsx(
                  'festivals__view-btn',
                  view === v ? 'festivals__view-btn--active' : 'festivals__view-btn--idle',
                )}
              >
                {t(`festivals.view.${v}`)}
              </button>
            ))}
          </div>
        }
      />

      <div className="page-body festivals__stack">
        <div className="chip-row">
          {(['all', 'ongoing', 'upcoming', 'ended'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={clsx('chip', filter === f && 'chip-active')}
            >
              {f === 'all' ? t('festivals.all') : t(`festivals.${f}`)}
            </button>
          ))}
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
            {filter !== 'all' && (
              <button type="button" className="btn-secondary festivals__empty-btn" onClick={() => setFilter('all')}>
                {t('festivals.all')}
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
                    <button
                      type="button"
                      aria-label={favIds.has(f.id) ? t('place.unfavorite') : t('place.favorite')}
                      aria-pressed={favIds.has(f.id)}
                      onClick={(e) => {
                        e.stopPropagation()
                        togglefestival(f)
                      }}
                      className={clsx(
                        'festivals__fav',
                        favIds.has(f.id)
                          ? 'festivals__fav--active'
                          : 'festivals__fav--idle',
                      )}
                    >
                      {favIds.has(f.id) ? '★' : '☆'}
                    </button>
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
                      {prettyYmd(f.eventStartDate)} → {prettyYmd(f.eventEndDate)}
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
  )
}

function StatusBadge({ status }: { status: Status }) {
  const { t } = useTranslation()
  const styles: Record<Status, string> = {
    ongoing: 'status-badge--ongoing',
    upcoming: 'status-badge--upcoming',
    ended: 'status-badge--ended',
  }
  const dots: Record<Status, string> = {
    ongoing: 'status-dot--ongoing',
    upcoming: 'status-dot--upcoming',
    ended: 'status-dot--ended',
  }
  return (
    <span className={clsx('status-badge', styles[status])}>
      <span className={clsx('status-dot', dots[status])} aria-hidden />
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
