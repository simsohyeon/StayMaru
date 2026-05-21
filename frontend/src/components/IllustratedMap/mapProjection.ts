import {
  MAINLAND_BBOX,
  MAINLAND_VIEWBOX,
  ULLEUNG_BBOX,
  ULLEUNG_VIEWBOX,
} from './sigunguGeo'
import type { LatLng } from '@/types/domain'

export interface BBox {
  north: number
  south: number
  west: number
  east: number
}

export interface ViewBoxPx {
  width: number
  height: number
}

/**
 * 주어진 bbox / viewBox 픽셀 크기 기준으로 위경도 → 일러스트 픽셀 좌표.
 * - x: 서경(west)을 0, 동경(east)을 width 로 선형 매핑.
 * - y: 북쪽(north)을 0, 남쪽(south)을 height 로 선형 매핑 (SVG 는 y 가 아래쪽).
 */
export function projectToPx(
  ll: LatLng,
  bbox: BBox,
  viewBox: ViewBoxPx,
): { x: number; y: number } {
  const x = ((ll.lng - bbox.west) / (bbox.east - bbox.west)) * viewBox.width
  const y = ((bbox.north - ll.lat) / (bbox.north - bbox.south)) * viewBox.height
  return { x, y }
}

/** 본토 bbox 안에 들어오는 좌표인지. (울릉/독도는 false). */
export function isInMainland(ll: LatLng): boolean {
  return (
    ll.lat >= MAINLAND_BBOX.south &&
    ll.lat <= MAINLAND_BBOX.north &&
    ll.lng >= MAINLAND_BBOX.west &&
    ll.lng <= MAINLAND_BBOX.east
  )
}

/** 울릉 inset bbox 안에 들어오는 좌표인지. */
export function isInUlleung(ll: LatLng): boolean {
  return (
    ll.lat >= ULLEUNG_BBOX.south &&
    ll.lat <= ULLEUNG_BBOX.north &&
    ll.lng >= ULLEUNG_BBOX.west &&
    ll.lng <= ULLEUNG_BBOX.east
  )
}

/** 본토 viewBox 좌표로 변환. (bbox 밖이어도 그대로 외삽 — 호출부에서 clamp 결정). */
export function projectMainland(ll: LatLng) {
  return projectToPx(ll, MAINLAND_BBOX, MAINLAND_VIEWBOX)
}

/** 울릉 inset viewBox 좌표로 변환. */
export function projectUlleung(ll: LatLng) {
  return projectToPx(ll, ULLEUNG_BBOX, ULLEUNG_VIEWBOX)
}

// ─────────────────────────────────────────────────────────────────
// 줌/팬 상태 — viewBox 직접 조작 방식.
// 카메라(camera) 는 "현재 보이는 뷰포트"를 나타내는 뷰박스.
// scale 1 = MAINLAND_VIEWBOX 전체, scale > 1 = 확대.
// ─────────────────────────────────────────────────────────────────

export interface Camera {
  /** 현재 viewBox 좌상단 픽셀 좌표 */
  x: number
  y: number
  /** 현재 보이는 영역의 폭 (좁을수록 줌인) */
  width: number
  /** 현재 보이는 영역의 높이 */
  height: number
}

export function initialCamera(viewBox: ViewBoxPx): Camera {
  return { x: 0, y: 0, width: viewBox.width, height: viewBox.height }
}

export function clampCamera(cam: Camera, viewBox: ViewBoxPx): Camera {
  // 줌 한계: 0.4x ~ 6x.
  const minWidth = viewBox.width / 6
  const maxWidth = viewBox.width / 0.4
  const aspect = viewBox.height / viewBox.width
  const w = Math.max(minWidth, Math.min(maxWidth, cam.width))
  const h = w * aspect
  // 팬 한계: 약간의 오버스크롤 허용 (10%).
  const overX = viewBox.width * 0.1
  const overY = viewBox.height * 0.1
  const x = Math.max(-overX, Math.min(viewBox.width - w + overX, cam.x))
  const y = Math.max(-overY, Math.min(viewBox.height - h + overY, cam.y))
  return { x, y, width: w, height: h }
}

/** 카메라를 SVG viewBox 문자열로. */
export function cameraToViewBox(cam: Camera): string {
  return `${cam.x} ${cam.y} ${cam.width} ${cam.height}`
}

/** 마우스 위치(SVG 내부 픽셀) 기준으로 줌인/줌아웃. */
export function zoomAround(
  cam: Camera,
  anchor: { x: number; y: number },
  factor: number,
  viewBox: ViewBoxPx,
): Camera {
  const newWidth = cam.width / factor
  const aspect = cam.height / cam.width
  const newHeight = newWidth * aspect
  // 앵커가 화면 내 같은 비율에 머물도록 좌상단 조정.
  const ratioX = (anchor.x - cam.x) / cam.width
  const ratioY = (anchor.y - cam.y) / cam.height
  const x = anchor.x - ratioX * newWidth
  const y = anchor.y - ratioY * newHeight
  return clampCamera({ x, y, width: newWidth, height: newHeight }, viewBox)
}

/** 줌 배율 — 핀 크기 보정용. */
export function zoomLevel(cam: Camera, viewBox: ViewBoxPx): number {
  return viewBox.width / cam.width
}
