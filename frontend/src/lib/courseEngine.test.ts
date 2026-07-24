/**
 * courseEngine 단위테스트 — 코스 자동 생성 엔진의 핵심 로직 검증.
 *
 * 네트워크 의존 모듈은 mock 으로 격리한다:
 *  - @/api/tour: isoToYmd 만 사용 (순수 함수 재구현)
 *  - @/lib/visitorIndex: DataLab 미로드 상태(undefined) → 정적 hiddenBoost 폴백 경로 검증
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/api/tour', () => ({
  isoToYmd: (iso: string) => iso.replaceAll('-', ''),
}))
vi.mock('@/lib/visitorIndex', () => ({
  visitorBoostFor: () => undefined,
}))

import {
  generateCourse,
  recomputeCourse,
  reoptimizeCourse,
  mergeCourses,
  toggleVote,
  blendCompanions,
  type GenerateOptions,
} from '@/lib/courseEngine'
import { estimateMinutes, haversineKm, roadDistanceKm } from '@/lib/geo'
import {
  segmentCarMinutes,
  segmentTransitMinutes,
  totalCarMinutes,
  totalTransitMinutes,
} from '@/lib/travelTime'
import type { CategoryId, Course, CourseItem, Festival, LatLng, Place } from '@/types/domain'

// ─── 테스트 헬퍼 ────────────────────────────────────────────────────────────

/** 안동 시내 근사 좌표 — 거점 기준점 */
const ANDONG: LatLng = { lat: 36.57, lng: 128.73 }

let seq = 0
function makePlace(over: Partial<Place> = {}): Place {
  seq++
  return {
    id: `p${seq}`,
    contentTypeId: 12,
    category: 'attraction' as CategoryId,
    name: `장소${seq}`,
    address: '경북 어딘가',
    position: { ...ANDONG },
    ...over,
  }
}

/** 거점에서 위도 방향으로 km 만큼 떨어진 좌표 (1도 ≈ 111km) */
function offsetKm(km: number, base: LatLng = ANDONG): LatLng {
  return { lat: base.lat + km / 111, lng: base.lng }
}

function makeFestival(over: Partial<Festival> = {}): Festival {
  return {
    ...makePlace({ category: 'festival', contentTypeId: 15 }),
    category: 'festival',
    eventStartDate: '20260701',
    eventEndDate: '20260710',
    ...over,
  } as Festival
}

function baseOpts(over: Partial<GenerateOptions> = {}): GenerateOptions {
  return {
    candidates: [],
    festivals: [],
    baseSigungus: [],
    baseCenter: ANDONG,
    duration: 'day',
    lang: 'ko',
    ...over,
  }
}

function categories(c: Course): CategoryId[] {
  return c.items.map((it) => it.place.category)
}
function countCat(c: Course, cat: CategoryId): number {
  return categories(c).filter((x) => x === cat).length
}

// ─── geo 기초 ───────────────────────────────────────────────────────────────

describe('geo', () => {
  it('haversineKm — 위도 1도 ≈ 111km', () => {
    const d = haversineKm({ lat: 36, lng: 128 }, { lat: 37, lng: 128 })
    expect(d).toBeGreaterThan(110)
    expect(d).toBeLessThan(112.5)
  })

  it('estimateMinutes — 도로 굴곡계수 반영: 직선 60km → 87km 도로 ÷ 65km/h ≈ 80분', () => {
    expect(estimateMinutes(0)).toBe(0)
    expect(estimateMinutes(60)).toBe(80) // 60 × 1.45 / 65 × 60
    // 직선거리 그대로 나눈 값(60분)보다 항상 길어야 한다 — 경북 산지 보정.
    expect(estimateMinutes(60)).toBeGreaterThan(60)
  })

  it('roadDistanceKm — 거리대별 굴곡계수 (1.3 / 1.4 / 1.45)', () => {
    expect(roadDistanceKm(0)).toBe(0)
    expect(roadDistanceKm(5)).toBeCloseTo(6.5, 5) // < 10km → ×1.3
    expect(roadDistanceKm(30)).toBeCloseTo(42, 5) // 10~40km → ×1.4
    expect(roadDistanceKm(80)).toBeCloseTo(116, 5) // > 40km → ×1.45
  })

  it('travelTime — 자차/대중교통 모두 도로거리 기반, 대중교통이 더 오래 걸린다', () => {
    expect(segmentCarMinutes(0)).toBe(0)
    // 직선 30km → 도로 42km: 자차 42분(60km/h), 대중교통 84+10=94분(30km/h)
    expect(segmentCarMinutes(30)).toBe(42)
    expect(segmentTransitMinutes(30)).toBe(94)
    // 코스 전체 — 환승·출발준비 가산 포함
    expect(totalCarMinutes([30, 30])).toBe(94) // 84km/60 → 84 + 준비 10
    expect(totalTransitMinutes([30, 30])).toBe(203) // 168 + 환승 15 + 준비 20
  })
})

// ─── generateCourse 기본 동작 ───────────────────────────────────────────────

describe('generateCourse — 기본', () => {
  it('후보가 없으면 빈 코스를 반환한다', () => {
    const c = generateCourse(baseOpts())
    expect(c.items).toHaveLength(0)
    expect(c.totalDistanceKm).toBe(0)
    expect(c.estimatedTravelMinutes).toBe(0)
  })

  it('당일치기는 최대 4곳까지만 선택한다', () => {
    const candidates = Array.from({ length: 10 }, (_, i) =>
      makePlace({ position: offsetKm(i * 0.5) }),
    )
    const c = generateCourse(baseOpts({ candidates }))
    expect(c.items.length).toBeLessThanOrEqual(4)
    expect(c.items.length).toBeGreaterThan(0)
  })

  it('order 는 1부터 연속이고 거리/시간이 일관된다', () => {
    const candidates = [1, 3, 5, 7].map((km) => makePlace({ position: offsetKm(km) }))
    const c = generateCourse(baseOpts({ candidates }))
    c.items.forEach((it, i) => expect(it.order).toBe(i + 1))
    const sum = Math.round(c.items.reduce((a, it) => a + it.distanceFromPrevKm, 0) * 10) / 10
    expect(c.totalDistanceKm).toBeCloseTo(sum, 1)
    expect(c.estimatedTravelMinutes).toBe(estimateMinutes(c.totalDistanceKm))
  })

  it('당일치기 코스에는 숙박 카테고리(hanok/templestay)가 들어가지 않는다', () => {
    const candidates = [
      makePlace({ category: 'hanok' }),
      makePlace({ category: 'templestay' }),
      makePlace({ category: 'attraction' }),
      makePlace({ category: 'experience' }),
      makePlace({ category: 'market' }),
      makePlace({ category: 'temple' }),
    ]
    const c = generateCourse(baseOpts({ candidates, duration: 'day' }))
    expect(countCat(c, 'hanok')).toBe(0)
    expect(countCat(c, 'templestay')).toBe(0)
  })

  it('1박2일 한옥감성 코스에는 한옥이 포함된다', () => {
    const candidates = [
      makePlace({ category: 'hanok' }),
      makePlace({ category: 'seowon' }),
      makePlace({ category: 'seowon' }),
      makePlace({ category: 'temple' }),
      makePlace({ category: 'experience' }),
      makePlace({ category: 'market' }),
      makePlace({ category: 'attraction' }),
    ]
    const c = generateCourse(
      baseOpts({ candidates, duration: '1n2d', profiles: ['hanok_emotion'] }),
    )
    expect(countCat(c, 'hanok')).toBeGreaterThanOrEqual(1)
  })
})

// ─── hard cutoff / 반경 ─────────────────────────────────────────────────────

describe('generateCourse — 거리 컷오프', () => {
  it('당일치기 hard cutoff(35km) 밖 후보는 제외한다 (근접 후보 충분 시)', () => {
    const near = Array.from({ length: 8 }, (_, i) =>
      makePlace({ position: offsetKm(2 + i) }),
    )
    const far = makePlace({ id: 'far', position: offsetKm(60) })
    const c = generateCourse(baseOpts({ candidates: [...near, far] }))
    expect(c.items.some((it) => it.place.id === 'far')).toBe(false)
  })

  it('근접 후보가 부족하면 먼 후보로 폴백해 빈 코스를 피한다', () => {
    const far = [50, 55, 60].map((km) => makePlace({ position: offsetKm(km) }))
    const c = generateCourse(baseOpts({ candidates: far }))
    expect(c.items.length).toBeGreaterThan(0)
  })

  it('컷오프 폴백은 점진 확장 — 중거리 후보가 있으면 100km 후보까지 끌려오지 않는다', () => {
    // day cutoff 35km 안엔 아무것도 없지만 ×1.5~×2 확장 반경엔 40km대 후보가 있다.
    const mid = [38, 42, 45, 48].map((km) => makePlace({ position: offsetKm(km) }))
    const veryFar = makePlace({ id: 'vf', position: offsetKm(100) })
    const c = generateCourse(baseOpts({ candidates: [...mid, veryFar] }))
    expect(c.items.length).toBeGreaterThan(0)
    expect(c.items.some((it) => it.place.id === 'vf')).toBe(false)
  })

  it('구간 상한 — 반경 안이라도 장거리 점프를 만드는 아웃라이어는 교체된다', () => {
    // 1박2일(cutoff 70) — 65km 밖 사찰이 quota(temple 1)로 뽑히면
    // 근처를 잘 돌다가 갑자기 55km+ 구간이 생긴다. legLimit(50) 초과 → 근처 후보로 교체.
    const near = Array.from({ length: 8 }, (_, i) => makePlace({ position: offsetKm(2 + i) }))
    const farTemple = makePlace({ id: 'far-temple', category: 'temple', position: offsetKm(65) })
    const c = generateCourse(
      baseOpts({ candidates: [...near, farTemple], duration: '1n2d' }),
    )
    expect(c.items.some((it) => it.place.id === 'far-temple')).toBe(false)
    // 어떤 구간도 1박2일 상한(50km)을 넘지 않는다
    expect(c.items.every((it) => it.distanceFromPrevKm <= 50)).toBe(true)
  })
})

// ─── 스코어링 가중치 ─────────────────────────────────────────────────────────

describe('generateCourse — 가중치', () => {
  it('찜한 장소(FR-17)가 우선 선택된다', () => {
    const plain = Array.from({ length: 6 }, () => makePlace())
    const fav = makePlace({ id: 'fav' })
    const c = generateCourse(
      baseOpts({ candidates: [...plain, fav], favorites: [fav] }),
    )
    expect(c.items.some((it) => it.place.id === 'fav')).toBe(true)
  })

  it('숨은지역 모드 — 봉화(hiddenBoost 0.9)가 경주(0.0)보다 우선된다', () => {
    // 동일 카테고리·동일 거리 조건에서 sigunguCode 만 다르게.
    const gyeongju = Array.from({ length: 3 }, (_, i) =>
      makePlace({ id: `gj${i}`, sigunguCode: 2, position: offsetKm(3) }),
    )
    const bonghwa = Array.from({ length: 3 }, (_, i) =>
      makePlace({ id: `bh${i}`, sigunguCode: 8, position: offsetKm(3) }),
    )
    const c = generateCourse(
      baseOpts({ candidates: [...gyeongju, ...bonghwa], profiles: ['hidden_gb'] }),
    )
    const bhCount = c.items.filter((it) => it.place.id.startsWith('bh')).length
    expect(c.hiddenMode).toBe(true)
    expect(bhCount).toBe(3)
  })

  it('비 예보 시 둘레길(야외) 대신 실내 체험을 우선한다', () => {
    const mk = () => [
      ...Array.from({ length: 3 }, (_, i) => makePlace({ id: `tr${i}`, category: 'trail' })),
      ...Array.from({ length: 3 }, (_, i) => makePlace({ id: `ex${i}`, category: 'experience' })),
    ]
    const sunny = generateCourse(
      baseOpts({ candidates: mk(), profiles: ['temple_healing'] }),
    )
    const rainy = generateCourse(
      baseOpts({ candidates: mk(), profiles: ['temple_healing'], rainHint: 'rain-likely' }),
    )
    expect(countCat(sunny, 'trail')).toBeGreaterThan(countCat(rainy, 'trail'))
    expect(countCat(rainy, 'experience')).toBeGreaterThan(countCat(sunny, 'experience'))
  })

  it('아이 동반 — 서원 대신 전통체험이 늘어난다', () => {
    const mk = () => [
      ...Array.from({ length: 3 }, () => makePlace({ category: 'seowon' })),
      ...Array.from({ length: 3 }, () => makePlace({ category: 'experience' })),
    ]
    const noKids = generateCourse(baseOpts({ candidates: mk() }))
    const withKids = generateCourse(baseOpts({ candidates: mk(), companions: ['kids'] }))
    expect(countCat(withKids, 'experience')).toBeGreaterThanOrEqual(countCat(noKids, 'experience'))
    expect(countCat(withKids, 'seowon')).toBeLessThanOrEqual(countCat(noKids, 'seowon'))
  })

  it('반려동물 동반 — pet 가능 장소가 가산점을 받는다', () => {
    const normal = Array.from({ length: 5 }, () => makePlace({ category: 'attraction' }))
    const petOk = makePlace({
      id: 'pet-ok',
      category: 'attraction',
      accessibility: { pet: true },
    })
    const c = generateCourse(
      baseOpts({ candidates: [...normal, petOk], companions: ['pet'] }),
    )
    expect(c.items.some((it) => it.place.id === 'pet-ok')).toBe(true)
  })

  it('무장애 여행 — 휠체어 접근 장소가 우선된다', () => {
    const normal = Array.from({ length: 5 }, () => makePlace())
    const wheel = makePlace({ id: 'wheel', accessibility: { wheelchair: true } })
    const c = generateCourse(
      baseOpts({ candidates: [...normal, wheel], companions: ['accessible'] }),
    )
    expect(c.items.some((it) => it.place.id === 'wheel')).toBe(true)
  })
})

// ─── 축제 연계 (FR-16) ──────────────────────────────────────────────────────

describe('generateCourse — 축제 연계', () => {
  const range = { start: '2026-07-03', end: '2026-07-05' }

  it('festival_link — 여행 기간과 겹치는 축제가 코스에 포함된다', () => {
    const candidates = Array.from({ length: 5 }, () => makePlace({ sigunguCode: 11 }))
    const fest = makeFestival({ sigunguCode: 11 })
    const c = generateCourse(
      baseOpts({
        candidates,
        festivals: [fest],
        baseSigungus: [11],
        profiles: ['festival_link'],
        dateRange: range,
      }),
    )
    expect(countCat(c, 'festival')).toBe(1)
  })

  it('기간이 겹치지 않는 축제는 편입되지 않는다', () => {
    const candidates = Array.from({ length: 5 }, () => makePlace({ sigunguCode: 11 }))
    const past = makeFestival({
      sigunguCode: 11,
      eventStartDate: '20260601',
      eventEndDate: '20260610', // 여행 시작(0703) 전에 종료
    })
    const c = generateCourse(
      baseOpts({
        candidates,
        festivals: [past],
        baseSigungus: [11],
        profiles: ['festival_link'],
        dateRange: range,
      }),
    )
    expect(countCat(c, 'festival')).toBe(0)
  })

  it('좌표 (0,0) — Null Island 축제는 제외한다', () => {
    const candidates = Array.from({ length: 5 }, () => makePlace({ sigunguCode: 11 }))
    const nullIsland = makeFestival({ sigunguCode: 11, position: { lat: 0, lng: 0 } })
    const c = generateCourse(
      baseOpts({
        candidates,
        festivals: [nullIsland],
        baseSigungus: [11],
        profiles: ['festival_link'],
        dateRange: range,
      }),
    )
    expect(countCat(c, 'festival')).toBe(0)
  })
})

// ─── 동선 최적화 (FR-18) ────────────────────────────────────────────────────

describe('동선 최적화 — NN + 2-opt', () => {
  it('일직선 배치 장소는 가까운 순서대로 방문한다 (교차 없음)', () => {
    // 입력을 뒤섞어도 거점에서 가까운 순(5→10→15→20km)으로 정렬돼야 한다.
    const d = makePlace({ id: 'D', position: offsetKm(20) })
    const b = makePlace({ id: 'B', position: offsetKm(10) })
    const a = makePlace({ id: 'A', position: offsetKm(5) })
    const cc = makePlace({ id: 'C', position: offsetKm(15) })
    const course = generateCourse(baseOpts({ candidates: [d, b, a, cc] }))
    expect(course.items.map((it) => it.place.id)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('reoptimizeCourse — 뒤섞인 순서를 재최적화해 총거리가 줄어든다', () => {
    const mk = (id: string, km: number): CourseItem => ({
      place: makePlace({ id, position: offsetKm(km) }),
      order: 0,
      distanceFromPrevKm: 0,
    })
    // 의도적으로 지그재그 순서 (D → A → C → B)
    const bad: Course = {
      id: 'c1',
      title: 't',
      baseSigungus: [],
      baseCenter: ANDONG,
      duration: 'day',
      hiddenMode: false,
      items: [mk('D', 20), mk('A', 5), mk('C', 15), mk('B', 10)],
      totalDistanceKm: 0,
      estimatedTravelMinutes: 0,
      createdAt: new Date().toISOString(),
      lang: 'ko',
    }
    const before = recomputeCourse(bad)
    const optimized = reoptimizeCourse(bad)
    expect(optimized.totalDistanceKm).toBeLessThan(before.totalDistanceKm)
    expect(optimized.items.map((it) => it.place.id)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('recomputeCourse — 순서는 유지하고 거리·시간만 재계산한다', () => {
    const mk = (id: string, km: number): CourseItem => ({
      place: makePlace({ id, position: offsetKm(km) }),
      order: 0,
      distanceFromPrevKm: 999, // 틀린 값 — 재계산돼야 함
    })
    const c: Course = {
      id: 'c2',
      title: 't',
      baseSigungus: [],
      baseCenter: ANDONG,
      duration: 'day',
      hiddenMode: false,
      items: [mk('X', 10), mk('Y', 5)],
      totalDistanceKm: 0,
      estimatedTravelMinutes: 0,
      createdAt: new Date().toISOString(),
      lang: 'ko',
    }
    const r = recomputeCourse(c)
    expect(r.items.map((it) => it.place.id)).toEqual(['X', 'Y']) // 순서 보존
    expect(r.items[0].distanceFromPrevKm).toBeCloseTo(10, 0)
    expect(r.items[1].distanceFromPrevKm).toBeCloseTo(5, 0) // Y 는 X 에서 5km 뒤로
    expect(r.estimatedTravelMinutes).toBe(estimateMinutes(r.totalDistanceKm))
  })
})

// ─── 협업 기능 ──────────────────────────────────────────────────────────────

describe('협업 — merge / vote / blend', () => {
  function collabCourse(items: CourseItem[], over: Partial<Course> = {}): Course {
    return {
      id: 'cc',
      title: '협업 코스',
      baseSigungus: [],
      baseCenter: ANDONG,
      duration: 'day',
      hiddenMode: false,
      items,
      totalDistanceKm: 0,
      estimatedTravelMinutes: 0,
      createdAt: new Date().toISOString(),
      lang: 'ko',
      ...over,
    }
  }

  it('mergeCourses — 장소 합집합 + votes 합침 + addedBy 는 base 우선', () => {
    const shared = makePlace({ id: 'shared', position: offsetKm(5) })
    const onlyB = makePlace({ id: 'onlyB', position: offsetKm(10) })
    const base = collabCourse(
      [{ place: shared, order: 1, distanceFromPrevKm: 0, addedBy: 'u1', votes: ['u1'] }],
      { contributors: [{ id: 'u1', name: '가', color: '#f00' }] },
    )
    const incoming = collabCourse(
      [
        { place: shared, order: 1, distanceFromPrevKm: 0, addedBy: 'u2', votes: ['u2'] },
        { place: onlyB, order: 2, distanceFromPrevKm: 0, addedBy: 'u2' },
      ],
      { contributors: [{ id: 'u2', name: '나', color: '#00f' }] },
    )
    const merged = mergeCourses(base, incoming)
    expect(merged.items).toHaveLength(2)
    const sharedItem = merged.items.find((it) => it.place.id === 'shared')!
    expect(sharedItem.addedBy).toBe('u1')
    expect(new Set(sharedItem.votes)).toEqual(new Set(['u1', 'u2']))
    expect(merged.contributors?.map((c) => c.id).sort()).toEqual(['u1', 'u2'])
  })

  it('toggleVote — 하트 켜기/끄기', () => {
    const p = makePlace({ id: 'v1' })
    const c = collabCourse([{ place: p, order: 1, distanceFromPrevKm: 0 }])
    const on = toggleVote(c, 'v1', 'me')
    expect(on.items[0].votes).toEqual(['me'])
    const off = toggleVote(on, 'v1', 'me')
    expect(off.items[0].votes).toBeUndefined()
  })

  it('blendCompanions — 기여자별 동반자 합집합', () => {
    const c = collabCourse([], {
      companionsByContributor: { u1: ['kids', 'parents'], u2: ['kids', 'pet'] },
    })
    expect(new Set(blendCompanions(c))).toEqual(new Set(['kids', 'parents', 'pet']))
  })

  it('blendCompanions — 협업 정보 없으면 빈 배열', () => {
    expect(blendCompanions(collabCourse([]))).toEqual([])
  })
})

// ─── 자동 제목 ──────────────────────────────────────────────────────────────

describe('generateCourse — 자동 제목', () => {
  it('한국어 제목에 거점 시군구명이 들어간다', () => {
    const candidates = Array.from({ length: 4 }, () => makePlace({ sigunguCode: 11 }))
    const c = generateCourse(baseOpts({ candidates, baseSigungus: [11] }))
    expect(c.title).toContain('안동시')
  })

  it('영문 요청 시 영문 시군구명', () => {
    const candidates = Array.from({ length: 4 }, () => makePlace({ sigunguCode: 8 }))
    const c = generateCourse(baseOpts({ candidates, baseSigungus: [8], lang: 'en' }))
    expect(c.title).toContain('Bonghwa')
  })
})
