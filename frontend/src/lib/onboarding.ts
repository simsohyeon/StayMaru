/**
 * 첫 방문 코치마크 — 로컬 플래그 1개로 단순 관리.
 * 백엔드 도입 시에도 사용자별 설정 row 로 바로 옮길 수 있도록 키 명명 통일.
 */

const KEY = 'shimmaru.onboarding.seen.v1'

export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return true // private mode / quota — 안내를 무한 노출시키지 않는다
  }
}

export function markOnboardingSeen(): void {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* ignore */
  }
}

export function resetOnboarding(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
