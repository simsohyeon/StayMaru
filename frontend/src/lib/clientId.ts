/**
 * 익명 클라이언트 id — 로그인 없이 서버 저장(api/courses.ts)의 소유 단위로 쓴다.
 * 이 브라우저에서 처음 만들어 localStorage 에 두고 재사용한다. 기기·브라우저를 바꾸면 다른 id 다.
 * (실시간 협업의 방 코드와 같은 "링크를 아는 사람만" 수준의 보안 — 추측이 어려운 UUID)
 */
const KEY = 'shimmaru.client.v1'
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/

let cached: string | null = null

export function getClientId(): string {
  if (cached) return cached
  try {
    const stored = localStorage.getItem(KEY)
    if (stored && ID_RE.test(stored)) {
      cached = stored
      return stored
    }
    const fresh = crypto.randomUUID()
    localStorage.setItem(KEY, fresh)
    cached = fresh
    return fresh
  } catch {
    // 저장소 접근 불가(프라이빗 모드 등) — 세션 한정 id. 서버 저장은 이 세션 동안만 의미가 있다.
    cached = cached ?? `anon-${Math.random().toString(36).slice(2, 14)}`
    return cached
  }
}
