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

/** 직선 거리를 분 단위 추정 이동시간으로 변환. 평균 시속 가정. */
export function estimateMinutes(km: number, avgKmh = 60) {
  return Math.round((km / avgKmh) * 60)
}
