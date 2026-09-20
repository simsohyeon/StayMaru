import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Course } from '@/types/domain'
import { deleteCourseRemote, fetchCoursesRemote, saveCourseRemote } from '@/api/courses'

interface CoursesState {
  saved: Course[]
  recent: Course[]
  current?: Course
  save: (c: Course) => void
  remove: (id: string) => void
  setCurrent: (c?: Course) => void
}

const MAX_SAVED = 50

/**
 * 저장 코스 — localStorage(persist) 가 즉시 반영되는 로컬 캐시이고, 서버(/api/courses)가 보관본이다.
 * save/remove 는 로컬에 먼저 쓰고 서버에는 비동기로 미러링한다(실패해도 화면은 그대로).
 * 앱 시작 시 서버 목록을 받아 로컬과 합치고, 서버에 없는 로컬 코스(오프라인 저장분)는 올려 보낸다.
 * 서버 저장이 비활성(DB 미설정)이면 api/courses.ts 가 null 을 돌려 예전처럼 로컬만 쓴다.
 */
export const useCourses = create<CoursesState>()(
  persist(
    (set) => ({
      saved: [],
      recent: [],
      current: undefined,
      save: (c) => {
        set((s) => ({
          saved: [c, ...s.saved.filter((x) => x.id !== c.id)].slice(0, MAX_SAVED),
        }))
        void saveCourseRemote(c)
      },
      remove: (id) => {
        set((s) => ({
          saved: s.saved.filter((c) => c.id !== id),
          recent: s.recent.filter((c) => c.id !== id),
        }))
        void deleteCourseRemote(id)
      },
      setCurrent: (c) =>
        set((s) => ({
          current: c,
          recent: c
            ? [c, ...s.recent.filter((x) => x.id !== c.id)].slice(0, 10)
            : s.recent,
        })),
    }),
    {
      name: 'shimmaru.courses.v1',
      onRehydrateStorage: () => () => {
        void mergeFromServer()
      },
    },
  ),
)

async function mergeFromServer(): Promise<void> {
  const remote = await fetchCoursesRemote()
  if (!remote) return
  const local = useCourses.getState().saved
  const remoteIds = new Set(remote.map((c) => c.id))
  const localOnly = local.filter((c) => !remoteIds.has(c.id))
  for (const c of localOnly) void saveCourseRemote(c)
  useCourses.setState({ saved: [...remote, ...localOnly].slice(0, MAX_SAVED) })
}
