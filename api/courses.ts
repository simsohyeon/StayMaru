/**
 * Vercel Edge Function — 저장 코스 보관. /api/courses
 *
 *   GET    /api/courses?client=<id>              → { courses: Course[] }  (최신순, 최대 50)
 *   PUT    /api/courses   body { client, course } → 저장(upsert)
 *   DELETE /api/courses?client=<id>&id=<courseId> → 삭제
 *
 * 로그인이 없으므로 브라우저가 만든 익명 클라이언트 id(frontend/src/lib/clientId.ts) 가 소유 단위다.
 * 503 { error: 'not-ready' } 면 클라이언트 스토어는 localStorage 만 쓴다 (기존 동작).
 * 스키마: supabase/migrations/20260920_saved_courses.sql
 */
import { dbFromEnv, pgrest, type Env } from './_lib/places-db.js'

export const config = { runtime: 'edge' }

const CLIENT_RE = /^[A-Za-z0-9_-]{8,64}$/
const COURSE_ID_RE = /^[A-Za-z0-9_.:-]{1,80}$/
const MAX_LIST = 50
const MAX_COURSE_BYTES = 256 * 1024

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  })
}

export async function handle(req: Request, env: Env): Promise<Response> {
  const db = dbFromEnv(env)
  if (!db) return json({ error: 'not-ready', reason: 'db-not-configured' }, 503)
  const url = new URL(req.url)

  try {
    if (req.method === 'GET') {
      const client = url.searchParams.get('client') ?? ''
      if (!CLIENT_RE.test(client)) return json({ error: 'client: invalid' }, 400)
      const res = await pgrest(
        db,
        'GET',
        `saved_courses?client_id=eq.${encodeURIComponent(client)}&select=course&order=updated_at.desc&limit=${MAX_LIST}`,
      )
      const rows = (await res.json()) as Array<{ course: unknown }>
      return json({ courses: rows.map((r) => r.course) }, 200)
    }

    if (req.method === 'PUT') {
      let body: { client?: unknown; course?: unknown }
      try {
        body = (await req.json()) as typeof body
      } catch {
        return json({ error: 'invalid json' }, 400)
      }
      const client = typeof body.client === 'string' ? body.client : ''
      if (!CLIENT_RE.test(client)) return json({ error: 'client: invalid' }, 400)
      const course = body.course as { id?: unknown; items?: unknown } | undefined
      if (!course || typeof course !== 'object' || typeof course.id !== 'string' || !COURSE_ID_RE.test(course.id) || !Array.isArray(course.items)) {
        return json({ error: 'course: id and items required' }, 400)
      }
      const serialized = JSON.stringify(course)
      if (serialized.length > MAX_COURSE_BYTES) return json({ error: 'course: too large' }, 413)
      await pgrest(db, 'POST', 'saved_courses?on_conflict=client_id,course_id', {
        body: [{ client_id: client, course_id: course.id, course, updated_at: new Date().toISOString() }],
        prefer: 'resolution=merge-duplicates,return=minimal',
      })
      return json({ ok: true, id: course.id }, 200)
    }

    if (req.method === 'DELETE') {
      const client = url.searchParams.get('client') ?? ''
      const id = url.searchParams.get('id') ?? ''
      if (!CLIENT_RE.test(client)) return json({ error: 'client: invalid' }, 400)
      if (!COURSE_ID_RE.test(id)) return json({ error: 'id: invalid' }, 400)
      await pgrest(
        db,
        'DELETE',
        `saved_courses?client_id=eq.${encodeURIComponent(client)}&course_id=eq.${encodeURIComponent(id)}`,
        { prefer: 'return=minimal' },
      )
      return json({ ok: true, id }, 200)
    }

    return json({ error: 'method not allowed' }, 405, { Allow: 'GET, PUT, DELETE' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[courses] ${message}`)
    return json({ error: 'not-ready', reason: 'error', message }, 503)
  }
}

export default function handler(req: Request): Promise<Response> {
  return handle(req, process.env as Env)
}
