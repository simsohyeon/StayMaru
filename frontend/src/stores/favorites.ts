import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Festival, Place } from '@/types/domain'

type LastRemoved =
  | { kind: 'place'; item: Place; index: number }
  | { kind: 'festival'; item: Festival; index: number }
  | undefined

interface FavoritesState {
  places: Place[]
  festivals: Festival[]
  /** 마지막 제거 항목 — undo 토스트 용. persist 대상 아님(메모리만). */
  lastRemoved: LastRemoved
  toggleplace: (p: Place) => void
  togglefestival: (f: Festival) => void
  /** 마지막 제거 항목을 같은 자리에 복구. 없으면 no-op. */
  undoRemove: () => void
  has: (id: string) => boolean
  clear: () => void
}

export const useFavorites = create<FavoritesState>()(
  persist(
    (set, get) => ({
      places: [],
      festivals: [],
      lastRemoved: undefined,
      toggleplace: (p) =>
        set((s) => {
          const idx = s.places.findIndex((x) => x.id === p.id)
          if (idx >= 0) {
            const next = s.places.filter((_, i) => i !== idx)
            return {
              places: next,
              lastRemoved: { kind: 'place', item: p, index: idx },
            }
          }
          return { places: [...s.places, p], lastRemoved: undefined }
        }),
      togglefestival: (f) =>
        set((s) => {
          const idx = s.festivals.findIndex((x) => x.id === f.id)
          if (idx >= 0) {
            const next = s.festivals.filter((_, i) => i !== idx)
            return {
              festivals: next,
              lastRemoved: { kind: 'festival', item: f, index: idx },
            }
          }
          return { festivals: [...s.festivals, f], lastRemoved: undefined }
        }),
      undoRemove: () =>
        set((s) => {
          const r = s.lastRemoved
          if (!r) return s
          if (r.kind === 'place') {
            const next = [...s.places]
            next.splice(r.index, 0, r.item)
            return { places: next, lastRemoved: undefined }
          }
          const next = [...s.festivals]
          next.splice(r.index, 0, r.item)
          return { festivals: next, lastRemoved: undefined }
        }),
      has: (id) =>
        get().places.some((p) => p.id === id) || get().festivals.some((f) => f.id === id),
      clear: () => set({ places: [], festivals: [], lastRemoved: undefined }),
    }),
    {
      name: 'shimmaru.favorites.v1',
      // lastRemoved 는 메모리만 — 새 세션에서 의미 없음
      partialize: (s) => ({ places: s.places, festivals: s.festivals }),
    },
  ),
)
