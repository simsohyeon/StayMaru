import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import TopBar from '@/components/TopBar'
import CategoryBadge from '@/components/CategoryBadge'
import KakaoMap from '@/components/KakaoMap'
import Thumbnail from '@/components/Thumbnail'
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
  const [mapMode, setMapMode] = useState(false)
  const [items, setItems] = useState<Festival[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void searchFestivals(lang).then((res) => {
      if (cancelled) return
      setItems(res)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [lang])

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
    <div className="bg-canvas">
      <TopBar
        title={t('festivals.title')}
        right={
          <button
            type="button"
            onClick={() => setMapMode((v) => !v)}
            className="font-mono text-xs text-muted hover:text-ink"
          >
            {mapMode ? t('festivals.listMode') : t('festivals.mapMode')}
          </button>
        }
      />

      <div className="space-y-6 px-5 py-8 md:px-10 md:py-12">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
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

        {mapMode ? (
          <KakaoMap places={filtered} className="h-[60vh] w-full" />
        ) : loading ? (
          <p className="py-16 text-center font-mono text-caption text-muted">{'>'} {t('course.generating')}</p>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-body-md text-muted">{t('explore.empty')}</p>
        ) : (
          <ul className="space-y-4 md:grid md:grid-cols-2 md:gap-5 md:space-y-0 lg:grid-cols-3">
            {filtered.map((f) => {
              const status = festivalStatus(f, today)
              const ended = status === 'ended'
              return (
                <li
                  key={f.id}
                  className={clsx(
                    'card-hover overflow-hidden cursor-pointer relative flex flex-col',
                    ended && 'opacity-60 grayscale',
                  )}
                  onClick={() => nav(`/festivals/${f.id}`, { state: { festival: f } })}
                >
                  <div className="relative aspect-[16/9] w-full overflow-hidden">
                    <Thumbnail src={f.thumbnail} alt={f.name} category="festival" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        togglefestival(f)
                      }}
                      className={clsx(
                        'absolute right-3 top-3 h-8 w-8 rounded-md text-sm',
                        favIds.has(f.id)
                          ? 'bg-primary text-on-primary'
                          : 'bg-card text-ink border border-hairline-strong',
                      )}
                    >
                      {favIds.has(f.id) ? '★' : '☆'}
                    </button>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center gap-2">
                      <CategoryBadge category="festival" lang={lang} />
                      <StatusBadge status={status} />
                    </div>
                    <h3 className="mt-3 text-display-sm text-ink truncate">{f.name}</h3>
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
    ongoing: 'bg-emerald-50 text-emerald-800',
    upcoming: 'bg-primary/10 text-primary',
    ended: 'bg-canvas-soft text-muted',
  }
  const dots: Record<Status, string> = {
    ongoing: 'bg-emerald-500',
    upcoming: 'bg-primary',
    ended: 'bg-muted-soft',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dots[status]}`} aria-hidden />
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
