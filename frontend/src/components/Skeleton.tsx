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
        'relative overflow-hidden bg-canvas-soft',
        'after:absolute after:inset-0 after:animate-skeleton',
        'after:bg-gradient-to-r after:from-transparent after:via-white/55 after:to-transparent',
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
      <div className="card flex gap-4 p-4">
        <Shimmer className="h-20 w-24 flex-shrink-0 rounded-md" />
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div>
            <Shimmer className="h-4 w-16 rounded-pill" />
            <Shimmer className="mt-2 h-4 w-3/4 rounded" />
            <Shimmer className="mt-2 h-3 w-1/2 rounded" />
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="card overflow-hidden">
      <Shimmer className="aspect-[4/3] w-full" />
      <div className="space-y-2 p-5">
        <Shimmer className="h-4 w-16 rounded-pill" />
        <Shimmer className="h-5 w-3/4 rounded" />
        <Shimmer className="h-3 w-1/2 rounded" />
      </div>
    </div>
  )
}

export function FestivalCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <Shimmer className="aspect-[16/9] w-full" />
      <div className="space-y-2 p-5">
        <div className="flex gap-2">
          <Shimmer className="h-4 w-16 rounded-pill" />
          <Shimmer className="h-4 w-14 rounded-pill" />
        </div>
        <Shimmer className="h-5 w-2/3 rounded" />
        <Shimmer className="h-3 w-1/2 rounded" />
        <Shimmer className="h-3 w-1/3 rounded" />
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
        ? 'space-y-3 md:grid md:grid-cols-2 md:gap-5 md:space-y-0 lg:grid-cols-3'
        : 'grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3'
      : 'grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3'
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
