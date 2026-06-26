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
          'heritage-badge--compact',
          tone.badge,
          className,
        )}
      >
        <span className={clsx('heritage-badge__dot--compact', tone.dot)} aria-hidden />
        {tone.label[lang]}
      </span>
    )
  }

  return (
    <div
      className={clsx(
        'heritage-badge',
        tone.badge,
        className,
      )}
    >
      <span className={clsx('heritage-badge__dot', tone.dot)} aria-hidden />
      <div className="heritage-badge__body">
        <div className="heritage-badge__meta">
          <span className="heritage-badge__grade">
            {tone.label[lang]}
          </span>
          {heritage.no && (
            <span className="heritage-badge__no">{heritage.no}</span>
          )}
        </div>
        <p className="heritage-badge__note">{heritage.note[lang]}</p>
      </div>
    </div>
  )
}
