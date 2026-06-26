import clsx from 'clsx'

/**
 * 카드 로딩 자리표시. 페이지 텍스트 한 줄 대신 실제 카드 모양으로 채워
 * 콘텐츠 영역의 점프(layout shift)를 줄이고 체감 속도를 높인다.
 *
 * 사용처:
 *   - PlaceCardSkeleton  → Explore / Favorites 의 그리드·리스트
 *   - FestivalCardSkeleton → Festivals / Home 의 hero 카드
 */

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'skeleton__shimmer',
        className,
      )}
    />
  )
}

interface PlaceSkelProps {
  variant?: 'row' | 'tile'
}
export function PlaceCardSkeleton({ variant = 'tile' }: PlaceSkelProps) {
  if (variant === 'row') {
    return (
      <div className="card skeleton__row">
        <Shimmer className="skeleton__row-thumb" />
        <div className="skeleton__row-body">
          <div>
            <Shimmer className="skeleton__line-tag" />
            <Shimmer className="skeleton__line-title-row" />
            <Shimmer className="skeleton__line-sub-row" />
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="card skeleton__media">
      <Shimmer className="skeleton__thumb-4x3" />
      <div className="skeleton__text">
        <Shimmer className="skeleton__line-tag" />
        <Shimmer className="skeleton__line-title" />
        <Shimmer className="skeleton__line-sub" />
      </div>
    </div>
  )
}

export function FestivalCardSkeleton() {
  return (
    <div className="card skeleton__media">
      <Shimmer className="skeleton__thumb-16x9" />
      <div className="skeleton__text">
        <div className="skeleton__tags">
          <Shimmer className="skeleton__line-tag" />
          <Shimmer className="skeleton__line-tag-2" />
        </div>
        <Shimmer className="skeleton__line-title-2" />
        <Shimmer className="skeleton__line-sub" />
        <Shimmer className="skeleton__line-sub-2" />
      </div>
    </div>
  )
}

interface GridProps {
  count?: number
  className?: string
  /** PlaceCard 그리드용 — md:grid-cols-3 lg:grid-cols-3 가 흔함 */
  cols?: 'place' | 'festival'
  variant?: 'row' | 'tile'
}

/** PlaceCardSkeleton 을 그리드로 감싼 헬퍼 — Explore/Favorites 페이지에서 한 줄로 사용. */
export function SkeletonGrid({ count = 6, cols = 'place', variant = 'tile', className }: GridProps) {
  const gridClass =
    cols === 'place'
      ? variant === 'row'
        ? 'skeleton__grid-place-row'
        : 'skeleton__grid-cols'
      : 'skeleton__grid-cols'
  return (
    <ul className={clsx(gridClass, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          {cols === 'festival' ? <FestivalCardSkeleton /> : <PlaceCardSkeleton variant={variant} />}
        </li>
      ))}
    </ul>
  )
}
