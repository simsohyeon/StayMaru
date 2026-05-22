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
      <Link to={`/place/${place.id}`} state={{ place }} className="card-hover overflow-hidden block">
        <div className="relative aspect-[4/3] w-full overflow-hidden">
          <Thumbnail src={place.thumbnail} alt={place.name} category={place.category} />
          <div className="absolute right-2 top-2">{star}</div>
        </div>
        <div className="p-5">
          <CategoryBadge category={place.category} lang={lang} />
          <h3 className="mt-3 text-display-sm text-ink truncate">{place.name}</h3>
          <p className="mt-1 text-caption text-muted truncate">{sgName}</p>
          {trailing && <div className="mt-3">{trailing}</div>}
        </div>
      </Link>
    )
  }

  return (
    <Link
      to={`/place/${place.id}`}
      state={{ place }}
      className="card-hover flex gap-4 overflow-hidden p-4 relative"
    >
      <div className="h-20 w-24 flex-shrink-0 overflow-hidden rounded-md">
        <Thumbnail src={place.thumbnail} alt={place.name} category={place.category} compact />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between pr-8">
        <div>
          <CategoryBadge category={place.category} lang={lang} />
          <div className="mt-2 text-title-sm text-ink truncate">{place.name}</div>
          <div className="text-caption text-muted truncate">{sgName}</div>
        </div>
        {trailing}
      </div>
      <div className="absolute right-2 top-3">{star}</div>
    </Link>
  )
}
