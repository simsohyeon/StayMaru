import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import CategoryBadge from './CategoryBadge'
import Thumbnail from './Thumbnail'
import FavoriteStar from './FavoriteStar'
import { LeafIcon, AccessibleIcon, PawIcon } from './icons'
import { useSettings } from '@/stores/settings'
import { useFavorites } from '@/stores/favorites'
import { useToggleFavorite } from '@/lib/useFavoriteAction'
import { quietRankFor } from '@/lib/visitorIndex'
import { loadVisitorBoost } from '@/api/bigdata'
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

  // 무장애 등록 장소 표식 — 무장애 검색(KorWithService2) 결과에만 wheelchair 가 달린다.
  const a11yPill = place.accessibility?.wheelchair ? (
    <span className="place-card__a11y" title={t('explore.a11yHint')}>
      <AccessibleIcon aria-hidden width={11} height={11} />
      {t('explore.a11yOnly')}
    </span>
  ) : null

  // 반려동물 동반 표식 — 반려동물 동반여행(KorPetTourService2) 결과에만 pet 이 달린다.
  // 동반자에서 '반려동물' 을 고르면 해당 소스가 후보에 더해지므로, 코스·목록에서
  // 어떤 곳이 동반 가능한지 카드 단계에서 바로 보이게 한다(상세에는 이미 표시 중).
  const petPill = place.accessibility?.pet ? (
    <span className="place-card__a11y" title={t('place.a11yPet')}>
      <PawIcon aria-hidden width={11} height={11} />
      {t('place.a11yPet')}
    </span>
  ) : null

  /**
   * 찜 별 — 놓이는 바닥에 따라 색이 달라야 한다.
   *  - 타일: 사진 위 → 흰 별 + 그림자(overlay)
   *  - 행:  카드의 흰 면 위 → 잉크색 윤곽. 상세 화면 제목 옆 별과 같은 규격(lg).
   *    (행에서도 overlay 를 쓰던 탓에 흰 배경에 흰 별이 얹혀 거의 보이지 않았다.)
   */
  const star = (on: 'photo' | 'surface') => (
    <FavoriteStar
      active={isFav}
      overlay={on === 'photo'}
      size={on === 'surface' ? 'lg' : 'md'}
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
          <div className="place-card__star">{star('photo')}</div>
        </div>
        <div className="place-card__tile-body">
          <CategoryBadge category={place.category} lang={lang} />
          {a11yPill}
          {petPill}
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
          {a11yPill}
          {petPill}
          <div className="place-card__row-title">{place.name}</div>
          <div className="place-card__row-sub">{sgName}</div>
          {quietPill}
        </div>
        {trailing}
      </div>
      <div className="place-card__star--row">{star('surface')}</div>
    </Link>
  )
}
