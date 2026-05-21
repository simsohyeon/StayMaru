import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Festival, Place } from '@/types/domain'

interface FavoritesState {
  places: Place[]
  festivals: Festival[]
  toggleplace: (p: Place) => void
  togglefestival: (f: Festival) => void
  has: (id: string) => boolean
  clear: () => void
}

export const useFavorites = create<FavoritesState>()(
  persist(
    (set, get) => ({
      places: [],
      festivals: [],
      toggleplace: (p) =>
        set((s) => ({
          places: s.places.some((x) => x.id === p.id)
            ? s.places.filter((x) => x.id !== p.id)
            : [...s.places, p],
        })),
      togglefestival: (f) =>
        set((s) => ({
          festivals: s.festivals.some((x) => x.id === f.id)
            ? s.festivals.filter((x) => x.id !== f.id)
            : [...s.festivals, f],
        })),
      has: (id) =>
        get().places.some((p) => p.id === id) || get().festivals.some((f) => f.id === id),
      clear: () => set({ places: [], festivals: [] }),
    }),
    { name: 'shimmaru.favorites.v1' },
  ),
)
