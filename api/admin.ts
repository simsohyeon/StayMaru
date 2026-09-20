/**
 * Vercel Edge Function — 운영자 대시보드 인증·집계. /api/admin
 *
 *   POST /api/admin?action=login   body { password } → 성공 시 세션 쿠키 발급
 *   POST /api/admin?action=logout                    → 쿠키 만료
 *   GET  /api/admin?action=session                   → 쿠키 유효성만 확인
 *   GET  /api/admin?action=stats                     → 저장 코스 집계 (쿠키 필요)
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
import { dbFromEnv, pgrest, type Env } from './_lib/places-db.js'

export const config = { runtime: 'edge' }

const COOKIE = 'sm_admin'
/** 세션 유효기간 — 운영 통계 확인 용도라 길게 둘 이유가 없다. */
const SESSION_MS = 8 * 60 * 60 * 1000
/** 비밀번호 최소 길이 — 이보다 짧으면 기능을 켜지 않는다. */
const MIN_PASSWORD_LEN = 12
/** 집계에 쓸 최근 저장 코스 수 — Edge 메모리에서 집계하므로 상한을 둔다. */
const STATS_LIMIT = 500
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

/* ── 집계 ─────────────────────────────────────────────────────────── */

interface SavedRow {
  client_id?: string
  updated_at?: string
  course?: {
    lang?: string
    profile?: string
    items?: { place?: { sigunguCode?: number; category?: string } }[]
  }
}

function countTop(counts: Map<string, number>, limit = 10): [string, number][] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
}

function aggregate(rows: SavedRow[]) {
  const clients = new Set<string>()
  const byLang = new Map<string, number>()
  const byProfile = new Map<string, number>()
  const byRegion = new Map<string, number>()
  const byCategory = new Map<string, number>()
  let places = 0
  let latest = ''

  for (const row of rows) {
    if (row.client_id) clients.add(row.client_id)
    if (row.updated_at && row.updated_at > latest) latest = row.updated_at
    const c = row.course
    if (!c) continue
    const lang = c.lang || 'unknown'
    byLang.set(lang, (byLang.get(lang) ?? 0) + 1)
    if (c.profile) byProfile.set(c.profile, (byProfile.get(c.profile) ?? 0) + 1)
    for (const it of c.items ?? []) {
      const p = it?.place
      if (!p) continue
      places++
      if (p.sigunguCode !== undefined) {
        const k = String(p.sigunguCode)
        byRegion.set(k, (byRegion.get(k) ?? 0) + 1)
      }
      if (p.category) byCategory.set(p.category, (byCategory.get(p.category) ?? 0) + 1)
    }
  }

  return {
    courses: rows.length,
    clients: clients.size,
    places,
    latest: latest || null,
    sampled: rows.length >= STATS_LIMIT,
    byLang: countTop(byLang),
    byProfile: countTop(byProfile),
    byRegion: countTop(byRegion),
    byCategory: countTop(byCategory),
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

  if (req.method === 'GET' && action === 'stats') {
    if (!authed) return json({ error: 'unauthorized' }, 401)
    const db = dbFromEnv(env)
    // 통계는 DB 가 있어야 한다. 인증과 달리 여기서는 비어 있음을 그대로 알린다.
    if (!db) return json({ error: 'not-ready', reason: 'db-not-configured' }, 503)
    const res = await pgrest(
      db,
      'GET',
      `saved_courses?select=client_id,updated_at,course&order=updated_at.desc&limit=${STATS_LIMIT}`,
    )
    if (!res.ok) return json({ error: 'upstream', status: res.status }, 502)
    const rows = (await res.json()) as SavedRow[]
    return json(aggregate(Array.isArray(rows) ? rows : []), 200)
  }

  return json({ error: 'not found' }, 404)
}

export default async function handler(req: Request): Promise<Response> {
  return handle(req, process.env as Env)
}
