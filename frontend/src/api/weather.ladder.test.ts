// @vitest-environment node
/**
 * 강수확률 조회 사다리 — 단기(D+0~2) → 중기(D+3~10) → 평년값.
 *
 * 단기만 쓰던 시절 "이번 주말"은 월·화·수에 늘 평년값으로 떨어졌다(토요일이 D+3~D+5라 범위 밖).
 * 각 단계가 제 차례에만 쓰이는지, 그리고 아래 단계로 내려갈 때 윗단계를 건너뛰지 않는지 고정한다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('@/lib/cache', () => ({
  // 캐시는 여기서 검증 대상이 아니다 — 매번 실제 조회가 일어나게 통과시킨다.
  cachedFetch: async <T>(_key: string, fn: () => Promise<T>) => fn(),
}))

import { fetchRainChance } from './weather'
import { latestMidBaseTime, ymd } from '@/lib/rainHint'

const BONGHWA = 8
const NOW = new Date('2026-10-12T09:00:00+09:00') // 월요일 오전

/**
 * 중기예보 항목은 "발표일 +N일"이라 기대값도 발표일에서 세야 한다.
 * 실행 환경의 시간대에 따라 가장 최근 발표가 전날 18시일 수 있어, 달력 날짜로 세면 한 칸 어긋난다.
 * (발표시각·오프셋 계산 자체는 lib/rainHint.test.ts 가 명시적인 시각으로 따로 고정한다.)
 */
const fromMidBase = (dayOffset: number) => {
  const b = latestMidBaseTime(NOW).baseYmd
  const d = new Date(Number(b.slice(0, 4)), Number(b.slice(4, 6)) - 1, Number(b.slice(6, 8)) + dayOffset)
  return { ymd: ymd(d), date: d }
}
/** 단기예보가 덮는 날 — 오늘 기준으로 세면 된다. */
const plusDays = (n: number) => {
  const d = new Date(NOW)
  d.setDate(d.getDate() + n)
  return { ymd: ymd(d), date: d }
}

const okShort = (fcstDate: string) => ({
  response: { header: { resultCode: '00' }, body: { items: { item: [{ category: 'POP', fcstDate, fcstValue: '35' }] } } },
})
const okMid = {
  response: {
    header: { resultCode: '00' },
    body: { items: { item: [{ regId: '11H10000',
      rnSt3Am: 20, rnSt3Pm: 60, rnSt4Am: 30, rnSt4Pm: 30, rnSt5Am: 10, rnSt5Pm: 80,
      rnSt6Am: 40, rnSt6Pm: 40, rnSt7Am: 0, rnSt7Pm: 0 }] } },
  },
}

let calls: string[]
/** 경로별 응답을 지정한다. 값이 없으면 그 엔드포인트는 실패(502)로 둔다. */
function serve(short?: unknown, mid?: unknown) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url.split('?')[0])
    const body = url.startsWith('/api/weather-mid') ? mid : short
    if (body === undefined) return new Response('upstream down', { status: 502 })
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
}

beforeEach(() => {
  calls = []
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('강수확률 사다리', () => {
  it('단기예보가 대상일을 덮으면 거기서 끝낸다 — 중기를 부르지 않는다', async () => {
    const target = plusDays(1)
    serve(okShort(target.ymd), okMid)
    const h = await fetchRainChance(BONGHWA, target.date)
    expect(h).toEqual({ rainChance: 0.35, source: 'forecast', hint: 'unstable' })
    expect(calls).toEqual(['/api/weather'])
  })

  it('단기 범위 밖이면 중기예보로 넘어간다 — 월~수의 주말이 이 경로다', async () => {
    const target = fromMidBase(5)
    serve(okShort(plusDays(1).ymd), okMid) // 단기 응답에 대상일이 없다
    const h = await fetchRainChance(BONGHWA, target.date)
    expect(h?.source).toBe('mid-forecast')
    expect(h?.rainChance).toBe(0.8) // rnSt5Am 10 · rnSt5Pm 80 → 큰 쪽
    expect(calls).toEqual(['/api/weather', '/api/weather-mid'])
  })

  it('단기 호출이 실패해도 중기로 내려간다 — 한 단계 실패로 평년값까지 떨어지지 않는다', async () => {
    const target = fromMidBase(4)
    serve(undefined, okMid) // 단기 502
    const h = await fetchRainChance(BONGHWA, target.date)
    expect(h?.source).toBe('mid-forecast')
    expect(h?.rainChance).toBe(0.3)
  })

  it('중기도 못 받으면 평년값 — 그때만 상수를 쓴다', async () => {
    const target = fromMidBase(5)
    serve(okShort(plusDays(1).ymd), undefined) // 중기 502 (미신청 포함)
    const h = await fetchRainChance(BONGHWA, target.date)
    expect(h.source).toBe('climatology')
    expect(calls).toEqual(['/api/weather', '/api/weather-mid'])
  })

  it('열흘을 넘는 코스 날짜는 예보가 없어 평년값으로 간다', async () => {
    const target = plusDays(20)
    serve(okShort(plusDays(1).ymd), okMid) // 중기 응답은 있지만 +20일 항목이 없다
    const h = await fetchRainChance(BONGHWA, target.date)
    expect(h.source).toBe('climatology')
  })

  it('모르는 시군이면 조회 없이 평년값', async () => {
    serve(okShort(plusDays(1).ymd), okMid)
    const h = await fetchRainChance(999, fromMidBase(5).date)
    expect(h.source).toBe('climatology')
    expect(calls).toEqual([])
  })
})
