/**
 * Vercel Edge Function — 서버 코스 생성. POST /api/course
 *
 * 클라이언트(Home.tsx)가 시군 × 카테고리로 TourAPI 를 15~20회 부르고 브라우저에서 엔진을 돌리던 파이프라인을
 * 서버로 옮긴다. 후보는 적재된 DB(tour_places)에서 통째로 읽고, 축제·날씨는 같은 배포의 엣지 캐시된
 * 프록시를 self-fetch 한 뒤, 프런트와 같은 엔진(frontend/src/lib/courseEngine.ts)을 그대로 실행한다.
 *
 * 요청/응답 계약: frontend/src/lib/courseRequest.ts (CourseRequest / CourseResponse)
 *
 * 503 { error: 'not-ready', reason } 이면 클라이언트가 기존 로컬 파이프라인으로 폴백한다:
 *   db-not-configured  SUPABASE_* 미설정
 *   not-synced         요청 시군 중 7일 이내 적재 기록이 없는 것이 있음 (missing: [...])
 *   companion-sources  무장애·반려동물 전용 소스(KorWith/KorPet)는 DB 에 없어 클라이언트가 처리
 *   no-candidates      적재 항목이 비어 있음
 *   error              DB·엔진 오류 (message)
 */
import { generateCourse } from '../frontend/src/lib/courseEngine.ts'
import {
  VALID_COMPANIONS,
  VALID_DURATIONS,
  VALID_LANGS,
  VALID_PROFILES,
  type CourseRequest,
  type CourseResponse,
} from '../frontend/src/lib/courseRequest.ts'
import type { Companion, CourseProfile, DateRange, Lang, Place, TripDuration } from '../frontend/src/types/domain.ts'
import { GB_SIGUNGU_CODES, dbFromEnv, freshSigungus, type Env } from './_lib/places-db.ts'
import { loadCandidates, loadFestivals, loadRainHint } from './_lib/course-data.ts'

export const config = { runtime: 'edge' }

const MAX_FAVORITES = 100
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  })
}

function notReady(reason: string, detail: Record<string, unknown> = {}): Response {
  return json({ error: 'not-ready', reason, ...detail }, 503)
}

function isPlace(v: unknown): v is Place {
  if (!v || typeof v !== 'object') return false
  const p = v as Partial<Place>
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.category === 'string' &&
    !!p.position &&
    typeof p.position.lat === 'number' &&
    typeof p.position.lng === 'number'
  )
}

/** 요청 검증 — 실패 시 사유 문자열. 프로필이 비면 Home 과 같이 known_gb 로 본다. */
function parseRequest(body: unknown): CourseRequest | string {
  if (!body || typeof body !== 'object') return 'body must be an object'
  const b = body as Record<string, unknown>

  const sigunguCodes = Array.isArray(b.sigunguCodes) ? [...new Set(b.sigunguCodes.map(Number))] : []
  if (sigunguCodes.length === 0 || sigunguCodes.length > 3) return 'sigunguCodes: 1~3 codes required'
  if (!sigunguCodes.every((c) => GB_SIGUNGU_CODES.includes(c))) return 'sigunguCodes: unknown code'

  const profiles = Array.isArray(b.profiles) ? (b.profiles as unknown[]) : []
  if (!profiles.every((p) => VALID_PROFILES.includes(p as CourseProfile))) return 'profiles: unknown profile'

  const companions = Array.isArray(b.companions) ? (b.companions as unknown[]) : []
  if (!companions.every((c) => VALID_COMPANIONS.includes(c as Companion))) return 'companions: unknown companion'

  if (!VALID_DURATIONS.includes(b.duration as TripDuration)) return 'duration: invalid'
  if (!VALID_LANGS.includes(b.lang as Lang)) return 'lang: invalid'

  let dateRange: DateRange | undefined
  if (b.dateRange !== undefined && b.dateRange !== null) {
    const r = b.dateRange as Partial<DateRange>
    if (typeof r.start !== 'string' || typeof r.end !== 'string' || !ISO_DATE_RE.test(r.start) || !ISO_DATE_RE.test(r.end)) {
      return 'dateRange: YYYY-MM-DD start/end required'
    }
    if (r.start > r.end) return 'dateRange: start after end'
    dateRange = { start: r.start, end: r.end }
  }

  let favorites: Place[] | undefined
  if (b.favorites !== undefined) {
    if (!Array.isArray(b.favorites) || b.favorites.length > MAX_FAVORITES) return `favorites: array up to ${MAX_FAVORITES}`
    if (!b.favorites.every(isPlace)) return 'favorites: invalid place'
    favorites = b.favorites as Place[]
  }

  return {
    sigunguCodes,
    profiles: (profiles.length ? profiles : ['known_gb']) as CourseProfile[],
    companions: companions as Companion[],
    duration: b.duration as TripDuration,
    dateRange,
    lang: b.lang as Lang,
    favorites,
  }
}

export async function handle(req: Request, env: Env): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405, { Allow: 'POST' })
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }
  const parsed = parseRequest(body)
  if (typeof parsed === 'string') return json({ error: parsed }, 400)

  const companions = parsed.companions ?? []
  if (companions.includes('accessible') || companions.includes('pet')) return notReady('companion-sources')

  const db = dbFromEnv(env)
  if (!db) return notReady('db-not-configured')

  const t0 = Date.now()
  try {
    const fresh = await freshSigungus(db, parsed.lang)
    const missing = parsed.sigunguCodes.filter((c) => !fresh.has(c))
    if (missing.length > 0) return notReady('not-synced', { missing })

    const origin = new URL(req.url).origin
    const startDate = parsed.dateRange ? new Date(parsed.dateRange.start) : new Date()
    const [candidates, festivals, weather] = await Promise.all([
      loadCandidates(db, parsed.lang, parsed.sigunguCodes),
      loadFestivals(origin, parsed.lang, parsed.dateRange).catch(() => []),
      loadRainHint(origin, parsed.sigunguCodes[0], startDate),
    ])
    if (candidates.length === 0) return notReady('no-candidates')

    const course = generateCourse({
      candidates,
      festivals,
      baseSigungus: parsed.sigunguCodes,
      duration: parsed.duration,
      dateRange: parsed.dateRange,
      profiles: parsed.profiles,
      favorites: parsed.favorites,
      rainHint: weather.hint,
      companions,
      lang: parsed.lang,
    })
    const res: CourseResponse = {
      course,
      meta: { candidates: candidates.length, festivals: festivals.length, rainHint: weather.hint, elapsedMs: Date.now() - t0 },
    }
    return json(res, 200, { 'X-Shimmaru-Source': 'server' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[course] ${message} — 클라이언트 로컬 생성으로 폴백`)
    return notReady('error', { message })
  }
}

export default function handler(req: Request): Promise<Response> {
  return handle(req, process.env as Env)
}
