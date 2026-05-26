/**
 * 이동 시간 추정 — 자차 vs 대중교통.
 *
 * 직선거리(haversine) 기반이므로 실제 도로 시간보다 짧게 나올 수 있다.
 * 경북 지방도의 굽이를 감안해 실측 평균치(통계청·국토부 공개자료 근사)를 사용한다:
 *   - 자차: 평균 50km/h (시군 간 지방·국도)
 *   - 대중교통(시외/시내버스): 평균 30km/h, 환승 1회당 15분 가산
 *
 * 첫 출발 준비/이동(택시·정류장까지 도보) 여유는 코스 전체에 한 번만 가산한다.
 * 카카오모빌리티 API 같은 실시간 라우팅 연동은 별도 단계로 두고, 지금은 일관된 추정치.
 */

const CAR_KMH = 50
const TRANSIT_KMH = 30
const CAR_PREP_MIN = 10
const TRANSIT_PREP_MIN = 20
const TRANSIT_TRANSFER_MIN = 15

/** 단일 구간 자차 추정(분). 0km 입력은 0 반환. */
export function segmentCarMinutes(km: number): number {
  if (km <= 0) return 0
  return Math.max(1, Math.round((km / CAR_KMH) * 60))
}

/** 단일 구간 대중교통 추정(분). 환승 1회(10분) 포함 가정. */
export function segmentTransitMinutes(km: number): number {
  if (km <= 0) return 0
  return Math.max(1, Math.round((km / TRANSIT_KMH) * 60 + 10))
}

/** 코스 전체 자차 추정 — 거리 합 ÷ 평균속도 + 출발 준비. */
export function totalCarMinutes(distancesKm: number[]): number {
  const sum = distancesKm.reduce((a, b) => a + Math.max(0, b), 0)
  if (sum <= 0) return 0
  return Math.round((sum / CAR_KMH) * 60 + CAR_PREP_MIN)
}

/** 코스 전체 대중교통 추정 — 거리 합 ÷ 평균속도 + 환승*(구간-1) + 출발 준비. */
export function totalTransitMinutes(distancesKm: number[]): number {
  const segs = distancesKm.filter((km) => km > 0)
  if (segs.length === 0) return 0
  const sum = segs.reduce((a, b) => a + b, 0)
  const transfers = Math.max(0, segs.length - 1)
  return Math.round((sum / TRANSIT_KMH) * 60 + transfers * TRANSIT_TRANSFER_MIN + TRANSIT_PREP_MIN)
}

/** UI 헬퍼 — 분을 "Nh Mm" 형태로. 60분 미만은 "Nm". */
export function formatMinutes(min: number): string {
  if (min <= 0) return '0m'
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}
