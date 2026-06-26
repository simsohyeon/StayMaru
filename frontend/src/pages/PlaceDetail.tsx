import { useEffect, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import TopBar from '@/components/TopBar'
import CategoryBadge from '@/components/CategoryBadge'
import KakaoMap from '@/components/KakaoMap'
import Thumbnail from '@/components/Thumbnail'
import ContactBlock from '@/components/ContactBlock'
import FavoriteStar from '@/components/FavoriteStar'
import PlaceCard from '@/components/PlaceCard'
import ErrorRetry from '@/components/ErrorRetry'
import HeritageBadge from '@/components/HeritageBadge'
import TempleManners from '@/components/TempleManners'
import HanokGlossary from '@/components/HanokGlossary'
import KeeperCard from '@/components/KeeperCard'
import RelatedSpots from '@/components/RelatedSpots'
import { useSettings } from '@/stores/settings'
import { useFavorites } from '@/stores/favorites'
import { useJournal } from '@/stores/journal'
import { usePopularity } from '@/stores/popularity'
import { loadDetail, loadPlaceById, searchAround } from '@/api/tour'
import { shareOrCopy, toastForShareResult } from '@/lib/share'
import { addPlaceToCourse } from '@/lib/courseActions'
import { useToasts } from '@/stores/toasts'
import { useToggleFavorite } from '@/lib/useFavoriteAction'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { askConfirm } from '@/stores/confirm'
import type { Place } from '@/types/domain'

type FetchStatus = 'idle' | 'loading' | 'error'

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
  const journalAdd = useJournal((s) => s.add)
  const journalRemove = useJournal((s) => s.remove)
  const journaled = useJournal((s) =>
    place ? s.entries.some((e) => e.placeId === place.id) : false,
  )
  const [nearby, setNearby] = useState<Place[]>([])
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
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
      setPlace((p) => (p ? { ...p, ...detail } : p))
    })
    // 주변 명소 — 5km 반경. 자기 자신 제외 후 8개. (FestivalDetail 의 패턴과 동일)
    if (place.position.lat && place.position.lng) {
      void searchAround(place.position, 5_000, lang).then((res) => {
        setNearby(res.filter((p) => p.id !== place.id).slice(0, 8))
      })
    }
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
      <div className="place-detail__notfound">
        <TopBar back />
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

  return (
    <div className="page">
      <TopBar back />

      <div className="place-detail__hero-wrap">
        <div className="place-detail__hero">
          <Thumbnail src={place.thumbnail} alt={place.name} category={place.category} />
          <FavoriteStar
            active={isFav}
            overlay
            size="lg"
            className="place-detail__star"
            onClick={() => togglePlace(place)}
          />
        </div>
      </div>

      <div className="page-body place-detail__body">
        <div className="place-detail__main">
          <header>
            <CategoryBadge category={place.category} lang={lang} />
            <h1 className="place-detail__title">{place.name}</h1>
          </header>

          <HeritageBadge placeName={place.name} lang={lang} />

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
              📍 {t('course.addToCourse')}
            </button>
            <a
              href={`https://map.kakao.com/link/to/${encodeURIComponent(place.name)},${place.position.lat},${place.position.lng}`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
            >
              🧭 {t('place.directions')}
            </a>
            <button
              type="button"
              onClick={async () => {
                if (journaled) {
                  const ok = await askConfirm({
                    message: t('journal.removeConfirm'),
                    danger: true,
                    confirmLabel: t('journal.remove'),
                  })
                  if (ok) journalRemove(place.id)
                } else {
                  journalAdd({
                    placeId: place.id,
                    placeName: place.name,
                    category: place.category,
                    thumbnail: place.thumbnail,
                    address: place.address,
                    visitedAt: new Date().toISOString().slice(0, 10),
                  })
                }
              }}
              className={clsx(
                'place-detail__visit-btn',
                journaled
                  ? 'place-detail__visit-btn--on'
                  : 'place-detail__visit-btn--off',
              )}
            >
              {journaled ? `✓ ${t('place.visited')}` : `✎ ${t('place.markVisited')}`}
            </button>
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
            Object.values(place.accessibility).some((v) => v === true) && (
              <section className="place-detail__a11y">
                <h3 className="eyebrow place-detail__a11y-title">{t('place.accessibilityTitle')}</h3>
                <ul className="place-detail__a11y-list">
                  {place.accessibility.wheelchair && (
                    <li className="badge-soft">♿ {t('place.a11yWheelchair')}</li>
                  )}
                  {place.accessibility.babyStroller && (
                    <li className="badge-soft">🛒 {t('place.a11yBabyStroller')}</li>
                  )}
                  {place.accessibility.pet && (
                    <li className="badge-soft">🐾 {t('place.a11yPet')}</li>
                  )}
                  {place.accessibility.creditCard && (
                    <li className="badge-soft">💳 {t('place.a11yCreditCard')}</li>
                  )}
                </ul>
              </section>
            )}
        </div>

        <aside className="place-detail__aside">
          <KakaoMap places={[place]} className="place-detail__map" />
        </aside>
      </div>

      {/* 사진 갤러리 — detailImage2 로 받아온 추가 이미지 (2장 이상일 때만 노출). */}
      {place.images && place.images.length > 1 && (
        <section className="place-detail__gallery">
          <p className="eyebrow">{t('place.gallery')}</p>
          <div className="place-detail__gallery-strip">
            {place.images.map((src, i) => (
              <button
                key={`${src}-${i}`}
                type="button"
                onClick={() => setLightboxIdx(i)}
                className="place-detail__gallery-item"
                aria-label={`${place.name} ${i + 1}`}
              >
                <img
                  src={src}
                  alt={`${place.name} ${i + 1}`}
                  loading="lazy"
                  className="place-detail__gallery-img"
                />
              </button>
            ))}
          </div>
        </section>
      )}

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
            ✕
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
