import { SIGUNGUS } from '@/constants/sigungu'
import type { JournalEntry } from '@/stores/journal'
import type { CategoryId } from '@/types/domain'

/**
 * 쉼마루 Wrapped — 여행 기록 분석 엔진 (순수 함수, 테스트 대상).
 *
 * 여행 기록(Journal)을 읽어 정복 시군·최애 카테고리·숨은 보석 방문·페르소나를
 * 계산한다. /report 스토리와 공유 카드가 같은 결과를 사용한다.
 *
 * 페르소나 판정 (우선순위순):
 *  1) hidden-explorer  — 방문 시군 중 숨은 보석(한적 상위 3) 비중 ≥ 1/3
 *  2) collector        — 최다 카테고리가 전체 기록의 절반 이상 (한 우물)
 *  3) pilgrim          — 그 외 (명소를 두루 도는 순례자)
 */
export type Persona = 'hidden-explorer' | 'collector' | 'pilgrim'

export interface TravelReport {
  totalEntries: number
  /** 방문 시군 코드 (본토+울릉) */
  sigunguCodes: number[]
  conquered: number
  totalSigungu: number
  /** 최다 카테고리 (동률이면 먼저 센 쪽) */
  topCategory?: CategoryId
  topCategoryCount: number
  categoryCounts: Partial<Record<CategoryId, number>>
  /** 방문 시군 중 숨은 보석 수 — rankFor 미제공/데이터 없으면 0 */
  gemVisits: number
  /** 별점 최고 기록 (동률이면 최근 방문) */
  bestEntry?: JournalEntry
  persona: Persona
}

/** 기록 → 방문 시군 코드. sigunguCode 우선, 없으면 주소의 시군명 매칭. */
export function visitedSigungus(entries: JournalEntry[]): Set<number> {
  const set = new Set<number>()
  for (const e of entries) {
    if (e.sigunguCode) {
      set.add(e.sigunguCode)
      continue
    }
    const hit = SIGUNGUS.find((sg) => e.address?.includes(sg.ko))
    if (hit) set.add(hit.code)
  }
  return set
}

export function computeReport(
  entries: JournalEntry[],
  rankFor?: (code: number) => { rank: number; total: number } | undefined,
): TravelReport {
  const visited = visitedSigungus(entries)

  const categoryCounts: Partial<Record<CategoryId, number>> = {}
  for (const e of entries) {
    categoryCounts[e.category] = (categoryCounts[e.category] ?? 0) + 1
  }
  let topCategory: CategoryId | undefined
  let topCategoryCount = 0
  for (const [cat, n] of Object.entries(categoryCounts) as [CategoryId, number][]) {
    if (n > topCategoryCount) {
      topCategory = cat
      topCategoryCount = n
    }
  }

  let gemVisits = 0
  if (rankFor) {
    for (const code of visited) {
      const r = rankFor(code)
      if (r && r.rank <= 3) gemVisits++
    }
  }

  let bestEntry: JournalEntry | undefined
  for (const e of entries) {
    if (!e.rating) continue
    if (
      !bestEntry ||
      e.rating > (bestEntry.rating ?? 0) ||
      (e.rating === bestEntry.rating && e.visitedAt > bestEntry.visitedAt)
    ) {
      bestEntry = e
    }
  }

  const persona: Persona =
    visited.size > 0 && gemVisits / visited.size >= 1 / 3
      ? 'hidden-explorer'
      : entries.length > 0 && topCategoryCount / entries.length >= 0.5
        ? 'collector'
        : 'pilgrim'

  return {
    totalEntries: entries.length,
    sigunguCodes: [...visited],
    conquered: visited.size,
    totalSigungu: SIGUNGUS.length,
    topCategory,
    topCategoryCount,
    categoryCounts,
    gemVisits,
    bestEntry,
    persona,
  }
}
