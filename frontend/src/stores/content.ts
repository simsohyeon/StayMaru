import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CURATED_COURSES, type CuratedCourse } from '@/constants/curatedCourses'

/**
 * 운영자가 /admin 에서 고치는 콘텐츠 — 지금은 테마 코스(큐레이션) 하나.
 *
 * 기본값은 코드에 있는 6개 코스다. 서버(/api/content)가 코스를 내려 주면 그것으로 교체하고,
 * 서버가 비었거나(= 아직 아무것도 올리지 않음) 응답하지 못하면 기본값을 그대로 쓴다.
 * 그래서 Supabase 없이도, 오프라인에서도 홈이 비지 않는다.
 *
 * 마지막으로 받은 목록은 localStorage 에 남겨 다음 실행의 첫 페인트에 곧바로 쓴다
 * (새로고침마다 기본값이 잠깐 보였다가 바뀌는 깜빡임 방지). 매 실행 hydrate 가 다시 덮는다.
 */
interface ContentState {
  curated: CuratedCourse[]
  /** 지금 화면이 쓰는 출처 — 관리자 화면에서 "서버 반영됨" 확인용. */
  source: 'builtin' | 'server'
  hydrate: () => Promise<void>
}

/** 서버 행이 화면에 걸 수 있는 형태인지 — 검증은 저장할 때 서버가 하지만, 읽을 때도 한 번 더 본다. */
function renderable(c: unknown): c is CuratedCourse {
  if (!c || typeof c !== 'object') return false
  const o = c as Partial<CuratedCourse>
  return (
    typeof o.id === 'string' &&
    Array.isArray(o.sigunguCodes) &&
    o.sigunguCodes.length > 0 &&
    !!o.i18n?.ko?.title
  )
}

let started = false

export const useContent = create<ContentState>()(
  persist(
    (set) => ({
      curated: CURATED_COURSES,
      source: 'builtin',
      hydrate: async () => {
        if (started) return
        started = true
        try {
          const res = await fetch('/api/content?kind=curated')
          if (!res.ok) return
          const body = (await res.json()) as { items?: unknown }
          const items = Array.isArray(body.items) ? body.items.filter(renderable) : []
          // 빈 목록 = "서버에 올린 코스가 없음". 장애와 구분되지 않아도 결과는 같다 — 기본값.
          set(items.length > 0 ? { curated: items, source: 'server' } : { curated: CURATED_COURSES, source: 'builtin' })
        } catch {
          /* 오프라인·네트워크 오류 — 이전 값(또는 기본값)을 그대로 둔다. */
        }
      },
    }),
    {
      name: 'shimmaru-content',
      version: 1,
      partialize: (s) => ({ curated: s.curated, source: s.source }),
    },
  ),
)

/** 테스트·관리자 화면에서 저장 직후 다시 받아올 때. */
export function resetContentHydration(): void {
  started = false
}
