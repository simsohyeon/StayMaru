/**
 * Vercel Edge Function — 외부 API 통합 프록시.
 *
 * 기존 tour / festival-std / weather / templestay 4개 함수는 "쿼리 옮기고 serviceKey 주입하고
 * 캐시 헤더 붙이기"가 전부라 설정값만 달랐다. 서비스 테이블 하나로 합쳐 정책(키 주입·캐시·헤더)을
 * 한 곳에서 관리한다.
 *
 * 호출 (vercel.json rewrites 가 기존 경로를 그대로 여기로 보낸다):
 *   /api/tour/:path*        → /api/proxy?svc=tour&path=:path*
 *   /api/tour-batch?reqs=[] → /api/proxy?svc=tour&reqs=[]      (배치 — 아래 참고)
 *   /api/festival-std       → /api/proxy?svc=festival-std
 *   /api/weather            → /api/proxy?svc=weather
 *   /api/templestay/:path*  → /api/proxy?svc=templestay&path=:path*
 *
 * 배치 모드 (tour 전용):
 *   코스 생성은 시군 × 카테고리로 TourAPI 를 15~20회 부른다. 브라우저에서 각각 왕복하면 느리고
 *   공공 API 도 사용자 수만큼 두들긴다. reqs=[{path, query}] 로 한 번에 받아 서버에서 병렬 포워딩하고
 *   [{status, body}] 배열로 돌려준다. 결과는 GET 이라 URL 단위로 엣지 캐시된다.
 *
 * DB 우선 조회 (tour 전용, 단건·배치 공통):
 *   경북(areaCode=35) 장소 검색(areaBasedList2 / searchKeyword2)은 api/sync-places.ts 가 적재한
 *   Supabase tour_places 에서 먼저 응답한다 (_lib/places-db.ts). 응답 형태가 TourAPI 와 같아
 *   클라이언트는 차이를 모른다. DB 미설정·미동기화 시군·전국 검색·상세 조회는 그대로 포워딩.
 *
 * 환경변수 (Vercel Dashboard → Settings → Environment Variables):
 *   TOUR_API_KEY          공공데이터포털 일반 인증키(Decoding) — 없으면 키 없이 포워딩
 *   FESTIVAL_STD_API_KEY  없으면 TOUR_API_KEY 재사용
 *   WEATHER_API_KEY       없으면 TOUR_API_KEY 재사용 (단기예보 활용신청 필요)
 *
 * dev 는 vite.config.ts 의 미들웨어가 이 파일의 handle() 을 그대로 호출한다 — dev/운영 단일 구현.
 */
import { servePlacesFromDb, type Env } from './_lib/places-db.js'

export const config = { runtime: 'edge' }

interface ServiceDef {
  /** 업스트림 URL. pathParam 이면 이 뒤에 ?path= 가 붙는 prefix, 아니면 고정 엔드포인트. */
  upstream: string
  /** ?path= 하위 경로를 허용하는지 (tour·templestay 는 하위 서비스가 여럿, 나머지는 고정) */
  pathParam: boolean
  /** serviceKey 로 넣을 환경변수 — 앞에서부터 먼저 있는 값을 사용. 빈 배열이면 키 주입 없음. */
  keyEnv: string[]
  /** 항상 덧붙이는 쿼리 */
  forceQuery?: Record<string, string>
  /** 업스트림 요청 헤더 */
  headers: Record<string, string>
  /** 정상 응답의 Cache-Control */
  cache: string
  /** 응답 Content-Type 폴백 */
  contentType: string
  /** 배치 모드 허용 */
  batch?: boolean
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

const SERVICES: Record<string, ServiceDef> = {
  // 한국관광공사 TourAPI 전 서비스(B551011). 다국어·무장애·반려동물·빅데이터·수상사진까지 path 로 구분.
  tour: {
    upstream: 'https://apis.data.go.kr/B551011/',
    pathParam: true,
    keyEnv: ['TOUR_API_KEY'],
    headers: { Accept: 'application/json' },
    cache: 'public, s-maxage=300, stale-while-revalidate=600',
    contentType: 'application/json',
    batch: true,
  },
  // 행정안전부 전국문화축제표준데이터 — 분기 갱신이라 24h + 7일 SWR
  'festival-std': {
    upstream: 'https://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api',
    pathParam: false,
    keyEnv: ['FESTIVAL_STD_API_KEY', 'TOUR_API_KEY'],
    headers: { Accept: 'application/json' },
    cache: 'public, s-maxage=86400, stale-while-revalidate=604800',
    contentType: 'application/json',
  },
  // 기상청 단기예보 — 자주 바뀌므로 30분 + SWR
  weather: {
    upstream: 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst',
    pathParam: false,
    keyEnv: ['WEATHER_API_KEY', 'TOUR_API_KEY'],
    forceQuery: { dataType: 'JSON' },
    headers: { Accept: 'application/json' },
    cache: 'public, s-maxage=1800, stale-while-revalidate=3600',
    contentType: 'application/json',
  },
  // templestay.com — OpenAPI 가 없어 HTML 페이지를 그대로 넘긴다. UA 없으면 403 이라 브라우저 UA 위장.
  templestay: {
    upstream: 'https://www.templestay.com/',
    pathParam: true,
    keyEnv: [],
    headers: {
      'User-Agent': BROWSER_UA,
      Referer: 'https://www.templestay.com/',
      Accept: 'text/html,application/xhtml+xml',
    },
    cache: 'public, s-maxage=3600, stale-while-revalidate=86400',
    contentType: 'text/html; charset=utf-8',
  },
}

/** 배치 한 번에 허용하는 하위 요청 수 — 코스 생성 최대 fan-out(시군 2 × 소스 ~8) 여유분. */
const BATCH_MAX = 30
const UPSTREAM_TIMEOUT_MS = 10_000

/** 하위 경로 검증 — 세그먼트는 영숫자·_·-·. 만, 상위 이동(..)·절대경로·프로토콜 금지. */
const SAFE_PATH_RE = /^[A-Za-z0-9_\-.]+(\/[A-Za-z0-9_\-.]+)*$/
function isSafePath(p: string): boolean {
  return SAFE_PATH_RE.test(p) && !p.split('/').some((seg) => seg === '.' || seg === '..')
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  })
}

function buildTarget(
  svc: ServiceDef,
  path: string,
  query: Iterable<[string, string]>,
  env: Env,
): URL | null {
  if (svc.pathParam) {
    if (!isSafePath(path)) return null
  } else if (path) {
    return null
  }
  const target = new URL(svc.pathParam ? svc.upstream + path : svc.upstream)
  for (const [k, v] of query) target.searchParams.set(k, v)
  for (const [k, v] of Object.entries(svc.forceQuery ?? {})) target.searchParams.set(k, v)
  const key = svc.keyEnv.map((name) => env[name]).find(Boolean)
  if (key) target.searchParams.set('serviceKey', key)
  return target
}

async function forward(svc: ServiceDef, target: URL): Promise<{ status: number; body: string; contentType: string }> {
  const upstream = await fetch(target.toString(), {
    method: 'GET',
    headers: svc.headers,
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  })
  return {
    status: upstream.status,
    body: await upstream.text(),
    contentType: upstream.headers.get('content-type') ?? svc.contentType,
  }
}

interface BatchReq {
  path: string
  query?: Record<string, string>
}

function parseBatch(raw: string): BatchReq[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > BATCH_MAX) return null
  const out: BatchReq[] = []
  for (const r of parsed) {
    if (!r || typeof r !== 'object') return null
    const { path, query } = r as { path?: unknown; query?: unknown }
    if (typeof path !== 'string') return null
    if (query !== undefined && (typeof query !== 'object' || query === null || Array.isArray(query))) return null
    const q: Record<string, string> = {}
    for (const [k, v] of Object.entries((query ?? {}) as Record<string, unknown>)) {
      if (v !== undefined && v !== null) q[k] = String(v)
    }
    out.push({ path, query: q })
  }
  return out
}

/**
 * 실제 처리 — dev 미들웨어가 env 를 넘겨 재사용한다.
 * (Vercel 은 default export 를 (req, context) 로 호출하므로 env 를 두 번째 인자로 두면 안 된다.)
 */
export async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)
  const svcName = url.searchParams.get('svc') ?? ''
  const svc = SERVICES[svcName]
  if (!svc) return json({ error: 'unknown service', service: svcName }, 400)

  const path = url.searchParams.get('path') ?? ''
  const reqs = url.searchParams.get('reqs')
  url.searchParams.delete('svc')
  url.searchParams.delete('path')
  url.searchParams.delete('reqs')

  // ── 배치 ──
  if (reqs !== null) {
    if (!svc.batch) return json({ error: 'batch not supported', service: svcName }, 400)
    const list = parseBatch(reqs)
    if (!list) return json({ error: `invalid reqs (array of {path, query}, max ${BATCH_MAX})` }, 400)

    const results = await Promise.all(
      list.map(async (r) => {
        const target = buildTarget(svc, r.path, Object.entries(r.query ?? {}), env)
        if (!target) return { status: 400, body: JSON.stringify({ error: 'invalid path', path: r.path }) }
        try {
          // 경북 장소 검색은 적재된 DB 에서 먼저 (동기화 안 된 시군·DB 미설정이면 null → 포워딩)
          const served = svcName === 'tour' ? await servePlacesFromDb(r.path, r.query ?? {}, env) : null
          if (served) return { status: served.status, body: served.body }
          const { status, body } = await forward(svc, target)
          return { status, body }
        } catch (err) {
          return { status: 502, body: JSON.stringify({ error: 'upstream failed', message: String(err) }) }
        }
      }),
    )
    // 일부라도 5xx 면 캐시하지 않는다 — 일시 장애가 5분간 굳는 걸 막는다.
    const healthy = results.every((r) => r.status < 500)
    return json(results, 200, { 'Cache-Control': healthy ? svc.cache : 'no-store' })
  }

  // ── 단건 ──
  const target = buildTarget(svc, path, url.searchParams.entries(), env)
  if (!target) return json({ error: 'invalid path', path }, 400)
  try {
    // 경북 장소 검색은 적재된 DB 에서 먼저 (동기화 안 된 시군·DB 미설정이면 null → 포워딩)
    const served =
      svcName === 'tour' ? await servePlacesFromDb(path, Object.fromEntries(url.searchParams), env) : null
    const { status, body, contentType } = served ?? (await forward(svc, target))
    return new Response(body, {
      status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': status < 500 ? svc.cache : 'no-store',
      },
    })
  } catch (err) {
    return json({ error: 'upstream failed', message: String(err) }, 502)
  }
}

export default function handler(req: Request): Promise<Response> {
  return handle(req, process.env as Env)
}
