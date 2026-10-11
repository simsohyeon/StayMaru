/**
 * Vercel Edge Function — 적재된 시군별 방문자 통계 제공 (읽기 전용·공개).
 *
 * 브라우저는 데이터랩을 직접 부르지 않고 여기서 받는다 — 전국 일자별 원본 약 1MB 대신 수 KB.
 * 적재(api/sync-visits.ts)가 아직 한 번도 안 돌았으면 items 가 비고, 호출부는 그때만
 * 데이터랩을 직접 부른다(frontend/src/api/bigdata.ts).
 *
 * 응답: { items: [{ sigunguCode, visitors }], baseYm?, syncedAt?, source: 'db' }
 */
import { dbFromEnv, type Env } from './_lib/places-db.js'
import { loadRegionVisits } from './_lib/visits-db.js'

export const config = { runtime: 'edge' }

/** 하루 1회 적재라 1시간 캐시 + 하루 SWR 이면 충분하다. */
const CACHE = 'public, s-maxage=3600, stale-while-revalidate=86400'

function json(body: unknown, status: number, cache: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache },
  })
}

export async function handle(req: Request, env: Env): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405, 'no-store')

  const db = dbFromEnv(env)
  if (!db) return json({ items: [], reason: 'db-not-configured' }, 200, 'no-store')

  try {
    const snap = await loadRegionVisits(db)
    // 빈 응답을 오래 캐시하면 첫 적재 후에도 한참 빈 화면이 된다.
    return json({ ...snap, source: 'db' }, 200, snap.items.length > 0 ? CACHE : 'no-store')
  } catch {
    return json({ items: [], reason: 'db-error' }, 200, 'no-store')
  }
}

export default function handler(req: Request): Promise<Response> {
  return handle(req, process.env as Env)
}
