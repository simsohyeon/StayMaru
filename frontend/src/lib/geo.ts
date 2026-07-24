import type { LatLng } from '@/types/domain'

/** Haversine 거리 (km) */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

/**
 * 직선 거리 → 실제 도로 거리 근사 (경북 도로 굴곡 계수).
 *
 * 경북은 산지 비중이 커서 직선거리와 실주행거리 차이가 크다 (예: 안동↔청송 직선 ≈ 33km,
 * 도로 ≈ 48km). 국토부 도로현황·내비 실측 근사치 기반 굴곡 계수를 거리대별로 적용한다:
 *   - 10km 미만: 시내·근거리 1.3
 *   - 10~40km:  시군 간 지방도 1.4
 *   - 40km 초과: 산지 관통 장거리 1.45
 */
export function roadDistanceKm(straightKm: number): number {
  if (straightKm <= 0) return 0
  const factor = straightKm < 10 ? 1.3 : straightKm <= 40 ? 1.4 : 1.45
  return straightKm * factor
}

/**
 * 직선 거리(km) → 분 단위 추정 이동시간.
 * 내부에서 도로 굴곡 계수(roadDistanceKm)를 적용한 뒤 도로 평균속도로 나눈다.
 * roadKmh 는 "도로 거리 기준" 평균 시속 — 경북 국도·지방도 승용차 평균 65km/h.
 */
export function estimateMinutes(straightKm: number, roadKmh = 65) {
  return Math.round((roadDistanceKm(straightKm) / roadKmh) * 60)
}
