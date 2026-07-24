import { describe, it, expect } from 'vitest'
import { daysOf, splitIntoDays } from '@/lib/itinerary'
import type { CategoryId, Course, CourseItem } from '@/types/domain'

let seq = 0
function item(category: CategoryId, km = 5): CourseItem {
  seq++
  return {
    place: {
      id: `p${seq}`,
      contentTypeId: 12,
      category,
      name: `장소${seq}`,
      address: '',
      position: { lat: 36.5, lng: 128.7 },
    },
    order: seq,
    distanceFromPrevKm: km,
  }
}

function course(items: CourseItem[], duration: Course['duration'], dateRange?: Course['dateRange']): Course {
  return {
    id: 'c',
    title: 't',
    baseSigungus: [],
    duration,
    dateRange,
    hiddenMode: false,
    items,
    totalDistanceKm: 0,
    estimatedTravelMinutes: 0,
    createdAt: new Date().toISOString(),
    lang: 'ko',
  }
}

describe('daysOf', () => {
  it('기간별 일수 — 당일 1 / 1박2일 2 / 2박3일 3', () => {
    expect(daysOf('day')).toBe(1)
    expect(daysOf('1n2d')).toBe(2)
    expect(daysOf('2n3d')).toBe(3)
  })

  it('custom — dateRange 박수+1, 1~4 클램프, 없으면 2 폴백', () => {
    expect(daysOf('custom', { start: '2026-07-10', end: '2026-07-13' })).toBe(4) // 3박4일
    expect(daysOf('custom', { start: '2026-07-10', end: '2026-07-10' })).toBe(1)
    expect(daysOf('custom', { start: '2026-07-01', end: '2026-07-20' })).toBe(4) // 상한
    expect(daysOf('custom')).toBe(2)
  })
})

describe('splitIntoDays', () => {
  it('당일치기 — 전부 DAY 1', () => {
    const c = course([item('temple'), item('market'), item('experience')], 'day')
    const days = splitIntoDays(c)
    expect(days).toHaveLength(1)
    expect(days[0].items).toHaveLength(3)
  })

  it('1박2일 — 숙박(한옥)이 그 날의 마지막 일정으로 하루를 닫는다', () => {
    const c = course(
      [item('seowon'), item('experience'), item('hanok'), item('market'), item('temple'), item('attraction')],
      '1n2d',
    )
    const days = splitIntoDays(c)
    expect(days).toHaveLength(2)
    expect(days[0].items.map((i) => i.place.category)).toEqual(['seowon', 'experience', 'hanok'])
    expect(days[1].items).toHaveLength(3)
  })

  it('숙박 없음 — 균등 분할 (6곳 → 3+3)', () => {
    const c = course(
      [item('seowon'), item('temple'), item('market'), item('experience'), item('attraction'), item('trail')],
      '1n2d',
    )
    const days = splitIntoDays(c)
    expect(days.map((d) => d.items.length)).toEqual([3, 3])
  })

  it('2박3일 8곳 — 3일로 나뉘고 전 장소 보존·순서 유지', () => {
    const items = [
      item('seowon'), item('temple'), item('hanok'),
      item('market'), item('experience'), item('templestay'),
      item('attraction'), item('trail'),
    ]
    const c = course(items, '2n3d')
    const days = splitIntoDays(c)
    expect(days).toHaveLength(3)
    const flat = days.flatMap((d) => d.items.map((i) => i.place.id))
    expect(flat).toEqual(items.map((i) => i.place.id))
    // 숙박 앵커가 각 날의 끝에 위치
    expect(days[0].items.at(-1)!.place.category).toBe('hanok')
    expect(days[1].items.at(-1)!.place.category).toBe('templestay')
  })

  it('마지막 날 최소 1곳 보장 — 숙박이 맨 끝이어도 빈 날이 없다', () => {
    // 숙박이 마지막 항목 → 거기서 닫으면 DAY 2 가 비므로 닫지 않아야 함
    const c = course([item('seowon'), item('market'), item('hanok')], '1n2d')
    const days = splitIntoDays(c)
    expect(days).toHaveLength(2)
    expect(days[1].items.length).toBeGreaterThanOrEqual(1)
  })

  it('일별 거리 소계 = 그 날 구간 합', () => {
    const c = course([item('seowon', 10), item('hanok', 20), item('market', 30), item('temple', 40)], '1n2d')
    const days = splitIntoDays(c)
    expect(days[0].distanceKm).toBe(30)
    expect(days[1].distanceKm).toBe(70)
  })

  it('장소 수 < 일수 — 일수를 장소 수로 축소', () => {
    const c = course([item('temple'), item('market')], '2n3d')
    const days = splitIntoDays(c)
    expect(days).toHaveLength(2)
  })
})
