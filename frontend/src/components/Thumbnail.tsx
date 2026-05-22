import { useState, useEffect } from 'react'
import { CATEGORY_MAP } from '@/constants/categories'
import type { CategoryId } from '@/types/domain'

interface Props {
  src?: string
  alt: string
  category: CategoryId
  /** 작은 크기일 때 이모지 폰트 사이즈 줄임 */
  compact?: boolean
  /** 추가 클래스 */
  className?: string
}

/**
 * 관광공사 응답의 firstimage/firstimage2 URL을 우선 시도하고, 비어있거나
 * 로드 실패 시 카테고리 컬러 그라데이션 + 큰 이모지 + 우상단 마커 점의
 * 일관된 폴백을 보여준다. (단순 이모지 한 글자보다 카드 비주얼 임팩트 강함)
 *
 * mixed content (http:// → https 페이지) 가 일부 환경에서 차단될 수 있으나
 * `api/tour.ts#forceHttps` 가 호출 단계에서 https 로 강제 변환 처리한다.
 */
export default function Thumbnail({ src, alt, category, compact, className }: Props) {
  const [broken, setBroken] = useState(false)
  // src 가 바뀌면 broken 리셋
  useEffect(() => {
    setBroken(false)
  }, [src])

  const cat = CATEGORY_MAP[category]
  const showImage = src && !broken

  if (!showImage) {
    return (
      <div
        className={`relative grid h-full w-full place-items-center overflow-hidden ${className ?? ''}`}
        style={{
          // 마커색을 살짝 진하게 시작 → 거의 투명으로 페이드 — 카테고리 정체성은 유지하되 텍스트와 충돌 안 함
          background: `linear-gradient(135deg, ${cat.markerColor}22 0%, ${cat.markerColor}10 45%, ${cat.markerColor}04 100%)`,
        }}
      >
        {/* 우상단 마커 점 — 카테고리 정체성 시그널 */}
        <span
          className="absolute right-3 top-3 h-2 w-2 rounded-full"
          style={{ backgroundColor: cat.markerColor }}
          aria-hidden
        />
        {/* 좌하단 행사명 첫 글자 — 살짝 비치게 (낙관 느낌) */}
        {alt && (
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 bottom-2 font-display text-[40px] leading-none opacity-15 text-ink"
            style={{ letterSpacing: '-0.04em' }}
          >
            {alt.trim().charAt(0)}
          </span>
        )}
        {/* 가운데 큰 이모지 */}
        <span
          className={
            (compact ? 'text-3xl' : 'text-6xl') +
            ' relative z-10 drop-shadow-sm'
          }
          aria-label={alt}
        >
          {cat.emoji}
        </span>
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setBroken(true)}
      className={`h-full w-full object-cover ${className ?? ''}`}
    />
  )
}
