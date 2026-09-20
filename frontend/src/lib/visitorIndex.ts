/** 시군별 방문자 합계 — api/bigdata.ts 의 DataLab 응답을 이 형태로 집계한다. */
export interface RegionVisit {
  sigunguCode: number
  /** 외지인+외국인 방문자 합계 (대표 주간 누계, 일 net 기준) */
  visitors: number
}

/**
 * 데이터랩 실방문자 데이터 → 시군별 "한적함 보너스"(0~1).
 * 코스엔진·Slow Index 의 숨은지역 점수를 정적 hiddenBoost 대신 실제 외지인·외국인
 * 방문자수로 매긴다 — 방문자가 적은 시군일수록 1에 가깝다.
 * 실패 시 boostMap 이 비어 호출부가 정적 hiddenBoost 로 폴백한다(graceful).
 *
 * 순수 상태 모듈 — 데이터를 가져오는 loadVisitorBoost 는 api/bigdata.ts 에 있다. 코스 엔진이 이 모듈을
 * import 하고 서버(api/course.ts)에서도 실행되므로, axios 를 쓰는 api 모듈을 여기서 끌고 오지 않는다.
 * 서버에서는 setVisitorBoost 가 호출되지 않아 정적 hiddenBoost 폴백으로 동작한다.
 */

let boostMap: Map<number, number> | null = null
let baseYm: string | undefined

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * 방문자수 → 0~1 한적함 보너스. 방문자수는 수십만~백만대까지 자릿수 차가 커
 * 로그 스케일로 min-max 정규화한 뒤 역전(1 - norm)한다. 가장 붐비는 시군 ≈ 0, 가장 한적 ≈ 1.
 */
export function buildVisitorBoost(visits: RegionVisit[]): Map<number, number> {
  const map = new Map<number, number>()
  const valid = visits.filter((v) => v.visitors > 0)
  if (valid.length < 2) return map
  const logs = valid.map((v) => Math.log10(v.visitors))
  const min = Math.min(...logs)
  const max = Math.max(...logs)
  const span = max - min || 1
  for (const v of valid) {
    const norm = (Math.log10(v.visitors) - min) / span // 0(한적)~1(붐빔)
    map.set(v.sigunguCode, round2(1 - norm))
  }
  return map
}

/** 로드된 방문자 데이터를 모듈 캐시에 반영 (api/bigdata.ts 의 loadVisitorBoost 가 호출). */
export function setVisitorBoost(visits: RegionVisit[], ym?: string): void {
  if (visits.length < 2) return
  boostMap = buildVisitorBoost(visits)
  baseYm = ym
}

/** 이미 로드돼 있는지 — loadVisitorBoost 의 중복 호출 방지용. */
export function hasVisitorBoost(): boolean {
  return boostMap !== null
}

/** DataLab 기반 한적함 보너스. 미로드/미구독이면 undefined → 호출부가 정적 hiddenBoost 로 폴백. */
export function visitorBoostFor(sigunguCode: number): number | undefined {
  return boostMap?.get(sigunguCode)
}

/**
 * 한적 순위 (1 = 가장 한적) + 순위 산출에 포함된 시군 수.
 * DataLab 미로드/미구독 또는 해당 시군 데이터 없음 → undefined (호출부 숨김).
 */
export function quietRankFor(
  sigunguCode: number,
): { rank: number; total: number } | undefined {
  if (!boostMap || boostMap.size === 0) return undefined
  const boost = boostMap.get(sigunguCode)
  if (boost === undefined) return undefined
  let rank = 1
  for (const v of boostMap.values()) if (v > boost) rank++
  return { rank, total: boostMap.size }
}

/** 코스 점수에 DataLab 실데이터가 반영되고 있는지 — UI 출처 표기용. */
export function isVisitorDataActive(): boolean {
  return boostMap !== null && boostMap.size > 0
}

/** 반영된 데이터의 기준 연월(YYYYMM) — 출처 표기용. */
export function visitorDataBaseYm(): string | undefined {
  return baseYm
}
