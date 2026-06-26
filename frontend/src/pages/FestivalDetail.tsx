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
import { downloadFestivalIcs } from '@/lib/ics'
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
    async function run() {
      setBootstrap('loading')
      const f = await loadFestivalById(routeId!, lang)
      if (cancelled) return
      if (f) {
        setFestival(f)
        setBootstrap('idle')
      } else {
        setBootstrap('error')
      }
    }
    void run()
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
      <div className="festival-detail__loading-wrap">
        <TopBar back />
        <div className="festival-detail__loading-pad">
          {bootstrap === 'loading' ? (
            <p className="festival-detail__loading-text">
              {'>'} {t('common.loading')}
            </p>
          ) : (
            <div className="festival-detail__error-wrap">
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
    <div className="page">
      <TopBar back />

      {/* Hero — 이미지 + 우상단 찜 */}
      <div className="festival-detail__hero">
        <div className="festival-detail__hero-media">
          <Thumbnail src={festival.thumbnail} alt={festival.name} category="festival" />
          <FavoriteStar
            active={isFav}
            disabled={ended}
            overlay
            size="lg"
            className="festival-detail__hero-star"
            onClick={() => togglefestival(festival)}
          />
        </div>
      </div>

      {/* 본문 — 좌(설명·연락처) / 우(지도) 2컬럼. sticky 사용하지 않음. */}
      <div className="page-body festival-detail__body">
        <div className="festival-detail__main">
          <header>
            <div className="festival-detail__badges">
              <CategoryBadge category="festival" lang={lang} />
              {hasDates && <StatusBadge status={status} />}
            </div>
            <h1 className={clsx('festival-detail__title', ended && 'festival-detail__title--ended')}>
              {festival.name}
            </h1>
            {hasDates && (
              <p
                className={clsx(
                  'festival-detail__dates',
                  ended ? 'festival-detail__dates--ended' : 'festival-detail__dates--active',
                )}
              >
                {prettyYmd(festival.eventStartDate)} → {prettyYmd(festival.eventEndDate)}
              </p>
            )}
            <p className="festival-detail__address">{festival.address}</p>
            {hasDates && !ended && (
              <button
                type="button"
                onClick={() => downloadFestivalIcs(festival)}
                className="festival-detail__ics-btn"
              >
                ＋ {t('place.addToCalendar')}
              </button>
            )}
          </header>

          {festival.overview && (
            <p className="festival-detail__overview">{festival.overview}</p>
          )}

          <ContactBlock place={festival} />
        </div>

        <div className="festival-detail__aside">
          <KakaoMap
            places={[festival, ...nearby]}
            highlightedId={festival.id}
            className="festival-detail__map"
          />
        </div>
      </div>

      {/* 근처 장소 — 풀폭 */}
      {nearby.length > 0 && (
        <section className="festival-detail__nearby">
          <p className="eyebrow">{t('festivals.nearby')}</p>
          <ul className="festival-detail__nearby-grid">
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
      ? 'status-badge--ongoing'
      : status === 'upcoming'
        ? 'status-badge--upcoming'
        : 'status-badge--ended'
  const dot =
    status === 'ongoing' ? 'status-dot--ongoing' : status === 'upcoming' ? 'status-dot--upcoming' : 'status-dot--ended'
  return (
    <span className={clsx('status-badge', styles)}>
      <span className={clsx('status-dot', dot)} aria-hidden />
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
