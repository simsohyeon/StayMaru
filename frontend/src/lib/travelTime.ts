import { roadDistanceKm } from '@/lib/geo'

/**
 * 이동 시간 추정 — 자차 vs 대중교통.
 *
 * 입력은 직선거리(haversine)지만, 계산 전에 경북 도로 굴곡 계수(geo.roadDistanceKm)로
 * 실제 도로 거리로 환산한다 — 산지가 많은 경북에서 직선거리 그대로 나누면
 * 실주행보다 30~45% 짧게 나오기 때문. 속도는 "도로 거리 기준" 평균치:
 *   - 자차: 평균 60km/h (시군 간 지방·국도, 시내 구간 포함 평균)
 *   - 대중교통(시외/시내버스): 평균 30km/h, 환승 1회당 15분 가산
 *
 * 첫 출발 준비/이동(택시·정류장까지 도보) 여유는 코스 전체에 한 번만 가산한다.
 * 카카오모빌리티 API 같은 실시간 라우팅 연동은 별도 단계로 두고, 지금은 일관된 추정치.
 */

const CAR_KMH = 60
const TRANSIT_KMH = 30
const CAR_PREP_MIN = 10
const TRANSIT_PREP_MIN = 20
const TRANSIT_TRANSFER_MIN = 15

/** 단일 구간 자차 추정(분). 입력은 직선거리, 내부에서 도로거리 환산. 0km 입력은 0 반환. */
export function segmentCarMinutes(km: number): number {
  if (km <= 0) return 0
  return Math.max(1, Math.round((roadDistanceKm(km) / CAR_KMH) * 60))
}

/** 단일 구간 대중교통 추정(분). 환승 1회(10분) 포함 가정. */
export function segmentTransitMinutes(km: number): number {
  if (km <= 0) return 0
  return Math.max(1, Math.round((roadDistanceKm(km) / TRANSIT_KMH) * 60 + 10))
}

/** 코스 전체 자차 추정 — 구간별 도로거리 합 ÷ 평균속도 + 출발 준비. */
export function totalCarMinutes(distancesKm: number[]): number {
  const sum = distancesKm.reduce((a, b) => a + roadDistanceKm(Math.max(0, b)), 0)
  if (sum <= 0) return 0
  return Math.round((sum / CAR_KMH) * 60 + CAR_PREP_MIN)
}

/** 코스 전체 대중교통 추정 — 구간별 도로거리 합 ÷ 평균속도 + 환승*(구간-1) + 출발 준비. */
export function totalTransitMinutes(distancesKm: number[]): number {
  const segs = distancesKm.filter((km) => km > 0)
  if (segs.length === 0) return 0
  const sum = segs.reduce((a, b) => a + roadDistanceKm(b), 0)
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
