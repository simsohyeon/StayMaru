import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Course } from '@/types/domain'

interface CoursesState {
  saved: Course[]
  recent: Course[]
  current?: Course
  save: (c: Course) => void
  remove: (id: string) => void
  setCurrent: (c?: Course) => void
}

export const useCourses = create<CoursesState>()(
  persist(
    (set) => ({
      saved: [],
      recent: [],
      current: undefined,
      save: (c) =>
        set((s) => ({
          saved: [c, ...s.saved.filter((x) => x.id !== c.id)].slice(0, 50),
        })),
      remove: (id) =>
        set((s) => ({
          saved: s.saved.filter((c) => c.id !== id),
          recent: s.recent.filter((c) => c.id !== id),
        })),
      setCurrent: (c) =>
        set((s) => ({
          current: c,
          recent: c
            ? [c, ...s.recent.filter((x) => x.id !== c.id)].slice(0, 10)
            : s.recent,
        })),
    }),
    { name: 'shimmaru.courses.v1' },
  ),
)
