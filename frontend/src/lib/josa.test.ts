import { describe, it, expect } from 'vitest'
import { josa } from './josa'

describe('josa', () => {
  it('받침이 없으면 뒤 조사를 쓴다', () => {
    expect(josa('안동시', '은', '는')).toBe('는')
    expect(josa('포항시', '은', '는')).toBe('는')
    expect(josa('경주', '이', '가')).toBe('가')
  })

  it('받침이 있으면 앞 조사를 쓴다', () => {
    expect(josa('봉화군', '은', '는')).toBe('은')
    expect(josa('영양군', '은', '는')).toBe('은')
    expect(josa('안동', '이', '가')).toBe('이')
  })

  it('한글이 아니거나 비었으면 받침 없는 쪽으로 떨어진다', () => {
    expect(josa('', '은', '는')).toBe('는')
    expect(josa('Andong', '은', '는')).toBe('는')
    expect(josa('2026', '은', '는')).toBe('는')
  })
})
