/**
 * '찜으로 코스 만들기' 회귀 테스트.
 *
 * 이 버튼은 찜한 것만으로 코스를 짠다 — 예전에는 후보가 모자랄까 봐 TourAPI 로
 * 주변 장소를 더 불러와 섞었는데, 사용자가 고른 곳만 나와야 하므로 그 보강을 없앴다.
 * (Favorites.tsx buildFromFavorites)
 */
import { describe, it, expect, vi } from 'vitest'
vi.mock('@/api/tour', () => ({ isoToYmd: (iso: string) => iso.replaceAll('-', '') }))
vi.mock('@/lib/visitorIndex', () => ({ visitorBoostFor: () => undefined }))
import { generateCourse } from '@/lib/courseEngine'
import type { CategoryId, LatLng, Place } from '@/types/domain'

const ANDONG: LatLng = { lat: 36.57, lng: 128.73 }
let seq = 0
function fav(cat: CategoryId, km = 0): Place {
  seq++
  return {
    id: `f${seq}`, contentTypeId: 12, category: cat, name: `찜${seq}`,
    address: '경북', position: { lat: ANDONG.lat + km / 111, lng: ANDONG.lng },
    sigunguCode: 11,
  } as Place
}

describe('찜으로 코스 만들기 — 찜한 장소만 사용', () => {
  for (const n of [2, 3, 5, 8, 12]) {
    it(`찜 ${n}곳이면 코스에 찜한 것만 담긴다`, () => {
      const cats: CategoryId[] = ['hanok', 'attraction', 'temple', 'market', 'experience']
      const places = Array.from({ length: n }, (_, i) => fav(cats[i % cats.length], i * 3))
      const ids = new Set(places.map((p) => p.id))
      const duration = n <= 4 ? 'day' : n <= 6 ? '1n2d' : '2n3d'
      const course = generateCourse({
        candidates: places, festivals: [], baseSigungus: [11],
        baseCenter: ANDONG, duration, hiddenMode: false, favorites: places, lang: 'ko',
      })
      expect(course.items.length).toBeGreaterThan(0)
      // 찜 목록 밖의 장소가 섞이면 안 된다
      for (const it of course.items) expect(ids.has(it.place.id)).toBe(true)
      // 중복 없이
      const used = course.items.map((i) => i.place.id)
      expect(new Set(used).size).toBe(used.length)
    })
  }
})
