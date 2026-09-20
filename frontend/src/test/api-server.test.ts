// @vitest-environment node
/**
 * 서버 함수(api/*.ts) 회귀 테스트 — fetch 를 스텁해 업스트림(TourAPI·기상청)과 Supabase(PostgREST)를 흉내 낸다.
 *
 * api/ 는 Vercel 이 별도 설정으로 타입 검사하고 프런트 번들에는 실리지 않아, 여기서 한 번이라도 실행해 두지 않으면
 * import 경로(.js 확장자)나 응답 형태가 깨져도 배포 전에 드러나지 않는다. vitest(Vite 해석기)로 돌린다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handle as proxy } from '../../../api/proxy'
import { handle as syncPlaces } from '../../../api/sync-places'
import { handle as course } from '../../../api/course'
import { handle as courses } from '../../../api/courses'
import { handle as admin } from '../../../api/admin'
import { resetStateCache } from '../../../api/_lib/places-db'

const DB = 'https://db.example.supabase.co'
const ORIGIN = 'https://shimmaru.vercel.app'
type Env = Record<string, string | undefined>
const ENV: Env = { TOUR_API_KEY: 'TKEY', SUPABASE_URL: DB, SUPABASE_SERVICE_ROLE_KEY: 'SRK' }

const place = (id: string, ct: number, title: string, lng: number, lat: number, sg: number, cat3 = '') => ({
  contentid: id, contenttypeid: String(ct), title, mapx: String(lng), mapy: String(lat),
  sigungucode: String(sg), areacode: '35', cat3, addr1: '경상북도',
})
const RAW = [
  place('p1', 12, '불국사', 129.332, 35.79, 2, 'A02010800'),
  place('p2', 32, '경주 한옥스테이', 129.215, 35.836, 2, 'B02011600'),
  place('p3', 38, '성동시장', 129.216, 35.845, 2, 'A04010200'),
  place('p4', 12, '옥산서원', 129.15, 35.96, 2),
  place('p5', 12, '대릉원', 129.213, 35.838, 2),
  place('p6', 32, '경주 글램핑장', 129.3, 35.8, 2, 'B02010600'), // 숙박인데 한옥 아님 → 제외
  place('p7', 12, '좌표없음', 0, 0, 2), // 좌표 없음 → 제외
]
// 서버는 KST 벽시계로 예보 대상일·축제 기간을 계산한다 — 실행 시점과 무관하게 매칭되도록 오늘로 맞춘다.
const kstNow = new Date(Date.now() + (9 * 60 + new Date().getTimezoneOffset()) * 60 * 1000)
const pad2 = (n: number) => String(n).padStart(2, '0')
const TODAY_YMD = `${kstNow.getFullYear()}${pad2(kstNow.getMonth() + 1)}${pad2(kstNow.getDate())}`
const TODAY_ISO = `${kstNow.getFullYear()}-${pad2(kstNow.getMonth() + 1)}-${pad2(kstNow.getDate())}`

const STD_ROWS = [
  { fstvlNm: '경주 축제', fstvlStartDate: TODAY_ISO, fstvlEndDate: TODAY_ISO, insttNm: '경상북도 경주시', latitude: '35.84', longitude: '129.21', rdnmadr: '경상북도 경주시' },
  { fstvlNm: '서울 축제', fstvlStartDate: TODAY_ISO, fstvlEndDate: TODAY_ISO, insttNm: '서울특별시', rdnmadr: '서울' },
]

let calls: Array<{ url: string; method: string; body?: string }>
let syncedSigungus: number[]
const savedRows = new Map<string, { client_id: string; course_id: string; course: unknown }>()

beforeEach(() => {
  calls = []
  syncedSigungus = [2]
  savedRows.clear()
  resetStateCache()
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const u = new URL(String(url))
    const method = init.method ?? 'GET'
    calls.push({ url: String(url), method, body: init.body as string | undefined })

    if (u.host === 'db.example.supabase.co') {
      if (u.pathname.endsWith('/tour_sync_state')) {
        return Response.json(syncedSigungus.map((c) => ({ lang: 'ko', sigungucode: c, synced_at: new Date().toISOString(), item_count: 7 })))
      }
      if (u.pathname.endsWith('/tour_places')) {
        const rows = RAW.map((raw) => ({ raw }))
        const offset = Number(u.searchParams.get('offset') ?? 0)
        return new Response(JSON.stringify(offset === 0 ? rows : []), {
          status: 200,
          headers: { 'content-type': 'application/json', 'content-range': `0-${rows.length - 1}/${rows.length}` },
        })
      }
      if (u.pathname.endsWith('/saved_courses')) {
        if (method === 'GET') {
          const rows = [...savedRows.values()]
          // client_id 필터가 없는 조회는 운영 집계(api/admin) — 전체를 최신순으로 읽어 간다.
          const raw = u.searchParams.get('client_id')
          if (!raw) return Response.json(rows.map((r) => ({ client_id: r.client_id, updated_at: `${TODAY_ISO}T00:00:00Z`, course: r.course })))
          const cid = raw.replace('eq.', '')
          return Response.json(rows.filter((r) => r.client_id === cid).map((r) => ({ course: r.course })))
        }
        if (method === 'POST') {
          for (const r of JSON.parse(String(init.body))) savedRows.set(`${r.client_id}/${r.course_id}`, r)
          return new Response(null, { status: 201 })
        }
        if (method === 'DELETE') {
          const cid = (u.searchParams.get('client_id') ?? '').replace('eq.', '')
          const id = (u.searchParams.get('course_id') ?? '').replace('eq.', '')
          savedRows.delete(`${cid}/${id}`)
          return new Response(null, { status: 204 })
        }
      }
      return new Response('unexpected db path', { status: 500 })
    }
    if (u.pathname === '/api/festival-std') {
      return Response.json({ response: { header: { resultCode: '00' }, body: { items: { item: u.searchParams.get('pageNo') === '1' ? STD_ROWS : [] } } } })
    }
    if (u.pathname === '/api/weather') {
      return Response.json({ response: { header: { resultCode: '00' }, body: { items: { item: [{ category: 'POP', fcstDate: TODAY_YMD, fcstValue: '80' }] } } } })
    }
    if (u.host === 'apis.data.go.kr') {
      return Response.json({ response: { header: { resultCode: '0000', resultMsg: 'OK' }, body: { items: { item: [place('up1', 12, 'UP', 129.1, 36.1, 4)] }, totalCount: 1 } } })
    }
    throw new Error(`unexpected fetch ${url}`)
  })
})
afterEach(() => vi.unstubAllGlobals())

const upstreamCalls = () => calls.filter((c) => c.url.includes('apis.data.go.kr'))
const tour = (qs: string, env: Env = ENV) =>
  proxy(new Request(`${ORIGIN}/api/proxy?svc=tour&${qs}`), env)
const BASE = 'MobileOS=ETC&MobileApp=Shimmaru&_type=json&areaCode=35'

describe('api/proxy — 통합 프록시', () => {
  it('미지원 서비스와 경로 이탈을 거부한다', async () => {
    expect((await proxy(new Request(`${ORIGIN}/api/proxy?svc=nope`), ENV)).status).toBe(400)
    expect((await tour(`path=${encodeURIComponent('../evil')}`)).status).toBe(400)
  })

  it('DB 미설정이면 serviceKey 를 주입해 TourAPI 로 포워딩한다', async () => {
    const r = await tour(`path=KorService2/areaBasedList2&${BASE}&sigunguCode=2&arrange=A`, { TOUR_API_KEY: 'TKEY' })
    expect(r.status).toBe(200)
    const target = new URL(upstreamCalls()[0].url)
    expect(target.pathname).toBe('/B551011/KorService2/areaBasedList2')
    expect(target.searchParams.get('serviceKey')).toBe('TKEY')
    expect(r.headers.get('cache-control')).toContain('s-maxage=300')
  })

  it('적재된 시군은 DB 에서, 미적재 시군은 업스트림에서 응답한다', async () => {
    const synced = await tour(`path=KorService2/areaBasedList2&${BASE}&sigunguCode=2&arrange=A&numOfRows=30`)
    const body = await synced.json()
    expect(body.response.header.resultCode).toBe('0000')
    expect(upstreamCalls()).toHaveLength(0)

    await tour(`path=KorService2/areaBasedList2&${BASE}&sigunguCode=4&arrange=A`)
    expect(upstreamCalls()).toHaveLength(1)
  })

  it('배치는 요청 순서를 유지한 [{status, body}] 배열을 돌려준다', async () => {
    const reqs = [
      { path: 'KorService2/areaBasedList2', query: { areaCode: '35', sigunguCode: '4', arrange: 'A' } },
      { path: '../evil', query: {} },
    ]
    const r = await tour(`reqs=${encodeURIComponent(JSON.stringify(reqs))}`)
    const body = await r.json()
    expect(body.map((x: { status: number }) => x.status)).toEqual([200, 400])
  })
})

describe('api/sync-places — 장소 적재', () => {
  it('CRON_SECRET 없이 운영 호스트에서 호출하면 거부한다', async () => {
    expect((await syncPlaces(new Request(`${ORIGIN}/api/sync-places`), ENV)).status).toBe(401)
  })

  it('강제 동기화하면 콘텐츠 타입별로 받아 upsert 하고 상태를 기록한다', async () => {
    const r = await syncPlaces(
      new Request(`${ORIGIN}/api/sync-places?sigungu=4&force=1`, { headers: { authorization: 'Bearer S' } }),
      { ...ENV, CRON_SECRET: 'S' },
    )
    expect(r.status).toBe(200)
    const body = await r.json()
    expect(body.done).toEqual([expect.objectContaining({ sigungu: 4, items: 1 })])
    expect(upstreamCalls()).toHaveLength(8) // 콘텐츠 타입 8종
    expect(calls.some((c) => c.method === 'POST' && c.url.includes('tour_sync_state'))).toBe(true)
  })
})

describe('api/course — 서버 코스 생성', () => {
  const base = { sigunguCodes: [2], profiles: ['hanok_emotion'], duration: 'day', lang: 'ko', dateRange: { start: TODAY_ISO, end: TODAY_ISO } }
  const post = (body: unknown, env: Env = ENV) =>
    course(new Request(`${ORIGIN}/api/course`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), env)

  it('잘못된 요청을 400 으로 막는다', async () => {
    expect((await course(new Request(`${ORIGIN}/api/course`), ENV)).status).toBe(405)
    expect((await post({ ...base, sigunguCodes: [99] })).status).toBe(400)
    expect((await post({ ...base, duration: 'week' })).status).toBe(400)
    expect((await post({ ...base, dateRange: { start: '2026-09-27', end: '2026-09-26' } })).status).toBe(400) // start > end
  })

  it('준비되지 않은 경우 사유와 함께 503 을 돌려준다', async () => {
    expect(await (await post(base, { TOUR_API_KEY: 'k' })).json()).toMatchObject({ reason: 'db-not-configured' })
    expect(await (await post({ ...base, companions: ['pet'] })).json()).toMatchObject({ reason: 'companion-sources' })
    expect(await (await post({ ...base, sigunguCodes: [4] })).json()).toMatchObject({ reason: 'not-synced', missing: [4] })
  })

  it('DB 후보로 코스를 만들고 업스트림을 직접 부르지 않는다', async () => {
    const r = await post(base)
    expect(r.status).toBe(200)
    expect(r.headers.get('x-shimmaru-source')).toBe('server')
    const { course: c, meta } = await r.json()
    expect(meta.candidates).toBe(5) // 글램핑·좌표없음 제외
    expect(meta.festivals).toBe(1) // 경북 축제만
    expect(meta.rainHint).toBe('rain-likely') // POP 80
    expect(c.items.length).toBeGreaterThanOrEqual(3)
    expect(c.items.every((it: { place: { position: { lat: number } } }) => it.place.position.lat > 0)).toBe(true)
    expect(upstreamCalls()).toHaveLength(0)
  })
})

describe('api/courses — 저장 코스', () => {
  const C = 'c1a2b3c4-d5e6-4f70-8a9b-0c1d2e3f4a5b'
  const req = (method: string, qs = '', body?: unknown) =>
    courses(new Request(`${ORIGIN}/api/courses${qs}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }), ENV)

  it('DB 미설정이면 503 not-ready 로 알린다', async () => {
    const r = await courses(new Request(`${ORIGIN}/api/courses?client=${C}`), { TOUR_API_KEY: 'k' })
    expect(r.status).toBe(503)
  })

  it('저장·조회·삭제하고 클라이언트끼리 격리한다', async () => {
    expect((await req('PUT', '', { client: C, course: { id: 'x' } })).status).toBe(400) // items 필수
    expect((await req('PUT', '', { client: C, course: { id: 'c-1', items: [] } })).status).toBe(200)
    expect((await req('PUT', '', { client: 'other-client-01', course: { id: 'c-2', items: [] } })).status).toBe(200)

    expect((await (await req('GET', `?client=${C}`)).json()).courses).toHaveLength(1)
    await req('DELETE', `?client=${C}&id=c-1`)
    expect((await (await req('GET', `?client=${C}`)).json()).courses).toHaveLength(0)
    expect((await (await req('GET', '?client=other-client-01')).json()).courses).toHaveLength(1)
  })
})

describe('api/admin — 운영자 로그인·집계', () => {
  const PW = 'shimmaru-admin-2026'
  const AENV: Env = { ...ENV, ADMIN_PASSWORD: PW }
  const CLIENT = 'a1a2b3c4-d5e6-4f70-8a9b-0c1d2e3f4a5b'
  const COURSE = {
    id: 'c-admin-1',
    lang: 'ko',
    profile: 'hanok_emotion',
    items: [{ place: { sigunguCode: 2, category: 'hanok' } }],
  }

  const call = (action: string, init: RequestInit = {}, env: Env = AENV) =>
    admin(new Request(`${ORIGIN}/api/admin?action=${action}`, init), env)
  const login = (password: string, env: Env = AENV) =>
    call('login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) }, env)
  const get = (action: string, cookie = '', env: Env = AENV) =>
    call(action, { headers: cookie ? { cookie } : {} }, env)
  /** Set-Cookie 헤더에서 브라우저가 되돌려 보낼 `이름=값` 부분만 꺼낸다. */
  const cookieOf = (res: Response) => (res.headers.get('set-cookie') ?? '').split(';')[0]

  it('비밀번호가 없거나 짧으면 기능 자체를 켜지 않는다', async () => {
    expect((await get('session', '', ENV)).status).toBe(503)
    expect(await (await get('session', '', ENV)).json()).toMatchObject({ reason: 'admin-password-not-set' })
    expect(await (await get('session', '', { ...ENV, ADMIN_PASSWORD: 'short-one' })).json())
      .toMatchObject({ reason: 'admin-password-too-short' })
  })

  it('틀린 비밀번호는 쿠키 없이 401 로 막는다', async () => {
    const r = await login('not-the-password')
    expect(r.status).toBe(401)
    expect(r.headers.get('set-cookie')).toBeNull()
  })

  it('쿠키가 없거나 위조되면 통계를 주지 않는다', async () => {
    expect((await get('stats')).status).toBe(401)
    expect((await get('stats', 'sm_admin=v1.99999999999999.forged')).status).toBe(401)
  })

  it('로그인하면 서명 쿠키를 발급하고 저장 코스를 집계한다', async () => {
    await courses(
      new Request(`${ORIGIN}/api/courses`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ client: CLIENT, course: COURSE }),
      }),
      ENV,
    )

    const ok = await login(PW)
    expect(ok.status).toBe(200)
    const header = ok.headers.get('set-cookie') ?? ''
    expect(header).toContain('HttpOnly')
    expect(header).toContain('SameSite=Strict')
    expect(header).toContain('Secure') // ORIGIN 이 https — dev(http)에서는 붙지 않는다

    const cookie = cookieOf(ok)
    expect((await get('session', cookie)).status).toBe(200)

    const stats = await (await get('stats', cookie)).json()
    expect(stats).toMatchObject({
      courses: 1,
      clients: 1,
      places: 1,
      sampled: false,
      byLang: [['ko', 1]],
      byProfile: [['hanok_emotion', 1]],
      byRegion: [['2', 1]],
      byCategory: [['hanok', 1]],
    })

    // DB 가 없으면 인증과 무관하게 집계만 503 — 프런트는 이 사유로 로컬 통계 화면을 띄운다.
    expect(await (await get('stats', cookie, { ADMIN_PASSWORD: PW })).json())
      .toMatchObject({ reason: 'db-not-configured' })

    const out = await call('logout', { method: 'POST', headers: { cookie } })
    expect(out.headers.get('set-cookie')).toContain('Max-Age=0')
    expect((await get('stats', 'sm_admin=')).status).toBe(401)
  })
})
