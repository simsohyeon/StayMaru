import { findSigungu } from '@/constants/sigungu'
import { quietRankFor, visitorBoostFor } from '@/lib/visitorIndex'
import type { CategoryId, Course, Lang } from '@/types/domain'

/**
 * Slow Travel Index — 코스를 두 축으로 평가한다.
 *  · 머무름 지수(0~10): 체류시간 ÷ (체류 + 이동)
 *  · 한적 지수(0~10): 데이터랩 외부 방문객 기준 한적함의 평균 (통계 없으면 undefined)
 * 두 점수의 산술평균으로 slow / balanced / busy 라벨을 부여한다.
 */
export interface SlowIndex {
  stayScore: number
  /** 방문자 통계가 아직 없으면 undefined — 추정값으로 메우지 않는다. */
  quietScore?: number
  /** 두 축의 평균 — 라벨의 근거이자 화면의 종합 점수. */
  score: number
  label: 'slow' | 'balanced' | 'busy'
  totalStayMinutes: number
  totalTravelMinutes: number
}

/** 카테고리별 권장 체류 시간(분). 머무름 지수 분자 합산에 사용. */
export const CATEGORY_STAY_MINUTES: Record<CategoryId, number> = {
  hanok: 90,         // 한옥 — 차담·툇마루 머무름 기준 (1박 시 별도)
  templestay: 240,   // 템플스테이 — 반나절 프로그램
  seowon: 60,        // 서원 — 강당·서적 관람
  temple: 75,        // 사찰 — 대웅전 + 부속전각 + 차담
  experience: 120,   // 전통체험 — 도자기·차·탈춤 등
  market: 60,        // 전통시장 — 식사 포함
  restaurant: 60,    // 맛집 — 식사 한 끼
  trail: 90,         // 둘레길·옛길 — 약 3~4km 보행
  attraction: 60,    // 일반 관광지
  festival: 90,      // 축제 — 관람·체험
}

export function calcSlowIndex(course: Course): SlowIndex {
  const totalStayMinutes = course.items.reduce(
    (a, it) => a + (CATEGORY_STAY_MINUTES[it.place.category] ?? 60),
    0,
  )
  const totalTravelMinutes = Math.max(1, course.estimatedTravelMinutes)
  const stayRatio = totalStayMinutes / (totalStayMinutes + totalTravelMinutes)
  const stayScore = clamp(round1(stayRatio * 10))

  // 한적 지수는 데이터랩 실방문자 기반 한적함 보너스(0~1)의 평균으로만 낸다.
  // 통계가 아직 없으면 점수를 만들지 않고 비워 둔다 — 그때는 머무름 축만으로 평가한다.
  let boostSum = 0
  let n = 0
  for (const it of course.items) {
    const boost = it.place.sigunguCode ? visitorBoostFor(it.place.sigunguCode) : undefined
    if (boost !== undefined) {
      boostSum += boost
      n++
    }
  }
  const quietScore = n > 0 ? clamp(round1((boostSum / n) * 10)) : undefined

  const combined = quietScore === undefined ? stayScore : (stayScore + quietScore) / 2
  const label: SlowIndex['label'] =
    combined >= 7 ? 'slow' : combined >= 4.5 ? 'balanced' : 'busy'

  return { stayScore, quietScore, score: round1(combined), label, totalStayMinutes, totalTravelMinutes }
}

function clamp(n: number, lo = 0, hi = 10) {
  return Math.max(lo, Math.min(hi, n))
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

/**
 * 코스가 경유하는 "숨은 보석"(데이터랩 한적 상위 3) 시군명 목록.
 * SlowIndexCard 배너와 코스 티켓 카드가 공유. 데이터 미로드면 빈 배열.
 */
export function gemNamesOf(course: Course, lang: Lang): string[] {
  const seen = new Set<number>()
  const names: string[] = []
  for (const it of course.items) {
    const code = it.place.sigunguCode
    if (!code || seen.has(code)) continue
    seen.add(code)
    const r = quietRankFor(code)
    if (r && r.rank <= 3) {
      const sg = findSigungu(code)
      if (sg) names.push(sg[lang as 'ko' | 'en' | 'ja' | 'zh'])
    }
  }
  return names
}
