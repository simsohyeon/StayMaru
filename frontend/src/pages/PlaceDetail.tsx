import { useEffect, useState } from 'react'
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
import { useSettings } from '@/stores/settings'
import { useFavorites } from '@/stores/favorites'
import { useJournal } from '@/stores/journal'
import { usePopularity } from '@/stores/popularity'
import { loadDetail, loadPlaceById, searchAround } from '@/api/tour'
import { shareOrCopy, toastForShareResult } from '@/lib/share'
import { useToasts } from '@/stores/toasts'
import { useToggleFavorite } from '@/lib/useFavoriteAction'
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
  const [bootstrap, setBootstrap] = useState<FetchStatus>(state?.place ? 'idle' : 'loading')

  // state 없이 직접 진입(공유/북마크) — id 만으로 detailCommon2 호출해 기본 정보 구성.
  useEffect(() => {
    if (place || !routeId) return
    let cancelled = false
    setBootstrap('loading')
    void loadPlaceById(routeId, lang).then((p) => {
      if (cancelled) return
      if (p) {
        setPlace(p)
        setBootstrap('idle')
      } else {
        setBootstrap('error')
      }
    })
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
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [lightboxIdx, place?.images])

  if (!place) {
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
    <div className="bg-canvas">
      <TopBar back />

      <div className="px-5 mt-6 md:px-10 md:mt-10">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-hairline md:max-h-96">
          <Thumbnail src={place.thumbnail} alt={place.name} category={place.category} />
          <FavoriteStar
            active={isFav}
            overlay
            size="lg"
            className="absolute right-3 top-3"
            onClick={() => togglePlace(place)}
          />
        </div>
      </div>

      <div className="px-5 py-8 md:px-10 md:py-12 grid gap-10 md:grid-cols-12">
        <div className="md:col-span-7 space-y-6">
          <header>
            <CategoryBadge category={place.category} lang={lang} />
            <h1 className="mt-4 text-display-lg text-ink break-keep">{place.name}</h1>
          </header>

          <HeritageBadge placeName={place.name} lang={lang} />

          {/* 장소 설명 — API 응답의 overview 만 표시 (정적 폴백 X) */}
          {place.overview && (
            <p className="whitespace-pre-line text-body-md text-body">{place.overview}</p>
          )}

          <KeeperCard placeName={place.name} />

          <div className="flex flex-wrap gap-3">
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
                'inline-flex items-center gap-2 rounded-md border px-4 h-10 text-sm font-medium',
                journaled
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-hairline-strong bg-card text-ink hover:bg-canvas-soft',
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
              className="inline-flex items-center gap-2 rounded-md border border-hairline-strong bg-card px-4 h-10 text-sm font-medium text-ink hover:bg-canvas-soft"
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
              <section className="border-t border-hairline pt-6">
                <h3 className="eyebrow mb-3">{t('place.accessibilityTitle')}</h3>
                <ul className="flex flex-wrap gap-2">
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

        <aside className="md:col-span-5 md:sticky md:top-20 md:self-start">
          <KakaoMap places={[place]} className="h-56 w-full md:h-[420px]" />
        </aside>
      </div>

      {/* 사진 갤러리 — detailImage2 로 받아온 추가 이미지 (2장 이상일 때만 노출). */}
      {place.images && place.images.length > 1 && (
        <section className="px-5 pb-10 md:px-10">
          <p className="eyebrow">{t('place.gallery')}</p>
          <div className="mt-3 -mx-5 px-5 md:mx-0 md:px-0 flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2">
            {place.images.map((src, i) => (
              <button
                key={`${src}-${i}`}
                type="button"
                onClick={() => setLightboxIdx(i)}
                className="snap-start shrink-0 w-64 md:w-72 aspect-[4/3] overflow-hidden rounded-lg border border-hairline bg-canvas-soft"
                aria-label={`${place.name} ${i + 1}`}
              >
                <img
                  src={src}
                  alt={`${place.name} ${i + 1}`}
                  loading="lazy"
                  className="h-full w-full object-cover transition hover:scale-[1.03]"
                />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 주변 명소 — 5km 반경, 자기 자신 제외 8개. */}
      {nearby.length > 0 && (
        <section className="px-5 pb-section md:px-10">
          <p className="eyebrow">{t('place.nearby')}</p>
          <p className="mt-1 text-caption text-muted">{t('place.nearbyHint')}</p>
          <ul className="mt-4 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
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
          role="dialog"
          aria-modal="true"
          aria-label={place.name}
          onClick={() => setLightboxIdx(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 md:p-10"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setLightboxIdx(null)
            }}
            aria-label={t('common.close')}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
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
                className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
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
                className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                ›
              </button>
            </>
          )}
          <img
            src={place.images[lightboxIdx]}
            alt={`${place.name} ${lightboxIdx + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-md object-contain"
          />
          {place.images.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-pill bg-white/10 px-3 py-1 font-mono text-xs text-white">
              {lightboxIdx + 1} / {place.images.length}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
