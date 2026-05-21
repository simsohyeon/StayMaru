import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CategoryId } from '@/types/domain'

/**
 * 여행 기록(다이어리) 엔트리 — 방문 완료 표시 + 메모/별점.
 *
 * localStorage 키: shimmaru.journal.v1
 * 백엔드 도입 시 DB 컬럼과 1:1 매핑 가능하도록 평탄한 구조.
 */
export interface JournalEntry {
  placeId: string
  placeName: string
  category: CategoryId
  thumbnail?: string
  address?: string
  /** ISO date YYYY-MM-DD */
  visitedAt: string
  /** 사용자 메모 */
  note?: string
  /** 별점 1~5 */
  rating?: number
}

interface JournalState {
  entries: JournalEntry[]
  add: (e: JournalEntry) => void
  update: (placeId: string, patch: Partial<JournalEntry>) => void
  remove: (placeId: string) => void
  has: (placeId: string) => boolean
  get: (placeId: string) => JournalEntry | undefined
  clear: () => void
}

export const useJournal = create<JournalState>()(
  persist(
    (set, get) => ({
      entries: [],
      add: (e) =>
        set((s) => ({
          entries: s.entries.some((x) => x.placeId === e.placeId)
            ? s.entries // 이미 있으면 무시 (update 사용)
            : [...s.entries, e],
        })),
      update: (placeId, patch) =>
        set((s) => ({
          entries: s.entries.map((e) =>
            e.placeId === placeId ? { ...e, ...patch } : e,
          ),
        })),
      remove: (placeId) =>
        set((s) => ({
          entries: s.entries.filter((e) => e.placeId !== placeId),
        })),
      has: (placeId) => get().entries.some((e) => e.placeId === placeId),
      get: (placeId) => get().entries.find((e) => e.placeId === placeId),
      clear: () => set({ entries: [] }),
    }),
    { name: 'shimmaru.journal.v1' },
  ),
)
