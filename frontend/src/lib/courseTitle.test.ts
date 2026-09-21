import { describe, it, expect, vi } from 'vitest'
vi.mock('@/api/tour', () => ({ isoToYmd: (s: string) => s.replaceAll('-', '') }))
vi.mock('@/lib/visitorIndex', () => ({ visitorBoostFor: () => undefined }))
import { generateCourse } from '@/lib/courseEngine'
import type { CategoryId, LatLng, Place } from '@/types/domain'

const P: LatLng = { lat: 36.57, lng: 128.73 }
let n = 0
const place = (sig: number): Place => ({
  id: `p${++n}`, contentTypeId: 12, category: 'hanok' as CategoryId, name: `장소${n}`,
  address: '경북', position: P, sigunguCode: sig,
}) as Place

describe('코스 자동 제목', () => {
  it('시군 접미사를 떼고 프로필을 뒤에 붙인다', () => {
    const c = generateCourse({
      candidates: [place(15), place(11), place(2)], festivals: [],
      baseSigungus: [15, 11, 2], baseCenter: P, duration: '1n2d',
      profiles: ['hanok_emotion'], lang: 'ko',
    })
    console.log('  ko:', c.title)
    expect(c.title).toBe('영천·안동·경주 한옥의 결')
  })
  it('거점이 없으면 경북으로 떨어진다', () => {
    const c = generateCourse({
      candidates: [place(11)], festivals: [], baseSigungus: [], baseCenter: P,
      duration: 'day', profiles: ['hidden_gb'], lang: 'ko',
    })
    console.log('  fallback:', c.title)
    expect(c.title).toBe('한적한 경북')
  })
  it('영문은 프로필이 앞에 온다', () => {
    const c = generateCourse({
      candidates: [place(11)], festivals: [], baseSigungus: [11], baseCenter: P,
      duration: 'day', profiles: ['hanok_emotion'], lang: 'en',
    })
    console.log('  en:', c.title)
    expect(c.title).toBe('Hanok Lines · Andong')
  })
})
