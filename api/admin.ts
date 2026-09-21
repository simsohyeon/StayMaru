/**
 * Vercel Edge Function — 운영자 인증과 테마 코스 편집. /api/admin
 *
 *   POST   /api/admin?action=login   body { password } → 성공 시 세션 쿠키 발급
 *   POST   /api/admin?action=logout                    → 쿠키 만료
 *   GET    /api/admin?action=session                   → 쿠키 유효성만 확인
 *   GET    /api/admin?action=curated                   → 테마 코스 전체 (비공개 포함, 쿠키 필요)
 *   PUT    /api/admin?action=curated  body { items }   → 테마 코스 일괄 저장(추가·수정·정렬)
 *   DELETE /api/admin?action=curated&id=<id>           → 테마 코스 한 건 삭제
 *
 * SPA 는 번들이 공개되므로 프런트에서 비밀번호를 비교하면 아무 의미가 없다.
 * 관문은 전부 여기(서버)에 있고, 프런트는 401 을 받으면 로그인 폼으로 되돌아갈 뿐이다.
 *
 * 세션: HMAC-SHA256 으로 만료시각에 서명한 값을 HttpOnly 쿠키에 담는다(서버만 검증 가능).
 * 비밀번호나 서명키는 응답에 실리지 않고, 쿠키는 JS 에서 읽을 수 없다.
 *
 * 환경변수(서버 전용 — VITE_ 접두를 붙이면 번들에 노출되니 절대 쓰지 말 것):
 *   ADMIN_PASSWORD        필수. 12자 미만이면 기능 자체를 꺼서(503) 약한 비밀번호가 배포되는 것을 막는다.
 *   ADMIN_SESSION_SECRET  선택. 없으면 ADMIN_PASSWORD 로 서명한다(비밀번호를 바꾸면 기존 세션이 끊긴다).
 */
import { FRESH_MS, GB_SIGUNGU_CODES, dbFromEnv, loadSyncState, type Env } from './_lib/places-db.js'
import { deleteCurated, listCurated, parseCourses, upsertCurated } from './_lib/curated.js'

export const config = { runtime: 'edge' }

const COOKIE = 'sm_admin'
/** 세션 유효기간 — 테마 문구를 손보는 정도의 용도라 길게 둘 이유가 없다. */
const SESSION_MS = 8 * 60 * 60 * 1000
/** 비밀번호 최소 길이 — 이보다 짧으면 기능을 켜지 않는다. */
const MIN_PASSWORD_LEN = 12
/** 실패 응답 지연 — Edge 는 상태가 없어 정교한 속도 제한이 어렵다. 최소한의 무차별 대입 둔화. */
const FAIL_DELAY_MS = 600

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  })
}

const enc = new TextEncoder()

/** 길이·내용 모두 비교 시간이 입력에 따라 달라지지 않게 — 비밀번호 비교의 기본. */
function timingSafeEqual(a: string, b: string): boolean {
  const ab = enc.encode(a)
  const bb = enc.encode(b)
  // 길이가 다르면 결과는 false 지만, 비교 자체는 같은 횟수를 돌린다.
  const len = Math.max(ab.length, bb.length)
  let diff = ab.length ^ bb.length
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0)
  return diff === 0
}

function b64url(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(payload)))
}

/** 쿠키 값: `v1.<만료ms>.<서명>` */
async function issue(secret: string): Promise<string> {
  const payload = `v1.${Date.now() + SESSION_MS}`
  return `${payload}.${await sign(payload, secret)}`
}

async function verify(cookieValue: string | undefined, secret: string): Promise<boolean> {
  if (!cookieValue) return false
  const i = cookieValue.lastIndexOf('.')
  if (i <= 0) return false
  const payload = cookieValue.slice(0, i)
  const sig = cookieValue.slice(i + 1)
  const [v, expRaw] = payload.split('.')
  if (v !== 'v1') return false
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp <= Date.now()) return false
  return timingSafeEqual(sig, await sign(payload, secret))
}

function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.get('cookie') ?? ''
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return rest.join('=')
  }
  return undefined
}

function setCookie(value: string, maxAgeSec: number, secure: boolean): string {
  // HttpOnly: JS 접근 차단 / SameSite=Strict: 외부 사이트發 요청에 실리지 않음 / Secure: HTTPS 전용.
  // Secure 는 운영(https)에서만 — dev 서버는 http 라 붙이면 브라우저가 쿠키를 버린다.
  return `${COOKIE}=${value}; HttpOnly;${secure ? ' Secure;' : ''} SameSite=Strict; Path=/; Max-Age=${maxAgeSec}`
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface AdminConfig {
  password: string
  secret: string
}

/** 운영자 기능이 켜질 조건 — 비밀번호가 있고 충분히 길어야 한다. */
function adminFromEnv(env: Env): AdminConfig | { reason: string } {
  const password = env.ADMIN_PASSWORD || ''
  if (!password) return { reason: 'admin-password-not-set' }
  if (password.length < MIN_PASSWORD_LEN) return { reason: 'admin-password-too-short' }
  return { password, secret: env.ADMIN_SESSION_SECRET || password }
}

/* ── 테마 코스 편집 ───────────────────────────────────────────────── */

/**
 * 홈·테마 화면에 걸리는 추천 코스의 목록/저장/삭제.
 * 인증을 통과한 요청만 들어온다(handle 에서 먼저 거른다).
 *
 * 저장은 일괄(upsert)이다 — 순서 바꾸기도 결국 sort 값을 다시 매기는 일이라
 * 한 건씩 보내면 중간에 끊겼을 때 순서가 뒤엉킨다.
 * 쓰기 후에는 항상 DB 가 가진 최종 목록을 돌려줘 화면이 낙관적 추정 대신 사실을 그린다.
 */
async function curated(req: Request, env: Env, url: URL): Promise<Response> {
  const db = dbFromEnv(env)
  if (!db) return json({ error: 'not-ready', reason: 'db-not-configured' }, 503)
  try {
    if (req.method === 'GET') return json({ items: await listCurated(db, false) }, 200)

    if (req.method === 'PUT') {
      let body: { items?: unknown }
      try {
        body = (await req.json()) as { items?: unknown }
      } catch {
        return json({ error: 'invalid json' }, 400)
      }
      const parsed = parseCourses(body.items)
      // 한 건이라도 어긋나면 아무것도 저장하지 않는다 — 반쯤 저장된 목록이 제일 고치기 어렵다.
      if (!parsed.ok) return json({ error: 'invalid', detail: parsed.error }, 400)
      await upsertCurated(db, parsed.value)
      return json({ items: await listCurated(db, false) }, 200)
    }

    if (req.method === 'DELETE') {
      const id = url.searchParams.get('id') ?? ''
      if (!id) return json({ error: 'id required' }, 400)
      await deleteCurated(db, id)
      return json({ items: await listCurated(db, false) }, 200)
    }
  } catch (err) {
    // 표가 없거나(마이그레이션 전) PostgREST 가 거절한 경우. 운영자에게는 사유를 그대로 보여 준다.
    return json({ error: 'upstream', detail: err instanceof Error ? err.message : String(err) }, 502)
  }
  return json({ error: 'method not allowed' }, 405)
}

/* ── 장소 적재 현황 ───────────────────────────────────────────────── */

/**
 * 시군별 적재 상태를 돌려준다. 읽기 전용.
 *
 * 왜 필요한가 — 적재가 안 돼 있으면 목록 조회가 전부 관광 API 로 나가고, 일일 한도가
 * 터지는 순간 화면이 빈다. 그런데 지금은 적재가 됐는지 안 됐는지 볼 방법이 아예 없어서
 * 배포 로그로도, 화면으로도 알 수 없었다. 운영자가 한눈에 보게 한다.
 *
 * 설정값은 '있다/없다'만 알린다 — 값 자체는 절대 내보내지 않는다.
 */
async function syncStatus(env: Env): Promise<Response> {
  const config = {
    supabase: !!dbFromEnv(env),
    tourApiKey: !!env.TOUR_API_KEY,
    // 이게 없으면 Vercel Cron 이 매번 401 로 튕긴다 — 적재가 영영 안 도는 가장 흔한 원인.
    cronSecret: !!env.CRON_SECRET,
  }
  const db = dbFromEnv(env)
  if (!db) return json({ config, error: 'not-ready', reason: 'db-not-configured' }, 503)

  try {
    const rows = await loadSyncState(db, 'ko')
    const byCode = new Map(rows.map((r) => [r.sigungucode, r]))
    const cutoff = Date.now() - FRESH_MS
    const items = GB_SIGUNGU_CODES.map((code) => {
      const row = byCode.get(code)
      const at = row ? Date.parse(row.synced_at) : 0
      return {
        sigunguCode: code,
        syncedAt: row?.synced_at ?? null,
        itemCount: row?.item_count ?? 0,
        // fresh 인 시군만 DB 가 응답한다 (places-db.ts 의 freshSigungus 와 같은 기준).
        state: !row ? 'missing' : at >= cutoff ? 'fresh' : 'stale',
      }
    })
    const fresh = items.filter((i) => i.state === 'fresh').length
    return json(
      {
        config,
        freshMs: FRESH_MS,
        total: GB_SIGUNGU_CODES.length,
        fresh,
        items,
      },
      200,
    )
  } catch (err) {
    return json(
      { config, error: 'upstream', detail: err instanceof Error ? err.message : String(err) },
      502,
    )
  }
}

/* ── 핸들러 ───────────────────────────────────────────────────────── */

export async function handle(req: Request, env: Env): Promise<Response> {
  const cfg = adminFromEnv(env)
  if ('reason' in cfg) return json({ error: 'not-ready', reason: cfg.reason }, 503)

  const url = new URL(req.url)
  const action = url.searchParams.get('action') ?? ''
  const secure = url.protocol === 'https:'

  if (req.method === 'POST' && action === 'login') {
    let body: { password?: unknown }
    try {
      body = (await req.json()) as { password?: unknown }
    } catch {
      return json({ error: 'invalid json' }, 400)
    }
    const given = typeof body.password === 'string' ? body.password : ''
    if (!timingSafeEqual(given, cfg.password)) {
      await sleep(FAIL_DELAY_MS)
      return json({ error: 'unauthorized' }, 401)
    }
    return json({ ok: true }, 200, { 'Set-Cookie': setCookie(await issue(cfg.secret), SESSION_MS / 1000, secure) })
  }

  if (req.method === 'POST' && action === 'logout') {
    return json({ ok: true }, 200, { 'Set-Cookie': setCookie('', 0, secure) })
  }

  const authed = await verify(readCookie(req, COOKIE), cfg.secret)

  if (req.method === 'GET' && action === 'session') {
    return authed ? json({ ok: true }, 200) : json({ error: 'unauthorized' }, 401)
  }

  if (action === 'curated') {
    if (!authed) return json({ error: 'unauthorized' }, 401)
    return curated(req, env, url)
  }

  if (req.method === 'GET' && action === 'sync') {
    if (!authed) return json({ error: 'unauthorized' }, 401)
    return syncStatus(env)
  }

  return json({ error: 'not found' }, 404)
}

export default async function handler(req: Request): Promise<Response> {
  return handle(req, process.env as Env)
}
