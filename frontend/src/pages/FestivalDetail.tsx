import { useEffect, useState } from 'react'
import { useLocation as useRouterLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import TopBar from '@/components/TopBar'
import KhsPageHeader from '@/components/khs/KhsPageHeader'
import CategoryBadge from '@/components/CategoryBadge'
import PlaceCard from '@/components/PlaceCard'
import KakaoMap from '@/components/KakaoMap'
import Thumbnail from '@/components/Thumbnail'
import ContactBlock from '@/components/ContactBlock'
import FavoriteStar from '@/components/FavoriteStar'
import QuietBadge from '@/components/QuietBadge'
import ErrorRetry from '@/components/ErrorRetry'
import { useSettings } from '@/stores/settings'
import { useFavorites } from '@/stores/favorites'
import { searchAround, loadDetail, loadFestivalById, loadRegionImage } from '@/api/tour'
import { downloadFestivalIcs } from '@/lib/ics'
import { SparkleIcon, CalendarIcon, CheckIcon } from '@/components/icons'
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

  // 표준데이터 축제(std-*)는 이미지가 없다 — 주최 시·군의 대표 관광지 사진으로 히어로를 채운다(목록에서 이미 채워졌으면 생략).
  useEffect(() => {
    if (!festival || festival.thumbnail || !festival.sigunguCode) return
    let cancelled = false
    void loadRegionImage(festival.sigunguCode, lang).then((url) => {
      if (cancelled || !url) return
      setFestival((f) => (f && !f.thumbnail ? { ...f, thumbnail: url, thumbnailIsRegion: true } : f))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [festival?.id, festival?.thumbnail, festival?.sigunguCode, lang])

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
    // festival 전체가 아닌 식별자(id·contentTypeId)에만 반응 — festival 은 라우터 state 라 렌더마다 새 참조라서 deps 에 넣으면 무한 재호출된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [festival?.id, festival?.contentTypeId, lang])

  if (!festival) {
    return (
      <div className="page khs-page khs-detail festival-detail__loading-wrap">
        <TopBar back />
        <KhsPageHeader
          title={t('festivals.title')}
          trail={[{ label: t('khs.gnb.festival'), to: '/festivals' }, { label: t('festivals.title') }]}
        />
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
    <div className="page khs-page khs-detail">
      <TopBar back />

      {/* KHS breadcrumb — 홈 › 축제 › 축제명 (모바일 TopBar 는 CSS 로 숨고 이것이 대신한다) */}
      <KhsPageHeader
        title={festival.name}
        trail={[{ label: t('khs.gnb.festival'), to: '/festivals' }, { label: festival.name }]}
        action={
          <FavoriteStar
            active={isFav}
            disabled={ended}
            size="lg"
            className="khs-detail__star"
            onClick={() => togglefestival(festival)}
          />
        }
      />

      <div className="khs-inner khs-detail__inner">
      {/* Hero — 이미지 + 우상단 찜 */}
      <div className="festival-detail__hero">
        <div className="festival-detail__hero-media">
          <Thumbnail src={festival.thumbnail} alt={festival.name} category="festival" />
        </div>
      </div>

      {/* 본문 — 좌(설명·연락처) / 우(지도) 2컬럼. sticky 사용하지 않음. */}
      <div className="page-body festival-detail__body">
        <div className="festival-detail__main">
          <header>
            <h1 className={clsx('festival-detail__title', ended && 'festival-detail__title--ended')}>
              {festival.name}
            </h1>
            {/* 메타 한 줄 — 분류 · 진행 상태 · 기간 · 지역(시군 한적 순위). 장소 상세와 같은 26px 필. */}
            <div className="place-detail__meta">
              <CategoryBadge category="festival" lang={lang} />
              {hasDates && <StatusBadge status={status} />}
              {hasDates && (
                <span className={clsx('meta-pill', ended ? 'meta-pill--muted' : 'meta-pill--soft')}>
                  <CalendarIcon aria-hidden width={12} height={12} />
                  {prettyYmd(festival.eventStartDate)} ~ {prettyYmd(festival.eventEndDate)}
                </span>
              )}
              <QuietBadge sigunguCode={festival.sigunguCode} />
            </div>
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
  const Icon = status === 'ongoing' ? SparkleIcon : status === 'upcoming' ? CalendarIcon : CheckIcon
  return (
    <span className={clsx('status-badge', styles)}>
      <Icon className="status-icon" aria-hidden />
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
