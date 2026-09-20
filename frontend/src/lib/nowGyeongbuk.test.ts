import { describe, it, expect } from 'vitest'
import {
  upcomingWeekend,
  overlapsWeekend,
  busyLevel,
  pickQuietRegions,
  busiestRegions,
  quietRankOf,
  alternativesFor,
  pickBestCategory,
  tasteRanking,
  courseUrl,
  ULLEUNG_CODE,
} from './nowGyeongbuk'

// 2026.07 2주차 실측과 같은 순서의 축약 표본 (영양 < 울릉 < 봉화 < 청송 < 고령 … < 경주 < 포항)
const V = [
  { sigunguCode: 13, visitors: 31_000 }, // 영양
  { sigunguCode: 17, visitors: 33_000 }, // 울릉
  { sigunguCode: 8, visitors: 85_000 }, // 봉화
  { sigunguCode: 21, visitors: 88_000 }, // 청송
  { sigunguCode: 3, visitors: 110_000 }, // 고령
  { sigunguCode: 14, visitors: 160_000 }, // 영주
  { sigunguCode: 11, visitors: 300_000 }, // 안동
  { sigunguCode: 2, visitors: 920_000 }, // 경주
  { sigunguCode: 23, visitors: 1_170_000 }, // 포항
]

describe('upcomingWeekend', () => {
  it('평일이면 이번 주 토·일', () => {
    const w = upcomingWeekend(new Date(2026, 8, 16)) // 수
    expect(w.satYmd).toBe('20260919')
    expect(w.sunYmd).toBe('20260920')
  })
  it('토요일이면 오늘·내일', () => {
    const w = upcomingWeekend(new Date(2026, 8, 19))
    expect([w.satYmd, w.sunYmd]).toEqual(['20260919', '20260920'])
  })
  it('일요일이면 어제·오늘 — 아직 주말', () => {
    const w = upcomingWeekend(new Date(2026, 8, 20))
    expect([w.satYmd, w.sunYmd]).toEqual(['20260919', '20260920'])
  })
})

describe('overlapsWeekend', () => {
  const w = upcomingWeekend(new Date(2026, 8, 20))
  it('주말에 하루라도 걸치면 겹침', () => {
    expect(overlapsWeekend({ eventStartDate: '20260918', eventEndDate: '20260920' }, w)).toBe(true)
    expect(overlapsWeekend({ eventStartDate: '20260612', eventEndDate: '20261004' }, w)).toBe(true)
  })
  it('다음 주 시작이면 안 겹침', () => {
    expect(overlapsWeekend({ eventStartDate: '20260925', eventEndDate: '20260929' }, w)).toBe(false)
  })
})

describe('busyLevel', () => {
  it('최다 대비 비율로 5단계', () => {
    expect(busyLevel(31_000, 1_170_000)).toBe(1)
    expect(busyLevel(110_000, 1_170_000)).toBe(2)
    expect(busyLevel(300_000, 1_170_000)).toBe(3)
    expect(busyLevel(600_000, 1_170_000)).toBe(4)
    expect(busyLevel(920_000, 1_170_000)).toBe(5)
    expect(busyLevel(10, 0)).toBe(1)
  })
})

describe('pickQuietRegions', () => {
  it('울릉은 빼고 한적 순 3곳', () => {
    const picks = pickQuietRegions({ visits: V })
    expect(picks.map((p) => p.sigunguCode)).toEqual([13, 8, 21])
    expect(picks.some((p) => p.sigunguCode === ULLEUNG_CODE)).toBe(false)
  })
  it('축제 겹침·비 예보 시·군은 건너뛴다', () => {
    const picks = pickQuietRegions({
      visits: V,
      festivalRegions: new Set([8]),
      rainByRegion: new Map([[21, 70]]),
    })
    expect(picks.map((p) => p.sigunguCode)).toEqual([13, 3, 14])
  })
  it('강수 정보가 없는 시·군은 제외하지 않는다', () => {
    const picks = pickQuietRegions({ visits: V, rainByRegion: new Map([[13, 10]]) })
    expect(picks[0].sigunguCode).toBe(13)
  })
})

describe('busiestRegions / quietRankOf', () => {
  it('붐비는 순 2곳과 한적 순위', () => {
    expect(busiestRegions(V).map((v) => v.sigunguCode)).toEqual([23, 2])
    expect(quietRankOf(V, 13)).toBe(1)
    expect(quietRankOf(V, 23)).toBe(9)
    expect(quietRankOf(V, 99)).toBeUndefined()
  })
})

describe('alternativesFor', () => {
  // 한옥·고택 장소 수 (탐색 화면 실측): 경주 40 · 안동 33 · 봉화 9 · 고령 8 · 영주 7 · 청송 5
  const hanok = new Map([[2, 40], [11, 33], [8, 9], [3, 8], [14, 7], [21, 5]])
  it('경주의 대안 — 5곳 이상 & 방문자 1/5 이하를 한적 순으로', () => {
    const alts = alternativesFor(2, V, hanok)
    expect(alts.map((a) => a.sigunguCode)).toEqual([8, 21, 3])
    expect(alts[0].ratio).toBeCloseTo(85_000 / 920_000)
  })
  it('안동은 장소가 많아도 방문자 비율이 커서 대안이 아니다', () => {
    expect(alternativesFor(2, V, hanok).some((a) => a.sigunguCode === 11)).toBe(false)
  })
  it('대상이 목록에 없으면 빈 배열', () => {
    expect(alternativesFor(99, V, hanok)).toEqual([])
  })
})

describe('pickBestCategory', () => {
  it('장소가 가장 많은 카테고리', () => {
    expect(pickBestCategory({ hanok: 40, seowon: 7, temple: 12 })).toBe('hanok')
    expect(pickBestCategory({ hanok: 0, seowon: 0 })).toBeUndefined()
  })
})

describe('tasteRanking', () => {
  const hanok = new Map([[2, 40], [11, 33], [8, 9], [3, 8], [14, 7], [21, 5], [13, 1]])
  it('갈 곳이 충분하면서 한적한 순 — 5곳 미만은 뒤로, 0 은 제외', () => {
    const rows = tasteRanking(hanok, V)
    expect(rows.map((r) => r.sigunguCode).slice(0, 3)).toEqual([8, 3, 21])
    expect(rows.at(-1)?.sigunguCode).toBe(13) // 1곳 → sparse
    expect(rows.some((r) => r.sigunguCode === 23)).toBe(false) // 포항 0곳
  })
  it('경주는 장소가 가장 많지만 붐벼서 봉화보다 뒤', () => {
    const rows = tasteRanking(hanok, V)
    const idx = (c: number) => rows.findIndex((r) => r.sigunguCode === c)
    expect(idx(8)).toBeLessThan(idx(2))
  })
})

describe('courseUrl', () => {
  it('프로필과 시·군을 홈 ?gen= 쿼리로', () => {
    expect(courseUrl('hidden_gb', [13])).toBe('/?gen=hidden_gb&sigungu=13')
    expect(courseUrl('known_gb', [])).toBe('/?gen=known_gb')
  })
})
