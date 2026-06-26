import clsx from 'clsx'
import { useTranslation } from 'react-i18next'

/**
 * 모든 카드/상세에서 공통으로 쓰는 찜 별.
 * - 네모 배경 없이 별 단독.
 * - active 면 채워진 ★, 아니면 빈 ☆.
 * - active 색상은 primary(orange), 비활성은 흰색 위 차콜 윤곽.
 * - 카드 이미지 위에 올라가는 경우가 많으므로 drop-shadow 살짝.
 */
interface Props {
  active: boolean
  onClick: (e: React.MouseEvent) => void
  /** 클릭 비활성 (예: 종료된 축제) */
  disabled?: boolean
  /** 카드 이미지 위에 absolute 로 둘 때 사용 */
  className?: string
  /** 카드 이미지 위 absolute 기본 */
  overlay?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export default function FavoriteStar({
  active,
  onClick,
  disabled,
  className,
  overlay,
  size = 'md',
}: Props) {
  const sizeClass =
    size === 'lg' ? 'favorite-star--lg' : size === 'sm' ? 'favorite-star--sm' : 'favorite-star--md'
  const { t } = useTranslation()
  return (
    <button
      type="button"
      aria-label={active ? t('place.unfavorite') : t('place.favorite')}
      aria-pressed={active}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={clsx(
        'favorite-star',
        sizeClass,
        active ? 'favorite-star--active' : 'favorite-star--inactive',
        // 흰 별이 이미지 위에서 보이도록 drop-shadow. ink 위에선 active 색만으로 충분.
        overlay && !active && 'favorite-star--overlay',
        // 클릭 가능 영역만 hover 색 변화
        !disabled && (active ? 'favorite-star--hover-active' : 'favorite-star--hover-inactive'),
        disabled && 'favorite-star--disabled',
        className,
      )}
    >
      {active ? '★' : '☆'}
    </button>
  )
}
