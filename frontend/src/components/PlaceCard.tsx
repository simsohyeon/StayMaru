import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import CategoryBadge from './CategoryBadge'
import Thumbnail from './Thumbnail'
import FavoriteStar from './FavoriteStar'
import { LeafIcon } from './icons'
import { useSettings } from '@/stores/settings'
import { useFavorites } from '@/stores/favorites'
import { useToggleFavorite } from '@/lib/useFavoriteAction'
import { loadVisitorBoost, quietRankFor } from '@/lib/visitorIndex'
import { findSigungu } from '@/constants/sigungu'
import type { Place } from '@/types/domain'

interface Props {
  place: Place
  trailing?: React.ReactNode
  variant?: 'row' | 'tile'
}

export default function PlaceCard({ place, trailing, variant = 'row' }: Props) {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const sg = place.sigunguCode ? findSigungu(place.sigunguCode) : undefined
  const sgName = sg ? sg[lang as 'ko' | 'en' | 'ja' | 'zh'] : place.address
  const { togglePlace } = useToggleFavorite()
  const isFav = useFavorites((s) => s.places.some((p) => p.id === place.id))

  // 인사이트(데이터랩 한적 순위)를 카드에 녹임 — 조용한 상위 시군만 배지 노출(과밀 방지·상위3=숨은보석).
  const [quiet, setQuiet] = useState<{ rank: number; total: number }>()
  useEffect(() => {
    const code = place.sigunguCode
    if (!code) return
    let cancelled = false
    void loadVisitorBoost().then(() => {
      if (!cancelled) setQuiet(quietRankFor(code))
    })
    return () => {
      cancelled = true
    }
  }, [place.sigunguCode])
  // 숫자 순위 대신 '숨은 보석'(한적 상위 3개 시군)만 정성 배지로 노출 — 과밀·숫자 노이즈 제거.
  const quietPill =
    quiet && quiet.rank <= 3 ? (
      <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-pill border border-primary/30 bg-primary/[0.06] px-2 py-0.5 text-[11px] font-medium text-primary">
        <LeafIcon aria-hidden width={11} height={11} />
        {t('insights.gemBadge')}
      </span>
    ) : null

  const star = (
    <FavoriteStar
      active={isFav}
      overlay
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        togglePlace(place)
      }}
    />
  )

  if (variant === 'tile') {
    return (
      <Link to={`/place/${place.id}`} state={{ place }} className="card-hover place-card--tile">
        <div className="place-card__media">
          <Thumbnail src={place.thumbnail} alt={place.name} category={place.category} />
          <div className="place-card__star">{star}</div>
        </div>
        <div className="place-card__tile-body">
          <CategoryBadge category={place.category} lang={lang} />
          <h3 className="place-card__title">{place.name}</h3>
          <p className="place-card__sub">{sgName}</p>
          {quietPill}
          {trailing && <div className="place-card__trailing">{trailing}</div>}
        </div>
      </Link>
    )
  }

  return (
    <Link
      to={`/place/${place.id}`}
      state={{ place }}
      className="card-hover place-card--row"
    >
      <div className="place-card__thumb">
        <Thumbnail src={place.thumbnail} alt={place.name} category={place.category} compact />
      </div>
      <div className="place-card__row-body">
        <div>
          <CategoryBadge category={place.category} lang={lang} />
          <div className="place-card__row-title">{place.name}</div>
          <div className="place-card__row-sub">{sgName}</div>
          {quietPill}
        </div>
        {trailing}
      </div>
      <div className="place-card__star--row">{star}</div>
    </Link>
  )
}
