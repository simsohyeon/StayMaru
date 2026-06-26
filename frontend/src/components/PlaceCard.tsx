import { Link } from 'react-router-dom'
import CategoryBadge from './CategoryBadge'
import Thumbnail from './Thumbnail'
import FavoriteStar from './FavoriteStar'
import { useSettings } from '@/stores/settings'
import { useFavorites } from '@/stores/favorites'
import { useToggleFavorite } from '@/lib/useFavoriteAction'
import { findSigungu } from '@/constants/sigungu'
import type { Place } from '@/types/domain'

interface Props {
  place: Place
  trailing?: React.ReactNode
  variant?: 'row' | 'tile'
}

export default function PlaceCard({ place, trailing, variant = 'row' }: Props) {
  const lang = useSettings((s) => s.lang)
  const sg = place.sigunguCode ? findSigungu(place.sigunguCode) : undefined
  const sgName = sg ? sg[lang as 'ko' | 'en' | 'ja' | 'zh'] : place.address
  const { togglePlace } = useToggleFavorite()
  const isFav = useFavorites((s) => s.places.some((p) => p.id === place.id))

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
        </div>
        {trailing}
      </div>
      <div className="place-card__star--row">{star}</div>
    </Link>
  )
}
