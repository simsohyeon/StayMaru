import type { Course } from '@/types/domain'

/**
 * FR-11 — 코스 공유 링크.
 * 백엔드 없는 MVP 단계에서는 코스 JSON을 base64url 인코딩해 URL 페이로드에 담는다.
 * 2차 단계에서 백엔드가 생기면 short-id 생성 API로 교체한다.
 */

export function encodeShare(course: Course): string {
  const json = JSON.stringify(course)
  // 한글 등 비-ASCII 안전한 base64url
  const b64 = btoa(unescape(encodeURIComponent(json)))
  return b64.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export function decodeShare(payload: string): Course | null {
  try {
    const b64 = payload.replaceAll('-', '+').replaceAll('_', '/')
    const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const json = decodeURIComponent(escape(atob(pad)))
    return JSON.parse(json) as Course
  } catch {
    return null
  }
}
