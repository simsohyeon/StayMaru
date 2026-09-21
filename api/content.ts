/**
 * Vercel Edge Function — 앱이 읽는 공개 콘텐츠. /api/content
 *
 *   GET /api/content?kind=curated → { items: [...] }  공개된 테마 코스만
 *
 * 인증이 없는 읽기 전용 경로다. 쓰기는 /api/admin 쪽에만 있다.
 *
 * 실패는 조용히 빈 목록으로 떨어뜨린다 — Supabase 미설정, 표 없음(마이그레이션 전), 장애 모두.
 * 앱은 빈 목록을 "서버에 올린 코스가 없음"으로 읽고 코드에 있는 기본 코스를 그대로 쓴다.
 * 운영자가 뭔가 잘못됐다는 사실은 /api/admin 쪽에서 사유와 함께 드러난다.
 */
import { dbFromEnv, type Env } from './_lib/places-db.js'
import { listCurated } from './_lib/curated.js'

export const config = { runtime: 'edge' }

/** 관리자가 고친 내용이 1분 안에 반영되도록 짧게, 대신 재검증 동안은 이전 값을 그대로 쓴다. */
const CACHE = 'public, s-maxage=60, stale-while-revalidate=600'

function json(body: unknown, status: number, cache: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache },
  })
}

export async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405, 'no-store')
  if ((url.searchParams.get('kind') ?? '') !== 'curated') return json({ error: 'unknown kind' }, 400, 'no-store')

  const db = dbFromEnv(env)
  if (!db) return json({ items: [] }, 200, CACHE)
  try {
    return json({ items: await listCurated(db, true) }, 200, CACHE)
  } catch (err) {
    console.warn(`[content] curated: ${err instanceof Error ? err.message : String(err)} — 기본 코스로 폴백`)
    // 실패를 캐시에 눌러 담지 않는다. 다음 요청이 다시 시도한다.
    return json({ items: [] }, 200, 'no-store')
  }
}

export default function handler(req: Request): Promise<Response> {
  return handle(req, process.env as Env)
}
