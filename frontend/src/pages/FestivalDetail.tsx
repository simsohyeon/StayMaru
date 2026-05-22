import { useEffect, useState } from 'react'
import { useLocation as useRouterLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import TopBar from '@/components/TopBar'
import CategoryBadge from '@/components/CategoryBadge'
import PlaceCard from '@/components/PlaceCard'
import KakaoMap from '@/components/KakaoMap'
import Thumbnail from '@/components/Thumbnail'
import ContactBlock from '@/components/ContactBlock'
import FavoriteStar from '@/components/FavoriteStar'
import ErrorRetry from '@/components/ErrorRetry'
import { useSettings } from '@/stores/settings'
import { useFavorites } from '@/stores/favorites'
import { searchAround, loadDetail, loadFestivalById } from '@/api/tour'
import type { Festival, Place } from '@/types/domain'

type FetchStatus = 'idle' | 'loading' | 'error'

export default function FestivalDetail() {
  const { t } = useTranslation()
  const state = useRouterLocation().state as { festival?: Festival } | null
  const { id: routeId } = useParams<{ id: string }>()
  const lang = useSettings((s) => s.lang)
  const togglefestival = useFavorites((s) => s.togglefestival)
  const [festival, setFestival] = useState<Festival | undefined>(state?.festival)
  const isFav = useFavorites((s) =>
    festival ? s.festivals.some((f) => f.id === festival.id) : false,
  )

  const [nearby, setNearby] = useState<Place[]>([])
  const [bootstrap, setBootstrap] = useState<FetchStatus>(state?.festival ? 'idle' : 'loading')

  useEffect(() => {
    if (festival || !routeId) return
    let cancelled = false
    setBootstrap('loading')
    void loadFestivalById(routeId, lang).then((f) => {
      if (cancelled) return
      if (f) {
        setFestival(f)
        setBootstrap('idle')
      } else {
        setBootstrap('error')
      }
    })
    return () => {
      cancelled = true
    }
  }, [routeId, lang, festival])

  useEffect(() => {
    if (!festival) return
    void loadDetail(festival.id, festival.contentTypeId, lang).then((d) => {
      if (Object.keys(d).length === 0) return
      setFestival((f): Festival | undefined =>
        f ? { ...f, ...d, category: 'festival' } : f,
      )
    })
    void searchAround(festival.position, 10_000, lang).then((res) => {
      const allowed: Place[] = res.filter((p) => p.category !== 'festival')
      setNearby(allowed.slice(0, 8))
    })
  }, [festival?.id, festival?.contentTypeId, lang])

  if (!festival) {
    return (
      <div className="bg-canvas">
        <TopBar back />
        <div className="px-5 py-16 md:px-10 md:py-24">
          {bootstrap === 'loading' ? (
            <p className="text-center font-mono text-caption text-muted">
              {'>'} {t('common.loading')}
            </p>
          ) : (
            <div className="mx-auto max-w-md">
              <ErrorRetry
                message={t('error.festivalNotFound')}
                onRetry={() => {
                  setBootstrap('loading')
                  if (routeId) {
                    void loadFestivalById(routeId, lang).then((f) =>
                      f ? (setFestival(f), setBootstrap('idle')) : setBootstrap('error'),
                    )
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  const today = toYmd(new Date())
  const hasDates = !!(festival.eventStartDate && festival.eventEndDate)
  const status = hasDates ? festivalStatus(festival, today) : ('upcoming' as const)
  const ended = hasDates && status === 'ended'

  return (
    <div className="bg-canvas">
      <TopBar back />

      {/* Hero — 이미지 + 우상단 찜 */}
      <div className="px-5 mt-6 md:px-10 md:mt-10">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-hairline md:max-h-96">
          <Thumbnail src={festival.thumbnail} alt={festival.name} category="festival" />
          <FavoriteStar
            active={isFav}
            disabled={ended}
            overlay
            size="lg"
            className="absolute right-3 top-3"
            onClick={() => togglefestival(festival)}
          />
        </div>
      </div>

      {/* 본문 — 좌(설명·연락처) / 우(지도) 2컬럼. sticky 사용하지 않음. */}
      <div className="px-5 py-8 md:px-10 md:py-12 grid gap-10 md:grid-cols-12">
        <div className="md:col-span-7 space-y-6">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category="festival" lang={lang} />
              {hasDates && <StatusBadge status={status} />}
            </div>
            <h1 className={clsx('mt-4 text-display-lg text-ink', ended && 'text-muted')}>
              {festival.name}
            </h1>
            {hasDates && (
              <p
                className={clsx(
                  'mt-3 font-mono text-body-sm',
                  ended ? 'text-muted' : 'text-primary',
                )}
              >
                {prettyYmd(festival.eventStartDate)} → {prettyYmd(festival.eventEndDate)}
              </p>
            )}
            <p className="mt-1 text-caption text-muted">{festival.address}</p>
          </header>

          {festival.overview && (
            <p className="whitespace-pre-line text-body-md text-body">{festival.overview}</p>
          )}

          <ContactBlock place={festival} />
        </div>

        <div className="md:col-span-5">
          <KakaoMap
            places={[festival, ...nearby]}
            highlightedId={festival.id}
            className="h-64 w-full md:h-[420px]"
          />
        </div>
      </div>

      {/* 근처 장소 — 풀폭 */}
      {nearby.length > 0 && (
        <section className="px-5 pb-section md:px-10">
          <p className="eyebrow">{t('festivals.nearby')}</p>
          <ul className="mt-4 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {nearby.map((p) => (
              <li key={p.id}>
                <PlaceCard place={p} variant="tile" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: 'ongoing' | 'upcoming' | 'ended' }) {
  const { t } = useTranslation()
  const styles =
    status === 'ongoing'
      ? 'bg-emerald-50 text-emerald-800'
      : status === 'upcoming'
        ? 'bg-primary/10 text-primary'
        : 'bg-canvas-soft text-muted'
  const dot =
    status === 'ongoing' ? 'bg-emerald-500' : status === 'upcoming' ? 'bg-primary' : 'bg-muted-soft'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
      {t(`festivals.${status}`)}
    </span>
  )
}

function festivalStatus(f: Festival, today: string): 'ongoing' | 'upcoming' | 'ended' {
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
