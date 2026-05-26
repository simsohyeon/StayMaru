import { findSigungu } from '@/constants/sigungu'
import type { CategoryId, Course } from '@/types/domain'

/**
 * Slow Travel Index — 쉼마루의 정체성을 정량화하는 핵심 지표.
 *
 * 두 축으로 코스를 평가한다:
 *  1) 머무름 지수 (stayScore 0~10)  — 체류시간 ÷ (체류 + 이동) 비율.
 *     사찰·템플스테이·전통체험 비중이 높을수록, 이동거리가 짧을수록 큼.
 *  2) 한적 지수 (quietScore 0~10) — 시군구 인구밀도 역수 + hiddenBoost 평균.
 *     봉화·영양·청송·울릉 같은 저밀도 지역으로 갈수록 큼.
 *
 * 두 점수의 산술평균으로 slow / balanced / busy 라벨을 부여한다.
 * "천천히 머무는 경북" 컨셉의 시각화 근거.
 */
export interface SlowIndex {
  stayScore: number
  quietScore: number
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

  let densitySum = 0
  let boostSum = 0
  let n = 0
  for (const it of course.items) {
    const sg = it.place.sigunguCode ? findSigungu(it.place.sigunguCode) : undefined
    if (sg) {
      densitySum += sg.populationDensity
      boostSum += sg.hiddenBoost
      n++
    }
  }
  const avgDensity = n > 0 ? densitySum / n : 200
  const avgBoost = n > 0 ? boostSum / n : 0
  // 밀도 25명/km² → ~10점, 1500명/km² → ~0점 으로 정규화 (log10 기반)
  const densityScore = clamp(10 - (Math.log10(Math.max(avgDensity, 5)) - 1.0) * 4)
  const quietScore = clamp(round1(densityScore * 0.6 + avgBoost * 10 * 0.4))

  const combined = (stayScore + quietScore) / 2
  const label: SlowIndex['label'] =
    combined >= 7 ? 'slow' : combined >= 4.5 ? 'balanced' : 'busy'

  return { stayScore, quietScore, label, totalStayMinutes, totalTravelMinutes }
}

function clamp(n: number, lo = 0, hi = 10) {
  return Math.max(lo, Math.min(hi, n))
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}
