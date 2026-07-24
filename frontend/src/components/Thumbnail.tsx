import { useState } from 'react'
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
 * 로드 실패 시 카테고리 컬러 워시 + 장소명 첫 글자(낙관) + 우상단 마커 점의
 * 일관된 폴백을 보여준다. 대형 이모지는 기기별 렌더 차이가 커서 쓰지 않는다 —
 * 카테고리 정체성은 워시 색과 마커 점이 전달한다.
 *
 * mixed content (http:// → https 페이지) 가 일부 환경에서 차단될 수 있으나
 * `api/tour.ts#forceHttps` 가 호출 단계에서 https 로 강제 변환 처리한다.
 */
export default function Thumbnail({ src, alt, category, compact, className }: Props) {
  const [broken, setBroken] = useState(false)
  // src 가 바뀌면 broken 리셋 — effect 대신 렌더 중 파생(이전 src 비교) 패턴.
  const [prevSrc, setPrevSrc] = useState(src)
  if (src !== prevSrc) {
    setPrevSrc(src)
    setBroken(false)
  }

  const cat = CATEGORY_MAP[category]
  const showImage = src && !broken

  if (!showImage) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`thumbnail__fallback ${className ?? ''}`}
        style={{
          // 마커색을 살짝 진하게 시작 → 거의 투명으로 페이드 — 카테고리 정체성은 유지하되 텍스트와 충돌 안 함
          background: `linear-gradient(135deg, ${cat.markerColor}22 0%, ${cat.markerColor}10 45%, ${cat.markerColor}04 100%)`,
        }}
      >
        {/* 우상단 마커 점 — 카테고리 정체성 시그널 */}
        <span
          className="thumbnail__marker"
          style={{ backgroundColor: cat.markerColor }}
          aria-hidden
        />
        {/* 장소명 첫 글자 — 낙관처럼 중앙에 은은하게 */}
        {alt && (
          <span
            aria-hidden
            className={
              (compact ? 'thumbnail__initial--compact' : 'thumbnail__initial--default') +
              ' thumbnail__initial'
            }
          >
            {alt.trim().charAt(0)}
          </span>
        )}
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setBroken(true)}
      className={`thumbnail__img ${className ?? ''}`}
    />
  )
}
