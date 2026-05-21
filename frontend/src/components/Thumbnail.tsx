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
 * 로드 실패 시 카테고리 이모지 + 마커색 톤다운 배경으로 일관된 폴백을 보여준다.
 *
 * mixed content (http:// → https 페이지) 가 일부 환경에서 차단될 수 있으나
 * dev 서버는 http 라 영향 없음. 운영에서는 카카오 CDN처럼 https 만 쓰는 게 안전.
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
        className={`grid h-full w-full place-items-center ${className ?? ''}`}
        style={{ backgroundColor: cat.markerColor + '14' /* ~8% opacity */ }}
      >
        <span className={compact ? 'text-2xl' : 'text-5xl'}>{cat.emoji}</span>
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
