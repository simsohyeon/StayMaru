import type { CategoryId } from '@/types/domain'

/**
 * 큐레이션 코스 카드 → 탐색 서비스 진입 URL.
 * 첫 거점 시군(sigungu) + 첫 테마 카테고리(cat)를 검색조건으로 물고 /explore 로 간다.
 * 포탈 홈의 테마 카드와 테마 콘텐츠 페이지의 대표 코스 카드가 공유한다.
 */
export function curatedExploreUrl(c: { sigunguCodes: number[]; themes: CategoryId[] }): string {
  const sp = new URLSearchParams()
  if (c.sigunguCodes[0]) sp.set('sigungu', String(c.sigunguCodes[0]))
  if (c.themes[0]) sp.set('cat', c.themes[0])
  const q = sp.toString()
  return q ? `/explore?${q}` : '/explore'
}
