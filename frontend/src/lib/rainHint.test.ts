// @vitest-environment node
/**
 * 강수확률 사다리 — 단기(D+0~2) → 중기(D+3~10) → 평년값.
 *
 * 중기예보는 "발표일 기준 +N일"이 곧 필드 이름(rnSt3Am … rnSt10)이라, 날짜 오프셋을 한 칸만
 * 밀려도 엉뚱한 날 예보를 그 날 값인 양 보여 준다. 여기서 그 경계를 고정한다.
 */
import { describe, it, expect } from 'vitest'
import {
  climatologyHint,
  daysBetweenYmd,
  latestMidBaseTime,
  rainHintFromForecast,
  rainHintFromMid,
  type MidLandResponse,
  type VilageResponse,
} from './rainHint'

/** 발표일 +3 ~ +7 은 오전·오후, +8 ~ +10 은 하루 한 값. */
const midBody = (): MidLandResponse => ({
  response: {
    header: { resultCode: '00' },
    body: {
      items: {
        item: [
          {
            regId: '11H10000',
            rnSt3Am: 20, rnSt3Pm: 60,
            rnSt4Am: 30, rnSt4Pm: 30,
            rnSt5Am: 0,  rnSt5Pm: 10,
            rnSt6Am: 40, rnSt6Pm: 40,
            rnSt7Am: 50, rnSt7Pm: 50,
            rnSt8: 70,
            rnSt9: 20,
            rnSt10: 10,
          },
        ],
      },
    },
  },
})

describe('날짜 오프셋', () => {
  it('월 경계를 넘어도 일수를 맞게 센다', () => {
    expect(daysBetweenYmd('20261011', '20261014')).toBe(3)
    expect(daysBetweenYmd('20261030', '20261102')).toBe(3)
    expect(daysBetweenYmd('20261231', '20270103')).toBe(3)
    expect(daysBetweenYmd('20261014', '20261011')).toBe(-3)
  })
})

describe('중기육상예보 발표시각', () => {
  const at = (iso: string) => latestMidBaseTime(new Date(iso))

  it('06:15 이전이면 전날 18시 발표를 쓴다', () => {
    expect(at('2026-10-11T05:00:00')).toEqual({ tmFc: '202610101800', baseYmd: '20261010' })
  })
  it('06:15 이후 18시 전이면 당일 06시 발표', () => {
    expect(at('2026-10-11T09:00:00')).toEqual({ tmFc: '202610110600', baseYmd: '20261011' })
  })
  it('18:15 이후면 당일 18시 발표', () => {
    expect(at('2026-10-11T20:00:00')).toEqual({ tmFc: '202610111800', baseYmd: '20261011' })
  })
  it('발표 직후 15분은 아직 이전 발표 — 빈 응답을 받지 않는다', () => {
    expect(at('2026-10-11T06:05:00').tmFc).toBe('202610101800')
  })
})

describe('중기예보 강수확률', () => {
  const base = '20261011'

  it('오전·오후 중 큰 쪽을 그 날의 강수확률로 본다', () => {
    const h = rainHintFromMid(midBody(), '20261014', base) // +3일
    expect(h).toEqual({ rainChance: 0.6, source: 'mid-forecast', hint: 'rain-likely' })
  })

  it('8일째부터는 오전/오후 구분이 없는 단일 값을 읽는다', () => {
    expect(rainHintFromMid(midBody(), '20261019', base)?.rainChance).toBe(0.7) // +8일
    expect(rainHintFromMid(midBody(), '20261021', base)?.rainChance).toBe(0.1) // +10일
  })

  it('예보 범위(+3~+10) 밖이면 null — 호출부가 평년값으로 내려간다', () => {
    expect(rainHintFromMid(midBody(), '20261013', base)).toBeNull() // +2일 (단기 담당)
    expect(rainHintFromMid(midBody(), '20261022', base)).toBeNull() // +11일
    expect(rainHintFromMid(midBody(), '20261010', base)).toBeNull() // 지난 날
  })

  it('오류 코드·빈 응답은 null', () => {
    expect(rainHintFromMid({ response: { header: { resultCode: '03' } } }, '20261014', base)).toBeNull()
    expect(rainHintFromMid(undefined, '20261014', base)).toBeNull()
    expect(rainHintFromMid({ response: { body: { items: { item: [] } } } }, '20261014', base)).toBeNull()
  })

  it('값이 0 이어도 "없음"으로 취급하지 않는다 — 맑음 예보는 유효한 정보다', () => {
    const h = rainHintFromMid(midBody(), '20261016', base) // +5일: 오전 0 · 오후 10
    expect(h).toEqual({ rainChance: 0.1, source: 'mid-forecast', hint: 'clear' })
  })
})

describe('출처 구분', () => {
  it('단기·중기·평년값이 서로 다른 source 로 표시된다', () => {
    const short: VilageResponse = {
      response: { header: { resultCode: '00' }, body: { items: { item: [{ category: 'POP', fcstDate: '20261012', fcstValue: '40' }] } } },
    }
    expect(rainHintFromForecast(short, '20261012')?.source).toBe('forecast')
    expect(rainHintFromMid(midBody(), '20261014', '20261011')?.source).toBe('mid-forecast')
    expect(climatologyHint(new Date('2026-10-11')).source).toBe('climatology')
  })
})
