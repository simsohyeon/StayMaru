import clsx from 'clsx'
import { findHeritage, HERITAGE_TONE } from '@/constants/heritage'
import type { Lang } from '@/types/domain'

/**
 * 국보·보물·유네스코 세계유산 배지.
 * place.name 매칭으로 노출. 미매칭 시 null 반환.
 *
 * 변형:
 *  - compact: 카드 코너용 (한 글자 배지)
 *  - default: 상세 페이지용 (등급 + 한 줄 설명)
 */
export default function HeritageBadge({
  placeName,
  lang,
  variant = 'default',
  className,
}: {
  placeName: string
  lang: Lang
  variant?: 'default' | 'compact'
  className?: string
}) {
  const heritage = findHeritage(placeName)
  if (!heritage) return null
  const tone = HERITAGE_TONE[heritage.grade]

  if (variant === 'compact') {
    return (
      <span
        title={heritage.note[lang]}
        className={clsx(
          'inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
          tone.badge,
          className,
        )}
      >
        <span className={clsx('h-1.5 w-1.5 rounded-full', tone.dot)} aria-hidden />
        {tone.label[lang]}
      </span>
    )
  }

  return (
    <div
      className={clsx(
        'inline-flex items-start gap-3 rounded-md border px-4 py-3',
        tone.badge,
        className,
      )}
    >
      <span className={clsx('mt-1 h-2 w-2 flex-shrink-0 rounded-full', tone.dot)} aria-hidden />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider opacity-80">
            {tone.label[lang]}
          </span>
          {heritage.no && (
            <span className="font-mono text-[10px] opacity-60">{heritage.no}</span>
          )}
        </div>
        <p className="mt-0.5 text-sm font-medium">{heritage.note[lang]}</p>
      </div>
    </div>
  )
}
