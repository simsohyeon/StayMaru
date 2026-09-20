import { useEffect, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import TopBar from '@/components/TopBar'
import KhsPageHeader from '@/components/khs/KhsPageHeader'
import CategoryBadge from '@/components/CategoryBadge'
import KakaoMap from '@/components/KakaoMap'
import Thumbnail from '@/components/Thumbnail'
import ContactBlock from '@/components/ContactBlock'
import FavoriteStar from '@/components/FavoriteStar'
import PlaceCard from '@/components/PlaceCard'
import ErrorRetry from '@/components/ErrorRetry'
import HeritageBadge from '@/components/HeritageBadge'
import QuietBadge from '@/components/QuietBadge'
import TempleManners from '@/components/TempleManners'
import HanokGlossary from '@/components/HanokGlossary'
import KeeperCard from '@/components/KeeperCard'
import RelatedSpots from '@/components/RelatedSpots'
import { useSettings } from '@/stores/settings'
import { useFavorites } from '@/stores/favorites'
import { usePopularity } from '@/stores/popularity'
import { loadAccessibilityDetail, loadDetail, loadPlaceById, searchAround } from '@/api/tour'
import { shareOrCopy, toastForShareResult } from '@/lib/share'
import { addPlaceToCourse } from '@/lib/courseActions'
import { useToasts } from '@/stores/toasts'
import { useToggleFavorite } from '@/lib/useFavoriteAction'
import { useFocusTrap } from '@/lib/useFocusTrap'
import {
  PinIcon,
  ExploreIcon,
  AccessibleIcon,
  StrollerIcon,
  PawIcon,
  CardIcon,
  CloseIcon,
} from '@/components/icons'
import type { AccessibilityTour, Place } from '@/types/domain'

type FetchStatus = 'idle' | 'loading' | 'error'

/** 상세에 보여줄 무장애여행정보 필드 — 이동·이용에 직접 영향이 큰 순. */
const A11Y_TOUR_FIELDS = [
  'parking', 'route', 'exit', 'elevator', 'restroom',
  'guidehuman', 'audioguide', 'braileblock', 'stroller', 'helpdog',
] as const satisfies readonly (keyof AccessibilityTour)[]

/** accessibility 병합 — undefined 로 기존 true 를 덮지 않는다. */
function mergeAccessibility(
  a?: Place['accessibility'],
  b?: Place['accessibility'],
): Place['accessibility'] {
  const out: NonNullable<Place['accessibility']> = { ...(a ?? {}) }
  for (const [k, v] of Object.entries(b ?? {})) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export default function PlaceDetail() {
  const { t } = useTranslation()
  const state = useLocation().state as { place?: Place } | null
  const { id: routeId } = useParams<{ id: string }>()
  const lang = useSettings((s) => s.lang)
  const { togglePlace } = useToggleFavorite()
  const pushToast = useToasts((s) => s.show)
  const [place, setPlace] = useState<Place | undefined>(state?.place)
  const isFav = useFavorites((s) =>
    place ? s.places.some((p) => p.id === place.id) : false,
  )
  const [nearby, setNearby] = useState<Place[]>([])
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  // 히어로 사진 캐러셀 — detailImage2 이미지들을 ‹ › 버튼으로 넘긴다(가로 스크롤 없음).
  const [heroIdx, setHeroIdx] = useState(0)
  const lightboxCloseRef = useRef<HTMLButtonElement>(null)
  const lightboxRef = useRef<HTMLDivElement>(null)
  const [bootstrap, setBootstrap] = useState<FetchStatus>(state?.place ? 'idle' : 'loading')

  // state 없이 직접 진입(공유/북마크) — id 만으로 detailCommon2 호출해 기본 정보 구성.
  useEffect(() => {
    if (place || !routeId) return
    let cancelled = false
    async function run() {
      setBootstrap('loading')
      const p = await loadPlaceById(routeId!, lang)
      if (cancelled) return
      if (p) {
        setPlace(p)
        setBootstrap('idle')
      } else {
        setBootstrap('error')
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [routeId, lang, place])

  // 라우터 state 로 들어오는 경우가 일반적. id 만 있고 state 가 없으면 (북마크/공유 링크 등)
  // 상세 API 만으로 표시할 수 있는 최소 정보를 채운다. (이전엔 mock 폴백을 썼지만 제거됨)

  useEffect(() => {
    if (!place) return
    void loadDetail(place.id, place.contentTypeId, lang).then((detail) => {
      if (Object.keys(detail).length === 0) return
      // accessibility 는 얕은 spread 로 덮으면 무장애 검색에서 온 wheelchair=true 가 detailIntro2 의
      // undefined 에 밀려 사라진다 → 값이 있는 필드만 병합.
      setPlace((p) =>
        p ? { ...p, ...detail, accessibility: mergeAccessibility(p.accessibility, detail.accessibility) } : p,
      )
    })
    // 무장애 등록 장소(wheelchair) — KorWithService2/detailWithTour2 의 정식 무장애 정보(주차·경로·화장실…)를 채운다.
    if (place.accessibility?.wheelchair && !place.accessibility.tour) {
      void loadAccessibilityDetail(place.id, lang).then((tour) => {
        if (Object.keys(tour).length === 0) return
        setPlace((p) => (p ? { ...p, accessibility: { ...(p.accessibility ?? {}), tour } } : p))
      })
    }
    // 주변 명소 — 5km 반경. 자기 자신 제외 후 8개. (FestivalDetail 의 패턴과 동일)
    if (place.position.lat && place.position.lng) {
      void searchAround(place.position, 5_000, lang).then((res) => {
        setNearby(res.filter((p) => p.id !== place.id).slice(0, 8))
      })
    }
    // place 전체가 아닌 식별자(id·contentTypeId)에만 반응 — place 는 라우터 state 라 렌더마다 새 참조라서 deps 에 넣으면 무한 재호출된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.id, place?.contentTypeId, lang])

  // 인기/트렌드 위젯용 — PlaceDetail 진입 시 1회 카운트.
  // place.id 변경 시에만 trigger 되어, 같은 장소 내 렌더에서는 중복 카운트 안 됨.
  useEffect(() => {
    if (place) usePopularity.getState().track(place)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.id])

  // 라이트박스 — ESC 닫기 + 좌우 화살표 네비
  useEffect(() => {
    if (lightboxIdx === null) return
    const onKey = (e: KeyboardEvent) => {
      const imgs = place?.images ?? []
      if (e.key === 'Escape') setLightboxIdx(null)
      else if (e.key === 'ArrowRight') setLightboxIdx((i) => (i === null ? null : (i + 1) % imgs.length))
      else if (e.key === 'ArrowLeft')
        setLightboxIdx((i) => (i === null ? null : (i - 1 + imgs.length) % imgs.length))
    }
    window.addEventListener('keydown', onKey)
    // body scroll lock
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // 포커스 이동(닫기 버튼) + 닫힐 때 직전 포커스 복원 — 키보드/스크린리더 접근성.
    const prevFocus = document.activeElement as HTMLElement | null
    lightboxCloseRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      prevFocus?.focus?.()
    }
  }, [lightboxIdx, place?.images])

  // 라이트박스 열림 동안 Tab 순환을 다이얼로그 안에 가둔다.
  useFocusTrap(lightboxRef, lightboxIdx !== null)

  if (!place) {
    return (
      <div className="page khs-page khs-detail place-detail__notfound">
        <TopBar back />
        <KhsPageHeader
          title={t('explore.title')}
          trail={[{ label: t('khs.gnb.explore'), to: '/explore' }, { label: t('explore.title') }]}
        />
        <div className="place-detail__notfound-body">
          {bootstrap === 'loading' ? (
            <p className="place-detail__notfound-loading">
              {'>'} {t('common.loading')}
            </p>
          ) : (
            <div className="place-detail__notfound-error">
              <ErrorRetry
                message={t('error.placeNotFound')}
                onRetry={() => {
                  setBootstrap('loading')
                  if (routeId) {
                    void loadPlaceById(routeId, lang).then((p) =>
                      p ? (setPlace(p), setBootstrap('idle')) : setBootstrap('error'),
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

  // 히어로에 돌릴 사진 — detailImage2 목록(2장 이상)이 있으면 그것, 아니면 대표 사진 한 장.
  const heroImages: string[] =
    place.images && place.images.length > 1 ? place.images : place.thumbnail ? [place.thumbnail] : []
  const safeHeroIdx = Math.min(heroIdx, Math.max(0, heroImages.length - 1))

  return (
    <div className="page khs-page khs-detail">
      <TopBar back />

      {/* KHS breadcrumb — 홈 › 탐색 서비스 › 장소명. 찜 별은 제목 바로 옆(히어로 위 오버레이보다 직관적). */}
      <KhsPageHeader
        title={place.name}
        trail={[{ label: t('khs.gnb.explore'), to: '/explore' }, { label: place.name }]}
        action={
          <FavoriteStar
            active={isFav}
            size="lg"
            className="khs-detail__star"
            onClick={() => togglePlace(place)}
          />
        }
      />

      <div className="khs-inner khs-detail__inner">
      {/* 히어로 — 사진이 여러 장이면 ‹ › 로 넘기고, 클릭하면 라이트박스. */}
      <div className="place-detail__hero-wrap">
        <div className="place-detail__hero">
          {heroImages.length > 1 ? (
            <button
              type="button"
              className="place-detail__hero-img-btn"
              onClick={() => setLightboxIdx(safeHeroIdx)}
              aria-label={`${place.name} ${safeHeroIdx + 1} / ${heroImages.length}`}
            >
              <Thumbnail
                key={heroImages[safeHeroIdx]}
                src={heroImages[safeHeroIdx]}
                alt={`${place.name} ${safeHeroIdx + 1}`}
                category={place.category}
              />
            </button>
          ) : (
            <Thumbnail src={place.thumbnail} alt={place.name} category={place.category} />
          )}
          {heroImages.length > 1 && (
            <>
              <button
                type="button"
                className="place-detail__hero-nav place-detail__hero-nav--prev"
                aria-label={t('common.back')}
                onClick={() => setHeroIdx((i) => (i - 1 + heroImages.length) % heroImages.length)}
              >
                ‹
              </button>
              <button
                type="button"
                className="place-detail__hero-nav place-detail__hero-nav--next"
                aria-label={t('common.next')}
                onClick={() => setHeroIdx((i) => (i + 1) % heroImages.length)}
              >
                ›
              </button>
              <span className="place-detail__hero-count">
                {safeHeroIdx + 1} / {heroImages.length}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="page-body place-detail__body">
        <div className="place-detail__main">
          <header>
            <h1 className="place-detail__title">{place.name}</h1>
            {/* 메타 한 줄 — 분류 · 지역(시군 한적 순위) · 문화재(수동 매핑 22곳만) · 숨은 보석. 모두 같은 26px 필. */}
            <div className="place-detail__meta">
              <CategoryBadge category={place.category} lang={lang} />
              <QuietBadge sigunguCode={place.sigunguCode} />
              <HeritageBadge placeName={place.name} lang={lang} variant="pill" />
            </div>
          </header>

          {/* 장소 설명 — API 응답의 overview 만 표시 (정적 폴백 X) */}
          {place.overview && (
            <p className="place-detail__overview">{place.overview}</p>
          )}

          <KeeperCard placeName={place.name} />

          <div className="place-detail__actions">
            <button
              type="button"
              onClick={() => {
                const r = addPlaceToCourse(place)
                pushToast(
                  t(
                    r === 'duplicate'
                      ? 'course.alreadyInCourse'
                      : r === 'created'
                        ? 'course.startedCourse'
                        : 'course.addedToCourse',
                  ),
                  { type: r === 'duplicate' ? 'info' : 'success' },
                )
              }}
              className="btn-download"
            >
              <PinIcon aria-hidden width={14} height={14} /> {t('course.addToCourse')}
            </button>
            <a
              href={`https://map.kakao.com/link/to/${encodeURIComponent(place.name)},${place.position.lat},${place.position.lng}`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
            >
              <ExploreIcon aria-hidden width={14} height={14} /> {t('place.directions')}
            </a>
            <button
              type="button"
              onClick={async () => {
                const url = `${location.origin}/place/${place.id}`
                const r = await shareOrCopy({
                  title: place.name,
                  text: place.address || place.overview?.slice(0, 80),
                  url,
                  imageUrl: place.thumbnail,
                })
                toastForShareResult(r, t, pushToast)
              }}
              className="place-detail__share-btn"
            >
              ↗ {t('place.share')}
            </button>
          </div>

          <ContactBlock place={place} />

          {(place.category === 'temple' || place.category === 'templestay') && (
            <TempleManners />
          )}

          {place.category === 'hanok' && <HanokGlossary />}

          {place.accessibility &&
            (Object.values(place.accessibility).some((v) => v === true) ||
              Object.keys(place.accessibility.tour ?? {}).length > 0) && (
              <section className="place-detail__a11y">
                <h3 className="eyebrow place-detail__a11y-title">{t('place.accessibilityTitle')}</h3>
                <ul className="place-detail__a11y-list">
                  {place.accessibility.wheelchair && (
                    <li className="badge-soft"><AccessibleIcon aria-hidden width={13} height={13} /> {t('place.a11yWheelchair')}</li>
                  )}
                  {place.accessibility.babyStroller && (
                    <li className="badge-soft"><StrollerIcon aria-hidden width={13} height={13} /> {t('place.a11yBabyStroller')}</li>
                  )}
                  {place.accessibility.pet && (
                    <li className="badge-soft"><PawIcon aria-hidden width={13} height={13} /> {t('place.a11yPet')}</li>
                  )}
                  {place.accessibility.creditCard && (
                    <li className="badge-soft"><CardIcon aria-hidden width={13} height={13} /> {t('place.a11yCreditCard')}</li>
                  )}
                </ul>
                {/* 무장애여행정보(자유 텍스트) — 등록된 항목만 */}
                {place.accessibility.tour && (
                  <dl className="place-detail__a11y-tour">
                    {A11Y_TOUR_FIELDS.filter((k) => place.accessibility?.tour?.[k]).map((k) => (
                      <div key={k} className="place-detail__a11y-tour-row">
                        <dt>{t(`place.a11yTour.${k}`)}</dt>
                        <dd>{place.accessibility!.tour![k]}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>
            )}
        </div>

        <aside className="place-detail__aside">
          <KakaoMap places={[place]} className="place-detail__map" />
        </aside>
      </div>

      {/* 빅데이터 연관 추천 — "이 곳을 찾은 여행자가 함께 본 관광지" (TarRlteService1).
          데이터 없을 땐 자동으로 숨겨진다. */}
      <section className="place-detail__related">
        <RelatedSpots keyword={place.name} sigunguCode={place.sigunguCode} limit={8} />
      </section>

      {/* 주변 명소 — 5km 반경, 자기 자신 제외 8개. */}
      {nearby.length > 0 && (
        <section className="place-detail__nearby">
          <p className="eyebrow">{t('place.nearby')}</p>
          <p className="place-detail__nearby-hint">{t('place.nearbyHint')}</p>
          <ul className="place-detail__nearby-list">
            {nearby.map((p) => (
              <li key={p.id}>
                <PlaceCard place={p} variant="tile" />
              </li>
            ))}
          </ul>
        </section>
      )}
      </div>

      {/* Lightbox — 갤러리 이미지 확대 보기 */}
      {lightboxIdx !== null && place.images && place.images[lightboxIdx] && (
        <div
          ref={lightboxRef}
          role="dialog"
          aria-modal="true"
          aria-label={place.name}
          onClick={() => setLightboxIdx(null)}
          className="place-detail__lightbox"
        >
          <button
            ref={lightboxCloseRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setLightboxIdx(null)
            }}
            aria-label={t('common.close')}
            className="place-detail__lightbox-close"
          >
            <CloseIcon width={16} height={16} />
          </button>
          {place.images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  const len = place.images!.length
                  setLightboxIdx((i) => (i === null ? null : (i - 1 + len) % len))
                }}
                aria-label={t('common.back')}
                className="place-detail__lightbox-prev"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  const len = place.images!.length
                  setLightboxIdx((i) => (i === null ? null : (i + 1) % len))
                }}
                aria-label={t('common.next')}
                className="place-detail__lightbox-next"
              >
                ›
              </button>
            </>
          )}
          <img
            src={place.images[lightboxIdx]}
            alt={`${place.name} ${lightboxIdx + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="place-detail__lightbox-img"
          />
          {place.images.length > 1 && (
            <div className="place-detail__lightbox-count">
              {lightboxIdx + 1} / {place.images.length}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
