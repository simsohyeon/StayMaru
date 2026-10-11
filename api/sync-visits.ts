/**
 * Vercel Edge Function — 한국관광 데이터랩 시군별 방문자 통계를 Supabase(region_visits) 로 적재.
 *
 * 왜: locgoRegnVisitrDDList 는 지역 필터가 없어 전국 일자별 전체(약 1MB·7~9초)를 돌려준다.
 * 방문자마다 받게 두면 첫 로드가 느리고 공공 API 호출량이 사용자 수만큼 늘어난다. 하루 1회만
 * 받아 두면 브라우저는 /api/visits 로 수 KB 만 받고, 업스트림이 잠깐 실패해도 마지막 실제
 * 수치가 남아 있어 화면을 추정 상수로 대체할 필요가 없다.
 *
 * 호출:
 *   GET /api/sync-visits          적재 (이미 오늘 받았으면 건너뜀)
 *   GET /api/sync-visits?force=1  신선도 무시하고 강제
 *
 * 인증: Authorization: Bearer <CRON_SECRET> (Vercel Cron 이 자동으로 붙인다) 또는 ?secret=.
 *       CRON_SECRET 미설정이면 localhost 에서만 허용(dev).
 *
 * 스케줄: vercel.json crons — 매일 19:00 UTC (04:00 KST). 통계가 월 단위로 늦게 공개돼
 *   하루 1회면 충분하다. 초기 적재는 위 URL 을 한 번 호출하면 된다.
 */
import { dbFromEnv, type Env } from './_lib/places-db.js'
import { fetchVisitsFromDataLab, loadRegionVisits, replaceRegionVisits } from './_lib/visits-db.js'

export const config = { runtime: 'edge' }

/** 이보다 최근에 적재했으면 다시 받지 않는다 — 통계 자체가 월 단위로 갱신된다. */
const FRESH_MS = 20 * 60 * 60 * 1000

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

function authorized(req: Request, url: URL, env: Env): boolean {
  const secret = env.CRON_SECRET
  if (!secret) return ['localhost', '127.0.0.1'].includes(url.hostname)
  const header = req.headers.get('authorization') ?? ''
  return header === `Bearer ${secret}` || url.searchParams.get('secret') === secret
}

export async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)
  if (!authorized(req, url, env)) return json({ error: 'unauthorized' }, 401)

  const db = dbFromEnv(env)
  if (!db) return json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다' }, 503)

  const apiKey = env.TOUR_API_KEY ?? ''
  if (!apiKey) return json({ error: 'TOUR_API_KEY 가 설정되지 않았습니다' }, 503)

  const force = url.searchParams.get('force') === '1'
  const current = await loadRegionVisits(db)
  if (!force && current.syncedAt && Date.now() - Date.parse(current.syncedAt) < FRESH_MS) {
    return json({ skipped: 'fresh', count: current.items.length, baseYm: current.baseYm, syncedAt: current.syncedAt })
  }

  const t0 = Date.now()
  const res = await fetchVisitsFromDataLab(apiKey)
  if (res.status !== 'ok' || res.items.length === 0 || !res.baseYm) {
    /*
     * 실패해도 기존 행은 건드리지 않는다 — 오래된 실제 수치가 빈 화면보다 낫고,
     * 무엇보다 추정값으로 덮어쓰지 않는다.
     */
    return json(
      { error: 'datalab fetch failed', status: res.status, kept: current.items.length, elapsedMs: Date.now() - t0 },
      current.items.length > 0 ? 200 : 502,
    )
  }

  const at = new Date().toISOString()
  await replaceRegionVisits(db, res.items, res.baseYm, at)
  return json({ synced: res.items.length, baseYm: res.baseYm, syncedAt: at, elapsedMs: Date.now() - t0 })
}

export default function handler(req: Request): Promise<Response> {
  return handle(req, process.env as Env)
}
