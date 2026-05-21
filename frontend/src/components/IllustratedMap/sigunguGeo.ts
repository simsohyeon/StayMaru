/**
 * 경상북도 22개 시·군 중심 위경도 + 일러스트 매핑 박스 정의.
 *
 * 일러스트 좌표계 ↔ 실제 위경도 변환의 기준이 된다.
 * Mock SVG 든 AI 일러스트 PNG 든, 아래 BBOX 의 모서리가
 * 실제 일러스트 viewBox 의 모서리와 일치한다고 가정한다.
 *
 * 즉:
 *   (BBOX.south, BBOX.west)  →  (x=0, y=BBOX_PIXEL.height)
 *   (BBOX.north, BBOX.east)  →  (x=BBOX_PIXEL.width, y=0)
 *
 * 일러스트를 AI 로 새로 만들 때는 위경도 정합성을 위해
 * 같은 bbox 범위로 그려달라고 프롬프트에 명시해야 한다.
 */

export interface SigunguGeo {
  code: number
  slug: string
  /** 중심 위경도 (대략, 시청·군청 좌표 기준) */
  center: { lat: number; lng: number }
}

/** 본토 22개 시·군 중심 좌표 (울릉 포함). */
export const SIGUNGU_GEO: SigunguGeo[] = [
  { code: 1,  slug: 'gyeongsan',  center: { lat: 35.825, lng: 128.737 } },
  { code: 2,  slug: 'gyeongju',   center: { lat: 35.856, lng: 129.225 } },
  { code: 3,  slug: 'goryeong',   center: { lat: 35.726, lng: 128.263 } },
  { code: 4,  slug: 'gumi',       center: { lat: 36.119, lng: 128.344 } },
  { code: 6,  slug: 'gimcheon',   center: { lat: 36.139, lng: 128.114 } },
  { code: 7,  slug: 'mungyeong',  center: { lat: 36.586, lng: 128.187 } },
  { code: 8,  slug: 'bonghwa',    center: { lat: 36.893, lng: 128.732 } },
  { code: 9,  slug: 'sangju',     center: { lat: 36.410, lng: 128.159 } },
  { code: 10, slug: 'seongju',    center: { lat: 35.919, lng: 128.282 } },
  { code: 11, slug: 'andong',     center: { lat: 36.568, lng: 128.729 } },
  { code: 12, slug: 'yeongdeok',  center: { lat: 36.415, lng: 129.366 } },
  { code: 13, slug: 'yeongyang',  center: { lat: 36.667, lng: 129.112 } },
  { code: 14, slug: 'yeongju',    center: { lat: 36.806, lng: 128.624 } },
  { code: 15, slug: 'yeongcheon', center: { lat: 35.973, lng: 128.939 } },
  { code: 16, slug: 'yecheon',    center: { lat: 36.658, lng: 128.453 } },
  { code: 17, slug: 'ulleung',    center: { lat: 37.485, lng: 130.906 } },
  { code: 18, slug: 'uljin',      center: { lat: 36.993, lng: 129.401 } },
  { code: 19, slug: 'uiseong',    center: { lat: 36.353, lng: 128.697 } },
  { code: 20, slug: 'cheongdo',   center: { lat: 35.647, lng: 128.734 } },
  { code: 21, slug: 'cheongsong', center: { lat: 36.436, lng: 129.057 } },
  { code: 22, slug: 'chilgok',    center: { lat: 35.995, lng: 128.402 } },
  { code: 23, slug: 'pohang',     center: { lat: 36.019, lng: 129.343 } },
]

/**
 * 본토 일러스트의 bounding box (위경도).
 * 본토 시군의 min/max 에 약간의 여백을 더해 잡았다.
 * - lat: 35.50 ~ 37.10  (위도 1.60도, 약 178km)
 * - lng: 128.00 ~ 129.55 (경도 1.55도, 약 141km @ 위도 36°)
 * - 실제 비율 가로:세로 ≈ 0.79 : 1
 */
export const MAINLAND_BBOX = {
  north: 37.10,
  south: 35.50,
  west: 128.00,
  east: 129.55,
} as const

/** 본토 SVG viewBox 픽셀 크기 (BBOX 와 같은 비율 유지). */
export const MAINLAND_VIEWBOX = {
  width: 800,
  height: 1010, // 800 / 0.79 ≈ 1013
} as const

/**
 * 울릉/독도 inset — 본토와 너무 멀어 별도 박스로 표시한다.
 * 일러스트 우상단에 작은 액자 형태로 배치하고, 이 inset 내부에서만 동작하는
 * 별도의 좌표계를 가진다.
 */
export const ULLEUNG_BBOX = {
  north: 37.55,
  south: 37.42,
  west: 130.80,
  east: 131.00,
} as const

export const ULLEUNG_VIEWBOX = {
  width: 160,
  height: 130,
} as const
