import type { Companion, Course } from '@/types/domain'
import type { CourseRequest, CourseResponse } from '@/lib/courseRequest'

/**
 * 서버 코스 생성(POST /api/course) 클라이언트.
 *
 * 서버가 DB 에 적재된 후보로 코스를 통째로 만들어 주면 브라우저는 TourAPI 팬아웃(15~20회)과 엔진 실행을 건너뛴다.
 * 서버가 준비되지 않았거나(503 not-ready: DB 미설정·미동기화 시군) 실패하면 null 을 돌려주고,
 * 호출부(Home.tsx)는 기존 로컬 파이프라인으로 폴백한다 — 기능이 끊기지 않는다.
 */

const TIMEOUT_MS = 15_000

/** 무장애·반려동물 전용 소스(KorWith/KorPet)는 DB 에 없어 서버가 못 만든다 — 왕복을 아끼기 위해 미리 건너뛴다. */
export function canGenerateRemotely(companions: Companion[]): boolean {
  return !companions.includes('accessible') && !companions.includes('pet')
}

export async function generateCourseRemote(req: CourseRequest): Promise<Course | null> {
  try {
    const r = await fetch('/api/course', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!r.ok) {
      if (import.meta.env.DEV) {
        const detail = await r.text().catch(() => '')
        console.info(`[course] 서버 생성 불가 (HTTP ${r.status}) ${detail.slice(0, 160)} — 로컬 생성으로 폴백`)
      }
      return null
    }
    const data = (await r.json()) as Partial<CourseResponse>
    const course = data?.course
    if (!course || !Array.isArray(course.items) || course.items.length === 0) return null
    if (import.meta.env.DEV) console.info('[course] 서버 생성', data.meta)
    return course
  } catch {
    return null // 네트워크·타임아웃 — 로컬 생성으로 폴백
  }
}
