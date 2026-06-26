import { describe, it, expect } from 'vitest'
import {
  CATEGORIES,
  CATEGORY_MAP,
  RESTAURANT_CUISINES,
  PROFILE_WEIGHTS,
} from '@/constants/categories'
import { CATEGORY_STAY_MINUTES } from '@/lib/slowIndex'
import type { CategoryId } from '@/types/domain'

const LANGS = ['ko', 'en', 'ja', 'zh'] as const

describe('카테고리 탐색 — 카테고리 정의', () => {
  it('맛집(restaurant) 카테고리가 음식점 contentTypeId=39 로 등록돼 있다', () => {
    const r = CATEGORY_MAP['restaurant']
    expect(r).toBeDefined()
    expect(r.contentTypeIds).toContain(39)
  })

  it('축제는 contentTypeId=15 로 등록돼 있다', () => {
    expect(CATEGORY_MAP['festival'].contentTypeIds).toContain(15)
  })

  it('모든 카테고리가 4개 언어 라벨 + 이모지를 갖는다', () => {
    for (const c of CATEGORIES) {
      for (const l of LANGS) expect(c.label[l], `${c.id}.${l}`).toBeTruthy()
      expect(c.emoji, c.id).toBeTruthy()
    }
  })

  it('CATEGORY_MAP 이 모든 CATEGORIES 를 포함한다', () => {
    for (const c of CATEGORIES) expect(CATEGORY_MAP[c.id]).toBe(c)
  })

  it('카테고리 id 는 중복이 없다', () => {
    const ids = CATEGORIES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('카테고리 탐색 — 맛집 음식 종류(cuisine)', () => {
  it('음식 종류 태그가 5종이고 모두 A0502 계열 cat3 코드다', () => {
    expect(RESTAURANT_CUISINES.length).toBe(5)
    for (const cz of RESTAURANT_CUISINES) {
      expect(cz.cat3, cz.label.ko).toMatch(/^A0502\d{4}$/)
      for (const l of LANGS) expect(cz.label[l], `${cz.cat3}.${l}`).toBeTruthy()
    }
  })

  it('한식 cat3 가 A05020100 이다', () => {
    const korean = RESTAURANT_CUISINES.find((c) => c.label.ko === '한식')
    expect(korean?.cat3).toBe('A05020100')
  })

  it('cuisine cat3 는 중복이 없다', () => {
    const codes = RESTAURANT_CUISINES.map((c) => c.cat3)
    expect(new Set(codes).size).toBe(codes.length)
  })
})

describe('카테고리 탐색 — 코스 엔진 통합(맛집 포함)', () => {
  it('모든 코스 프로파일 가중치에 restaurant 가 숫자로 정의돼 있다', () => {
    for (const [profile, w] of Object.entries(PROFILE_WEIGHTS)) {
      expect(typeof w.restaurant, profile).toBe('number')
    }
  })

  it('체류시간 표에 모든 카테고리(restaurant 포함)가 있다', () => {
    for (const c of CATEGORIES) {
      expect(typeof CATEGORY_STAY_MINUTES[c.id as CategoryId], c.id).toBe('number')
    }
  })
})
