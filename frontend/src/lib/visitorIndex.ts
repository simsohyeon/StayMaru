import { fetchGyeongbukVisitors, type RegionVisit } from '@/api/bigdata'

/**
 * 한국관광 데이터랩(DataLabService) 실방문자 데이터 → 시군별 "한적함 보너스"(0~1).
 *
 * 코스엔진과 Slow Index 의 숨은지역 점수는 원래 정적 `hiddenBoost`(관광지 수 기반 상수)를
 * 썼다. 이 모듈은 그 자리를 **실제 외지인·외국인 방문자수**로 대체한다 —
 * 방문자가 적은 시군일수록 1에 가까워, "숨은 시군을 데이터로 끌어올린다"는 정체성을
 * 정적 표가 아니라 실데이터로 구현한다.
 *
 * graceful: DataLab 미구독/실패 시 boostMap 이 비어 있고, 호출부는 정적 hiddenBoost 로 폴백한다.
 * fetch 자체는 bigdata.ts 에서 IDB 24h 캐시되므로 loadVisitorBoost() 는 사실상 1회 네트워크.
 */

let boostMap: Map<number, number> | null = null
let baseYm: string | undefined
let loading: Promise<void> | null = null

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

/** DataLab 방문자 데이터를 1회 로드해 모듈 캐시에 보관. 중복 호출은 동일 Promise 를 공유. */
export function loadVisitorBoost(): Promise<void> {
  if (boostMap) return Promise.resolve()
  if (loading) return loading
  loading = fetchGyeongbukVisitors()
    .then((res) => {
      if (res.status === 'ok' && res.items.length >= 2) {
        boostMap = buildVisitorBoost(res.items)
        baseYm = res.baseYm
      }
    })
    .catch(() => {
      /* 미구독/네트워크 실패 — 정적 hiddenBoost 폴백 */
    })
    .finally(() => {
      loading = null
    })
  return loading
}

/** DataLab 기반 한적함 보너스. 미로드/미구독이면 undefined → 호출부가 정적 hiddenBoost 로 폴백. */
export function visitorBoostFor(sigunguCode: number): number | undefined {
  return boostMap?.get(sigunguCode)
}

/** 코스 점수에 DataLab 실데이터가 반영되고 있는지 — UI 출처 표기용. */
export function isVisitorDataActive(): boolean {
  return boostMap !== null && boostMap.size > 0
}

/** 반영된 데이터의 기준 연월(YYYYMM) — 출처 표기용. */
export function visitorDataBaseYm(): string | undefined {
  return baseYm
}
