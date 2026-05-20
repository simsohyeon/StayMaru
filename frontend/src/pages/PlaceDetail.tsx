import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import TopBar from '@/components/TopBar'
import CategoryBadge from '@/components/CategoryBadge'
import KakaoMap from '@/components/KakaoMap'
import Thumbnail from '@/components/Thumbnail'
import ContactBlock from '@/components/ContactBlock'
import FavoriteStar from '@/components/FavoriteStar'
import { useSettings } from '@/stores/settings'
import { useFavorites } from '@/stores/favorites'
import { loadDetail } from '@/api/tour'
import type { Place } from '@/types/domain'

export default function PlaceDetail() {
  const { t } = useTranslation()
  const state = useLocation().state as { place?: Place } | null
  const lang = useSettings((s) => s.lang)
  const togglePlace = useFavorites((s) => s.toggleplace)
  const isFav = useFavorites((s) =>
    state?.place ? s.places.some((p) => p.id === state.place!.id) : false,
  )
  const [place, setPlace] = useState<Place | undefined>(state?.place)

  // 라우터 state 로 들어오는 경우가 일반적. id 만 있고 state 가 없으면 (북마크/공유 링크 등)
  // 상세 API 만으로 표시할 수 있는 최소 정보를 채운다. (이전엔 mock 폴백을 썼지만 제거됨)

  useEffect(() => {
    if (!place) return
    void loadDetail(place.id, place.contentTypeId, lang).then((detail) => {
      if (Object.keys(detail).length === 0) return
      setPlace((p) => (p ? { ...p, ...detail } : p))
    })
  }, [place?.id, place?.contentTypeId, lang])

  if (!place) {
    return (
      <div className="bg-canvas">
        <TopBar back />
        <p className="px-5 py-16 text-center text-body-md text-muted">{t('error.generic')}</p>
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
            <h1 className="mt-4 text-display-lg text-ink">{place.name}</h1>
          </header>

          {/* 장소 설명 — API 응답의 overview 만 표시 (정적 폴백 X) */}
          {place.overview && (
            <p className="whitespace-pre-line text-body-md text-body">{place.overview}</p>
          )}

          <a
            href={`https://map.kakao.com/link/to/${encodeURIComponent(place.name)},${place.position.lat},${place.position.lng}`}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary"
          >
            🧭 {t('place.directions')}
          </a>

          <ContactBlock place={place} />
        </div>

        <aside className="md:col-span-5 md:sticky md:top-20 md:self-start">
          <KakaoMap places={[place]} className="h-56 w-full md:h-[420px]" />
        </aside>
      </div>
    </div>
  )
}
