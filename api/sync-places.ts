/**
 * Vercel Edge Function — 경북 장소 데이터를 TourAPI 에서 Supabase(tour_places) 로 적재.
 *
 * 왜: 사용자 요청 경로에서 공공 API 지연(건당 300~800ms × 15~20회)을 빼기 위해, 하루 1회 시군별로
 * areaBasedList2 를 페이지 순회해 통째로 받아 둔다. api/proxy.ts 는 동기화된 시군의 검색을
 * DB 에서 응답하고, 아직 안 된 시군은 이전처럼 TourAPI 로 포워딩한다 (부분 적재 상태도 안전).
 *
 * 호출:
 *   GET /api/sync-places                       기본 — lang=ko, 가장 오래된 시군부터 시간 예산 안에서 처리
 *   GET /api/sync-places?lang=en               다른 언어 서비스(EngService2 …)
 *   GET /api/sync-places?sigungu=2,4&force=1   특정 시군만, 신선도 무시하고 강제
 *   GET /api/sync-places?budget=20000          이번 호출 시간 예산(ms). 초과하면 남은 시군은 다음 호출로.
 *
 * 인증: Authorization: Bearer <CRON_SECRET> (Vercel Cron 이 자동으로 붙인다) 또는 ?secret=.
 *       CRON_SECRET 미설정이면 localhost 에서만 허용(dev).
 *
 * 스케줄: vercel.json crons — 매일 18:00 UTC (03:00 KST). Hobby 플랜은 일 1회·2개까지.
 *   한 번에 다 못 끝나면 tour_sync_state 기준으로 다음 날 이어서 처리한다. 초기 적재는 수동으로
 *   위 URL 을 몇 번 호출하면 된다(응답의 remaining 이 빌 때까지).
 */
import {
  GB_AREA_CODE,
  GB_SIGUNGU_CODES,
  LANG_SERVICE,
  FRESH_MS,
  dbFromEnv,
  deleteStale,
  loadSyncState,
  markSynced,
  toRow,
  upsertPlaces,
  type Env,
  type PlaceRow,
  type TourItem,
} from './_lib/places-db.ts'

export const config = { runtime: 'edge' }

/** 적재할 콘텐츠 타입 — 관광지 12, 문화시설 14, 축제·공연·행사 15, 여행코스 25, 레포츠 28, 숙박 32, 쇼핑 38, 음식점 39 */
const CONTENT_TYPES = [12, 14, 15, 25, 28, 32, 38, 39]
const PAGE_SIZE = 1000
const MAX_PAGES = 20
const DEFAULT_BUDGET_MS = 20_000
const UPSTREAM_TIMEOUT_MS = 12_000

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

interface TourListResponse {
  response?: {
    header?: { resultCode?: string; resultMsg?: string }
    body?: { items?: { item?: TourItem[] | TourItem } | string; totalCount?: number }
  }
}

/** 한 시군 × 콘텐츠 타입을 전 페이지 순회해 항목 배열로 */
async function fetchAllPages(
  service: string,
  sigungu: number,
  contentTypeId: number,
  key: string | undefined,
): Promise<TourItem[]> {
  const out: TourItem[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const u = new URL(`https://apis.data.go.kr/B551011/${service}/areaBasedList2`)
    const q: Record<string, string> = {
      MobileOS: 'ETC',
      MobileApp: 'Shimmaru',
      _type: 'json',
      areaCode: String(GB_AREA_CODE),
      sigunguCode: String(sigungu),
      contentTypeId: String(contentTypeId),
      arrange: 'C',
      numOfRows: String(PAGE_SIZE),
      pageNo: String(page),
    }
    for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v)
    if (key) u.searchParams.set('serviceKey', key)

    const res = await fetch(u.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
    const text = await res.text()
    let data: TourListResponse
    try {
      data = JSON.parse(text) as TourListResponse
    } catch {
      throw new Error(`${service} ct=${contentTypeId} p${page}: HTTP ${res.status} ${text.trim().slice(0, 80)}`)
    }
    const code = data.response?.header?.resultCode
    if (code && code !== '0000') {
      throw new Error(`${service} ct=${contentTypeId} p${page}: resultCode=${code} ${data.response?.header?.resultMsg ?? ''}`)
    }
    const items = data.response?.body?.items
    const list = !items || typeof items === 'string' ? [] : items.item ? (Array.isArray(items.item) ? items.item : [items.item]) : []
    out.push(...list)
    const total = Number(data.response?.body?.totalCount ?? 0)
    if (list.length < PAGE_SIZE || out.length >= total) break
  }
  return out
}

interface SigunguReport {
  sigungu: number
  items: number
  ms: number
}

export async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)
  if (!authorized(req, url, env)) return json({ error: 'unauthorized' }, 401)

  const db = dbFromEnv(env)
  if (!db) return json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다' }, 503)

  const lang = url.searchParams.get('lang') ?? 'ko'
  const service = LANG_SERVICE[lang]
  if (!service) return json({ error: `unsupported lang: ${lang}` }, 400)

  const force = url.searchParams.get('force') === '1'
  const budgetMs = Math.max(3_000, Number(url.searchParams.get('budget')) || DEFAULT_BUDGET_MS)
  const requested = (url.searchParams.get('sigungu') ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => GB_SIGUNGU_CODES.includes(n))

  // 처리 순서 — 지정이 있으면 그대로, 없으면 "기록 없음 → 오래된 순". 신선한 시군은 force 가 아니면 건너뛴다.
  let targets: number[]
  const state = await loadSyncState(db, lang).catch((e: unknown) => {
    throw new Error(`tour_sync_state 조회 실패 — 마이그레이션(supabase/migrations)을 실행했는지 확인: ${String(e)}`)
  }).catch((e: Error) => e)
  if (state instanceof Error) return json({ error: state.message }, 503)
  const syncedAt = new Map(state.map((r) => [r.sigungucode, Date.parse(r.synced_at)]))
  if (requested.length > 0) {
    targets = requested
  } else {
    targets = [...GB_SIGUNGU_CODES].sort((a, b) => (syncedAt.get(a) ?? 0) - (syncedAt.get(b) ?? 0))
  }
  const cutoff = Date.now() - FRESH_MS
  const skipped = force ? [] : targets.filter((c) => (syncedAt.get(c) ?? 0) >= cutoff)
  targets = force ? targets : targets.filter((c) => (syncedAt.get(c) ?? 0) < cutoff)

  const started = Date.now()
  const done: SigunguReport[] = []
  const failed: Array<{ sigungu: number; error: string }> = []
  const remaining: number[] = []

  for (const sigungu of targets) {
    if (Date.now() - started > budgetMs) {
      remaining.push(sigungu)
      continue
    }
    const t0 = Date.now()
    const runAt = new Date().toISOString()
    try {
      const lists = await Promise.all(CONTENT_TYPES.map((ct) => fetchAllPages(service, sigungu, ct, env.TOUR_API_KEY)))
      const rows: PlaceRow[] = []
      const seen = new Set<string>()
      for (const list of lists) {
        for (const item of list) {
          const row = toRow(item, lang, runAt)
          if (row && !seen.has(row.contentid)) {
            seen.add(row.contentid)
            rows.push(row)
          }
        }
      }
      await upsertPlaces(db, rows)
      // 모든 콘텐츠 타입을 성공적으로 받은 경우에만 사라진 항목을 정리한다 (부분 실패 시 삭제 금지).
      await deleteStale(db, lang, sigungu, runAt)
      await markSynced(db, lang, sigungu, rows.length, runAt)
      done.push({ sigungu, items: rows.length, ms: Date.now() - t0 })
    } catch (err) {
      failed.push({ sigungu, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return json({
    lang,
    service,
    budgetMs,
    elapsedMs: Date.now() - started,
    done,
    failed,
    skippedFresh: skipped,
    remaining,
  })
}

export default function handler(req: Request): Promise<Response> {
  return handle(req, process.env as Env)
}
