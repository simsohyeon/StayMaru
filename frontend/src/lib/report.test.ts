import { describe, it, expect } from 'vitest'
import { computeReport, visitedSigungus } from '@/lib/report'
import type { JournalEntry } from '@/stores/journal'
import type { CategoryId } from '@/types/domain'

let seq = 0
function entry(over: Partial<JournalEntry> & { category?: CategoryId } = {}): JournalEntry {
  seq++
  return {
    placeId: `p${seq}`,
    placeName: `장소${seq}`,
    category: over.category ?? 'attraction',
    visitedAt: `2026-06-${String((seq % 28) + 1).padStart(2, '0')}`,
    ...over,
  }
}

/** 테스트용 한적 순위 — 봉화(8)·영양(13)·울릉(17)이 상위 3. */
const rankFor = (code: number) =>
  code === 8 ? { rank: 1, total: 22 }
  : code === 13 ? { rank: 2, total: 22 }
  : code === 17 ? { rank: 3, total: 22 }
  : { rank: 10, total: 22 }

describe('visitedSigungus', () => {
  it('sigunguCode 우선, 없으면 주소의 시군명 매칭으로 소급 인식', () => {
    const set = visitedSigungus([
      entry({ sigunguCode: 11 }),
      entry({ address: '경상북도 봉화군 봉화읍 어딘가' }), // 코드 없음 → 주소 매칭
      entry({ address: '서울특별시 종로구' }), // 경북 아님 → 무시
    ])
    expect(set).toEqual(new Set([11, 8]))
  })
})

describe('computeReport', () => {
  it('빈 기록 — 0 집계 + pilgrim', () => {
    const r = computeReport([])
    expect(r.totalEntries).toBe(0)
    expect(r.conquered).toBe(0)
    expect(r.persona).toBe('pilgrim')
    expect(r.topCategory).toBeUndefined()
  })

  it('최다 카테고리 집계', () => {
    const r = computeReport([
      entry({ category: 'temple' }),
      entry({ category: 'temple' }),
      entry({ category: 'market' }),
    ])
    expect(r.topCategory).toBe('temple')
    expect(r.topCategoryCount).toBe(2)
    expect(r.categoryCounts.market).toBe(1)
  })

  it('hidden-explorer — 방문 시군의 1/3 이상이 숨은 보석', () => {
    const r = computeReport(
      [entry({ sigunguCode: 8 }), entry({ sigunguCode: 13 }), entry({ sigunguCode: 11 })],
      rankFor,
    )
    expect(r.gemVisits).toBe(2)
    expect(r.persona).toBe('hidden-explorer')
  })

  it('collector — 한 카테고리가 절반 이상 (보석 비중 낮을 때)', () => {
    const r = computeReport(
      [
        entry({ category: 'hanok', sigunguCode: 11 }),
        entry({ category: 'hanok', sigunguCode: 2 }),
        entry({ category: 'hanok', sigunguCode: 23 }),
        entry({ category: 'market', sigunguCode: 4 }),
      ],
      rankFor,
    )
    expect(r.persona).toBe('collector')
  })

  it('pilgrim — 골고루 + 보석 없음', () => {
    const r = computeReport(
      [
        entry({ category: 'hanok', sigunguCode: 11 }),
        entry({ category: 'temple', sigunguCode: 2 }),
        entry({ category: 'market', sigunguCode: 23 }),
      ],
      rankFor,
    )
    expect(r.persona).toBe('pilgrim')
  })

  it('bestEntry — 별점 최고, 동률이면 최근 방문', () => {
    const r = computeReport([
      entry({ rating: 4, visitedAt: '2026-05-01' }),
      entry({ rating: 5, visitedAt: '2026-05-02', placeName: '옛것' }),
      entry({ rating: 5, visitedAt: '2026-06-01', placeName: '최근' }),
      entry({ visitedAt: '2026-06-20' }), // 별점 없음 — 제외
    ])
    expect(r.bestEntry?.placeName).toBe('최근')
  })

  it('rankFor 미제공 — gemVisits 0, persona 는 나머지 규칙으로', () => {
    const r = computeReport([
      entry({ sigunguCode: 8, category: 'hanok' }),
      entry({ sigunguCode: 13, category: 'temple' }),
      entry({ sigunguCode: 11, category: 'market' }),
    ])
    expect(r.gemVisits).toBe(0)
    expect(r.persona).toBe('pilgrim')
  })
})
