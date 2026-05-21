import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Place } from '@/types/domain'

interface HitRecord {
  count: number
  lastSeenIso: string
  place: Place
}

interface PopularityState {
  hits: Record<string, HitRecord>
  /** PlaceDetail 진입 시 호출 — 카운트 +1, lastSeen 갱신. */
  track: (place: Place) => void
  clear: () => void
}

/**
 * 컴포넌트에서 호출. count 내림차순 상위 N개 (최근 N일 이내).
 *
 * 주의: zustand selector 로 직접 배열을 반환하면 매 렌더마다 새 참조가
 * 생겨 useSyncExternalStore 가 "Maximum update depth" 에러를 일으킨다.
 * 반드시 `usePopularity(s => s.hits)` 로 hits 만 받고 이 함수를 useMemo
 * 안에서 호출해야 한다.
 */
/** 컴포넌트용 훅 — 안전하게 hits 만 구독하고 메모이즈된 배열 반환. */
export function useTrendingPlaces(n = 6, withinDays = 14): Place[] {
  const hits = usePopularity((s) => s.hits)
  return useMemo(() => selectTopPlaces(hits, n, withinDays), [hits, n, withinDays])
}

export function selectTopPlaces(
  hits: Record<string, HitRecord>,
  n = 6,
  withinDays = 14,
): Place[] {
  const cutoff = Date.now() - withinDays * 24 * 60 * 60 * 1000
  const records = Object.values(hits).filter(
    (r) => new Date(r.lastSeenIso).getTime() >= cutoff,
  )
  records.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return b.lastSeenIso.localeCompare(a.lastSeenIso)
  })
  return records.slice(0, n).map((r) => r.place)
}

export const usePopularity = create<PopularityState>()(
  persist(
    (set) => ({
      hits: {},
      track: (place) =>
        set((s) => {
          const prev = s.hits[place.id]
          return {
            hits: {
              ...s.hits,
              [place.id]: {
                count: (prev?.count ?? 0) + 1,
                lastSeenIso: new Date().toISOString(),
                // place 정보를 통째로 보관 — 위젯 렌더 시 별도 API 호출 불필요.
                place,
              },
            },
          }
        }),
      clear: () => set({ hits: {} }),
    }),
    {
      name: 'shimmaru.popularity.v1',
      // 최대 200개 항목으로 유지 (오래된 항목 무한 누적 방지)
      partialize: (s) => {
        const entries = Object.entries(s.hits)
        if (entries.length <= 200) return { hits: s.hits }
        entries.sort(([, a], [, b]) => b.lastSeenIso.localeCompare(a.lastSeenIso))
        return { hits: Object.fromEntries(entries.slice(0, 200)) }
      },
    },
  ),
)
