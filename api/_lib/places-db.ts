/**
 * 경북 장소 데이터 DB 계층 — Supabase(PostgREST) 를 fetch 로 직접 호출한다.
 * (api/ 는 의존성이 없어야 하므로 supabase-js 를 쓰지 않는다. `_` 접두 폴더는 Vercel 이 함수로 배포하지 않는다.)
 *
 * 두 소비자:
 *  - api/proxy.ts   : TourAPI areaBasedList2 / searchKeyword2 요청을 DB 에서 먼저 응답 (servePlacesFromDb)
 *  - api/sync-places: TourAPI → tour_places 적재 (upsertPlaces / deleteStale / markSynced / loadSyncState)
 *
 * 스키마: supabase/migrations/20260920_tour_places.sql
 */

export type Env = Record<string, string | undefined>

export interface Db {
  url: string
  key: string
}

/** 서버 전용 설정 — 둘 다 있어야 DB 경로가 켜진다. 없으면 null → 호출부는 TourAPI 포워딩으로 폴백. */
export function dbFromEnv(env: Env): Db | null {
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
  const key = env.SUPABASE_SERVICE_ROLE_KEY || ''
  return url && key ? { url, key } : null
}

/** TourAPI 다국어 서비스 → 저장 lang. 무장애(KorWith)·반려동물(KorPet) 은 필드가 달라 DB 대상이 아니다. */
export const SERVICE_LANG: Record<string, string> = {
  KorService2: 'ko',
  EngService2: 'en',
  JpnService2: 'ja',
  ChsService2: 'zh',
}
export const LANG_SERVICE: Record<string, string> = Object.fromEntries(
  Object.entries(SERVICE_LANG).map(([s, l]) => [l, s]),
)

export const GB_AREA_CODE = 35
/** 경북 22개 시군구 코드 (frontend/src/constants/sigungu.ts 와 동일) */
export const GB_SIGUNGU_CODES = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]

/** 동기화 기록이 이보다 오래되면 DB 를 신뢰하지 않고 TourAPI 로 포워딩한다 (cron 은 매일). */
export const FRESH_MS = 7 * 24 * 60 * 60 * 1000

const REST_TIMEOUT_MS = 8_000

function headers(db: Db, extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: db.key,
    Authorization: `Bearer ${db.key}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function rest(
  db: Db,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  pathAndQuery: string,
  opts: { body?: unknown; prefer?: string } = {},
): Promise<Response> {
  const res = await fetch(`${db.url}/rest/v1/${pathAndQuery}`, {
    method,
    headers: headers(db, opts.prefer ? { Prefer: opts.prefer } : {}),
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: AbortSignal.timeout(REST_TIMEOUT_MS),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`postgrest ${method} ${pathAndQuery.split('?')[0]} → HTTP ${res.status} ${text.slice(0, 200)}`)
  }
  return res
}

/** 다른 서버 모듈(api/courses.ts 등)이 같은 인증·오류 규칙으로 PostgREST 를 호출할 때 쓴다. */
export const pgrest = rest

/* ─────────────────────────── 동기화 상태 ─────────────────────────── */

export interface SyncRow {
  lang: string
  sigungucode: number
  synced_at: string
  item_count: number
}

export async function loadSyncState(db: Db, lang: string): Promise<SyncRow[]> {
  const res = await rest(db, 'GET', `tour_sync_state?lang=eq.${encodeURIComponent(lang)}&select=lang,sigungucode,synced_at,item_count`)
  return (await res.json()) as SyncRow[]
}

/** 요청마다 상태표를 읽지 않도록 60초 메모리 캐시 (엣지 isolate 가 살아 있는 동안 공유). */
const stateCache = new Map<string, { at: number; fresh: Set<number> }>()
const STATE_CACHE_MS = 60_000

export async function freshSigungus(db: Db, lang: string): Promise<Set<number>> {
  const hit = stateCache.get(lang)
  if (hit && Date.now() - hit.at < STATE_CACHE_MS) return hit.fresh
  const rows = await loadSyncState(db, lang)
  const cutoff = Date.now() - FRESH_MS
  const fresh = new Set(rows.filter((r) => Date.parse(r.synced_at) >= cutoff).map((r) => r.sigungucode))
  stateCache.set(lang, { at: Date.now(), fresh })
  return fresh
}

/** 테스트·동기화 직후 상태 캐시 무효화 */
export function resetStateCache(): void {
  stateCache.clear()
}

/* ─────────────────────────── 적재 ─────────────────────────── */

export interface TourItem {
  contentid?: string
  contenttypeid?: string
  title?: string
  addr1?: string
  areacode?: string
  sigungucode?: string
  mapx?: string
  mapy?: string
  firstimage?: string
  cat1?: string
  cat2?: string
  cat3?: string
  createdtime?: string
  modifiedtime?: string
  [k: string]: unknown
}

export interface PlaceRow {
  lang: string
  contentid: string
  contenttypeid: number | null
  title: string | null
  addr1: string | null
  areacode: number | null
  sigungucode: number | null
  mapx: number | null
  mapy: number | null
  firstimage: string | null
  cat1: string | null
  cat2: string | null
  cat3: string | null
  createdtime: string | null
  modifiedtime: string | null
  raw: TourItem
  synced_at: string
}

function num(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
function str(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null
}

export function toRow(item: TourItem, lang: string, syncedAt: string): PlaceRow | null {
  if (!item.contentid) return null
  return {
    lang,
    contentid: item.contentid,
    contenttypeid: num(item.contenttypeid),
    title: str(item.title),
    addr1: str(item.addr1),
    areacode: num(item.areacode),
    sigungucode: num(item.sigungucode),
    mapx: num(item.mapx),
    mapy: num(item.mapy),
    firstimage: str(item.firstimage),
    cat1: str(item.cat1),
    cat2: str(item.cat2),
    cat3: str(item.cat3),
    createdtime: str(item.createdtime),
    modifiedtime: str(item.modifiedtime),
    raw: item,
    synced_at: syncedAt,
  }
}

const UPSERT_CHUNK = 500

export async function upsertPlaces(db: Db, rows: PlaceRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    await rest(db, 'POST', 'tour_places?on_conflict=lang,contentid', {
      body: rows.slice(i, i + UPSERT_CHUNK),
      prefer: 'resolution=merge-duplicates,return=minimal',
    })
  }
}

/** 이번 동기화에서 다시 나타나지 않은(=TourAPI 에서 사라진) 항목 제거 */
export async function deleteStale(db: Db, lang: string, sigungu: number, before: string): Promise<void> {
  await rest(
    db,
    'DELETE',
    `tour_places?lang=eq.${encodeURIComponent(lang)}&sigungucode=eq.${sigungu}&synced_at=lt.${encodeURIComponent(before)}`,
    { prefer: 'return=minimal' },
  )
}

export async function markSynced(db: Db, lang: string, sigungu: number, itemCount: number, at: string): Promise<void> {
  await rest(db, 'POST', 'tour_sync_state?on_conflict=lang,sigungucode', {
    body: [{ lang, sigungucode: sigungu, synced_at: at, item_count: itemCount }],
    prefer: 'resolution=merge-duplicates,return=minimal',
  })
  stateCache.delete(lang)
}

/* ─────────────────────────── 조회 (코스 생성용 원본 항목) ─────────────────────────── */

const RAW_PAGE = 1000

/** 시군 집합의 적재 항목 전체(raw) — 코스 엔진 후보 풀. 페이지 순회로 PostgREST 기본 상한을 피한다. */
export async function fetchPlacesRaw(db: Db, lang: string, sigungus: number[]): Promise<TourItem[]> {
  const out: TourItem[] = []
  const codes = sigungus.filter((n) => Number.isInteger(n)).join(',')
  if (!codes) return out
  for (let offset = 0; ; offset += RAW_PAGE) {
    const res = await rest(
      db,
      'GET',
      `tour_places?lang=eq.${encodeURIComponent(lang)}&sigungucode=in.(${codes})&select=raw&order=contentid.asc&limit=${RAW_PAGE}&offset=${offset}`,
    )
    const rows = (await res.json()) as Array<{ raw: TourItem }>
    out.push(...rows.map((r) => r.raw))
    if (rows.length < RAW_PAGE) break
  }
  return out
}

/* ─────────────────────────── 조회 (TourAPI 호환 응답) ─────────────────────────── */

const SERVED_OPS = new Set(['areaBasedList2', 'searchKeyword2'])

/** TourAPI arrange → PostgREST order + 사진 필수 여부. E(거리순) 는 locationBasedList2 전용이라 미지원. */
const ARRANGE: Record<string, { order: string; imageOnly: boolean }> = {
  A: { order: 'title.asc,contentid.asc', imageOnly: false },
  C: { order: 'modifiedtime.desc,contentid.asc', imageOnly: false },
  D: { order: 'createdtime.desc,contentid.asc', imageOnly: false },
  O: { order: 'title.asc,contentid.asc', imageOnly: true },
  Q: { order: 'modifiedtime.desc,contentid.asc', imageOnly: true },
  R: { order: 'createdtime.desc,contentid.asc', imageOnly: true },
}

/** PostgREST 필터 값에서 예약문자(, . : ( ) " * \) 를 걷어낸다 — 키워드는 '서원'·'둘레길' 류라 손실 없음. */
function cleanFilterValue(v: string): string {
  return v.replace(/[,.:()"*\\]/g, '')
}

export interface DbServed {
  status: number
  body: string
  contentType: string
}

/**
 * TourAPI 요청(fullPath = 'KorService2/areaBasedList2', query) 을 DB 에서 응답할 수 있으면
 * TourAPI 와 같은 JSON 을 만들어 돌려준다. 못 하면 null → 호출부가 TourAPI 로 포워딩.
 *
 * DB 에서 응답하는 조건:
 *  - 다국어 일반 서비스 + areaBasedList2 | searchKeyword2
 *  - areaCode=35 (전국 검색은 DB 에 없음)
 *  - 요청 시군(없으면 22개 전부)이 7일 이내 동기화됨
 *  - arrange 가 미지원 값(E)이 아님
 */
export async function servePlacesFromDb(
  fullPath: string,
  query: Record<string, string>,
  env: Env,
): Promise<DbServed | null> {
  const db = dbFromEnv(env)
  if (!db) return null
  const [service, op] = fullPath.split('/')
  const lang = SERVICE_LANG[service]
  if (!lang || !SERVED_OPS.has(op)) return null
  if (Number(query.areaCode) !== GB_AREA_CODE) return null
  const arrange = query.arrange ? ARRANGE[query.arrange] : { order: 'contentid.asc', imageOnly: false }
  if (!arrange) return null
  const keyword = op === 'searchKeyword2' ? cleanFilterValue((query.keyword ?? '').trim()) : ''
  if (op === 'searchKeyword2' && !keyword) return null

  const sigungu = query.sigunguCode ? Number(query.sigunguCode) : undefined
  if (sigungu !== undefined && !Number.isInteger(sigungu)) return null

  try {
    const fresh = await freshSigungus(db, lang)
    const covered = sigungu !== undefined ? fresh.has(sigungu) : GB_SIGUNGU_CODES.every((c) => fresh.has(c))
    if (!covered) return null

    const numOfRows = Math.max(1, Math.min(1000, Number(query.numOfRows) || 10))
    const pageNo = Math.max(1, Number(query.pageNo) || 1)
    const filters: string[] = [`lang=eq.${lang}`, `areacode=eq.${GB_AREA_CODE}`]
    if (sigungu !== undefined) filters.push(`sigungucode=eq.${sigungu}`)
    for (const k of ['contentTypeId', 'cat1', 'cat2', 'cat3'] as const) {
      const v = query[k]
      if (v) filters.push(`${k.toLowerCase()}=eq.${encodeURIComponent(cleanFilterValue(v))}`)
    }
    if (keyword) filters.push(`title=ilike.${encodeURIComponent(`*${keyword}*`)}`)
    if (arrange.imageOnly) filters.push('firstimage=not.is.null')
    filters.push(`order=${arrange.order}`, `limit=${numOfRows}`, `offset=${(pageNo - 1) * numOfRows}`, 'select=raw')

    const res = await rest(db, 'GET', `tour_places?${filters.join('&')}`, { prefer: 'count=exact' })
    const rows = (await res.json()) as Array<{ raw: TourItem }>
    const range = res.headers.get('content-range') ?? ''
    const total = Number(range.split('/')[1])
    const totalCount = Number.isFinite(total) ? total : rows.length

    const body = {
      response: {
        header: { resultCode: '0000', resultMsg: 'OK' },
        body: {
          // TourAPI 는 0건일 때 items 를 빈 문자열로 준다 — 클라이언트(pickItems)가 그 형태를 기대한다.
          items: rows.length ? { item: rows.map((r) => r.raw) } : '',
          numOfRows,
          pageNo,
          totalCount,
        },
      },
    }
    return { status: 200, body: JSON.stringify(body), contentType: 'application/json; charset=utf-8' }
  } catch (err) {
    // DB 장애는 기능 장애가 아니다 — 경고만 남기고 TourAPI 로 폴백.
    console.warn(`[places-db] ${fullPath}: ${err instanceof Error ? err.message : String(err)} — TourAPI 로 폴백`)
    return null
  }
}
