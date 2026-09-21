import { describe, it, expect } from 'vitest'
import { splitMinutes, formatDuration, formatDurationParts } from '@/lib/duration'

// 실제 i18n 대신 ko 문구만 흉내낸다.
const t = (k: string, o?: Record<string, unknown>) =>
  k === 'course.min' ? '분'
  : k === 'course.hourOnly' ? `${o!.h}시간`
  : k === 'course.hourMin' ? `${o!.h}시간 ${o!.m}분`
  : k

describe('이동시간 표기', () => {
  it('60분 미만은 분으로 둔다', () => {
    expect(formatDuration(45, t)).toBe('45분')
    expect(formatDurationParts(45, t)).toEqual({ value: '45', unit: '분' })
  })
  it('실제 코스 값이 시간으로 읽힌다', () => {
    expect(formatDuration(326, t)).toBe('5시간 26분')
    expect(formatDuration(727, t)).toBe('12시간 7분')
  })
  it('정각이면 분을 붙이지 않는다', () => {
    expect(formatDuration(120, t)).toBe('2시간')
  })
  it('0·음수·NaN 은 0분', () => {
    expect(formatDuration(0, t)).toBe('0분')
    expect(formatDuration(-5, t)).toBe('0분')
    expect(formatDuration(Number.NaN, t)).toBe('0분')
  })
  it('splitMinutes 는 반올림해 쪼갠다', () => {
    expect(splitMinutes(90.4)).toEqual({ h: 1, m: 30 })
  })
})
