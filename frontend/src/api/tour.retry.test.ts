// @vitest-environment node
/**
 * 관광 API 재시도 정책.
 *
 * 일시적 실패(업스트림 5xx·타임아웃)는 물러섰다 다시 부르고,
 * 한도 초과·권한 문제는 다시 불러도 결과가 같으므로 한 번에 포기한다 —
 * 재시도하면 남은 한도만 더 태운다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))
vi.mock('axios', () => ({ default: { create: () => ({ get: getMock }) } }))

import { searchPlaces } from './tour'

const BATCH_PREFIX = '/api/tour-batch?reqs='

/** 게이트웨이가 200 과 함께 주는 실패 응답 (returnReasonCode) */
const gateway = (code: string) => ({
  OpenAPI_ServiceResponse: { cmmMsgHeader: { returnReasonCode: code, errMsg: 'x' } },
})
const okBody = {
  response: { header: { resultCode: '0000', resultMsg: 'OK' }, body: { items: { item: [] }, totalCount: 0 } },
}

let attempts: number

/**
 * 전송 형태를 실제와 맞춘다 — 단건은 axios 가 JSON 을 파싱해 객체로 주고,
 * 배치(api/proxy.ts)는 [{status, body:"<json 문자열>"}] 로 준다.
 * body 를 문자열로 주면 평문 오류 응답(예: "Forbidden")을 흉내 낸다.
 */
function answerWith(reply: (n: number) => { status: number; body: unknown }) {
  getMock.mockImplementation(async (url: string) => {
    const n = ++attempts
    const r = reply(n)
    const asText = typeof r.body === 'string' ? r.body : JSON.stringify(r.body)
    if (url.startsWith(BATCH_PREFIX)) {
      const reqs = JSON.parse(decodeURIComponent(url.slice(BATCH_PREFIX.length))) as unknown[]
      return { status: 200, data: reqs.map(() => ({ status: r.status, body: asText })) }
    }
    return { status: r.status, data: r.body }
  })
}

beforeEach(() => {
  attempts = 0
  getMock.mockReset()
})

/** 캐시가 끼면 두 번째 테스트가 첫 번째 결과를 물려받는다 — 시군 코드를 매번 달리해 키를 분리한다. */
let sg = 100
const nextSigungu = () => ++sg

describe('관광 API 재시도', () => {
  it('업스트림 5xx 는 물러섰다 다시 불러 성공시킨다', async () => {
    answerWith((n) => (n < 3 ? { status: 503, body: 'upstream down' } : { status: 200, body: okBody }))
    const r = await searchPlaces({ lang: 'ko', sigunguCode: nextSigungu() })
    expect(attempts).toBe(3) // 최초 1 + 재시도 2
    expect(r.error).toBeUndefined()
  })

  it('계속 실패해도 정해진 횟수까지만 부른다 — 무한 재시도 금지', async () => {
    answerWith(() => ({ status: 503, body: 'still down' }))
    const r = await searchPlaces({ lang: 'ko', sigunguCode: nextSigungu() })
    expect(attempts).toBe(3)
    expect(r.error).toBe('network')
  })

  it('한도 초과(22)는 재시도하지 않는다 — 남은 한도를 더 태우면 안 된다', async () => {
    answerWith(() => ({ status: 200, body: gateway('22') }))
    const r = await searchPlaces({ lang: 'ko', sigunguCode: nextSigungu() })
    expect(attempts).toBe(1)
    expect(r.error).toBe('quota')
  })

  it('활용기간 만료(31)도 한도와 같이 다룬다', async () => {
    answerWith(() => ({ status: 200, body: gateway('31') }))
    const r = await searchPlaces({ lang: 'ko', sigunguCode: nextSigungu() })
    expect(attempts).toBe(1)
    expect(r.error).toBe('quota')
  })

  it('키 미등록(30)은 재시도하지 않고 noKey 로 분류한다', async () => {
    answerWith(() => ({ status: 200, body: gateway('30') }))
    const r = await searchPlaces({ lang: 'ko', sigunguCode: nextSigungu() })
    expect(attempts).toBe(1)
    expect(r.error).toBe('noKey')
  })

  it('활용신청 누락(403)은 재시도하지 않고 forbidden 으로 분류한다', async () => {
    answerWith(() => ({ status: 403, body: 'Forbidden' }))
    const r = await searchPlaces({ lang: 'ko', sigunguCode: nextSigungu() })
    expect(attempts).toBe(1)
    expect(r.error).toBe('forbidden')
  })
})
