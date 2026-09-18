import { roadDistanceKm } from '@/lib/geo'

/**
 * 이동 시간 추정 — 자차 60km/h, 대중교통 30km/h + 환승 가산.
 * 직선거리를 그대로 나누면 산지가 많은 경북에서 실주행보다 30~45% 짧게 나오므로,
 * roadDistanceKm 로 도로 거리로 환산한 뒤 계산한다. 출발 준비 여유는 코스당 1회만 가산.
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
