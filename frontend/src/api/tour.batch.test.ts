// @vitest-environment node
/**
 * callTour 요청 배칭 계약 — 동시 호출은 /api/tour-batch 한 건으로, 단건은 개별 URL 로,
 * 배치 엔드포인트가 죽으면 개별 호출로 폴백한다. (api/proxy.ts 의 배치 응답 포맷 [{status, body}] 기준)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))
vi.mock('axios', () => ({ default: { create: () => ({ get: getMock }) } }))

import { searchPlaces } from './tour'

const BATCH_PREFIX = '/api/tour-batch?reqs='

function tourBody(contentid: string) {
  return {
    response: {
      header: { resultCode: '0000', resultMsg: 'OK' },
      body: {
        items: {
          item: [
            { contentid, contenttypeid: '12', title: `T-${contentid}`, mapx: '129.1', mapy: '36.1', cat3: 'A02010800' },
          ],
        },
        totalCount: 1,
      },
    },
  }
}

function parseBatchUrl(url: string): Array<{ path: string; query: Record<string, string> }> {
  return JSON.parse(decodeURIComponent(url.slice(BATCH_PREFIX.length)))
}

/** 배치는 c-<sigungu>, 개별은 d-<sigungu> 로 응답해 어느 경로로 왔는지 결과에서 구분한다. */
function answerBoth(batchStatus = 200) {
  getMock.mockImplementation(async (url: string) => {
    if (url.startsWith(BATCH_PREFIX)) {
      if (batchStatus !== 200) return { status: batchStatus, data: '<html>not found</html>' }
      const reqs = parseBatchUrl(url)
      return {
        status: 200,
        data: reqs.map((r) => ({ status: 200, body: JSON.stringify(tourBody(`c-${r.query.sigunguCode}`)) })),
      }
    }
    const u = new URL(url, 'http://x')
    return { status: 200, data: tourBody(`d-${u.searchParams.get('sigunguCode')}`) }
  })
}

beforeEach(() => {
  getMock.mockReset()
})

describe('callTour 배칭', () => {
  it('동시 호출은 /api/tour-batch 한 건으로 묶고, 요청은 정렬돼 URL 이 안정적이다', async () => {
    answerBoth()
    const codes = [6, 2, 4]
    const results = await Promise.all(
      codes.map((c) => searchPlaces({ sigunguCode: c, category: 'temple', lang: 'ko', numOfRows: 30 })),
    )

    expect(getMock).toHaveBeenCalledTimes(1)
    const url = getMock.mock.calls[0][0] as string
    expect(url.startsWith(BATCH_PREFIX)).toBe(true)
    const reqs = parseBatchUrl(url)
    expect(reqs.map((r) => r.path)).toEqual(Array(3).fill('KorService2/areaBasedList2'))
    expect(reqs.map((r) => r.query.sigunguCode)).toEqual(['2', '4', '6'])
    expect(reqs[0].query).toMatchObject({ MobileOS: 'ETC', MobileApp: 'Shimmaru', _type: 'json', areaCode: '35' })

    // 각 호출자는 자기 요청의 응답을 받는다 (정렬로 순서가 바뀌어도 매핑이 유지된다).
    results.forEach((r, i) => expect(r.items.map((p) => p.id)).toEqual([`c-${codes[i]}`]))
  })

  it('단건은 배치 대신 개별 URL 로 보낸다 (엣지 캐시 히트율 유지)', async () => {
    answerBoth()
    const r = await searchPlaces({ sigunguCode: 8, category: 'temple', lang: 'ko', numOfRows: 30 })

    expect(getMock).toHaveBeenCalledTimes(1)
    const url = getMock.mock.calls[0][0] as string
    expect(url.startsWith('/api/tour/KorService2/areaBasedList2?')).toBe(true)
    expect(r.items.map((p) => p.id)).toEqual(['d-8'])
  })

  it('배치 엔드포인트가 실패하면 개별 호출로 폴백해 결과를 채운다', async () => {
    answerBoth(404)
    const codes = [10, 12]
    const results = await Promise.all(
      codes.map((c) => searchPlaces({ sigunguCode: c, category: 'temple', lang: 'ko', numOfRows: 30 })),
    )

    const urls = getMock.mock.calls.map((c) => c[0] as string)
    expect(urls.filter((u) => u.startsWith(BATCH_PREFIX))).toHaveLength(1)
    expect(urls.filter((u) => u.startsWith('/api/tour/'))).toHaveLength(2)
    results.forEach((r, i) => expect(r.items.map((p) => p.id)).toEqual([`d-${codes[i]}`]))
  })
})
