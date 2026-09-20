import type { Course } from '@/types/domain'
import { getClientId } from '@/lib/clientId'

/**
 * 저장 코스 서버 보관(/api/courses) 클라이언트 — stores/courses.ts 가 localStorage 저장과 함께 호출한다.
 *
 * 서버가 503(not-ready: DB 미설정)을 주면 이 세션에서는 더 부르지 않고 localStorage 만 쓴다(기존 동작).
 * 모든 함수는 throw 하지 않는다 — 저장 실패가 화면 동작을 막으면 안 된다.
 */

const TIMEOUT_MS = 8_000
let unavailable = false

async function call(input: string, init: RequestInit = {}): Promise<Response | null> {
  if (unavailable) return null
  try {
    const r = await fetch(input, {
      ...init,
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (r.status === 503) {
      unavailable = true
      if (import.meta.env.DEV) console.info('[courses] 서버 저장 비활성 — localStorage 만 사용')
      return null
    }
    return r
  } catch {
    return null
  }
}

/** 서버에 보관된 목록. 서버 저장이 비활성이거나 실패하면 null (호출부는 로컬 유지). */
export async function fetchCoursesRemote(): Promise<Course[] | null> {
  const r = await call(`/api/courses?client=${encodeURIComponent(getClientId())}`)
  if (!r || !r.ok) return null
  const data = (await r.json().catch(() => null)) as { courses?: unknown } | null
  return Array.isArray(data?.courses) ? (data!.courses as Course[]) : null
}

export async function saveCourseRemote(course: Course): Promise<void> {
  await call('/api/courses', { method: 'PUT', body: JSON.stringify({ client: getClientId(), course }) })
}

export async function deleteCourseRemote(id: string): Promise<void> {
  await call(`/api/courses?client=${encodeURIComponent(getClientId())}&id=${encodeURIComponent(id)}`, { method: 'DELETE' })
}
