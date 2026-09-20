import axios from 'axios'
import { cachedFetch } from '@/lib/cache'
import { CATEGORY_MAP } from '@/constants/categories'
import { GB_AREA_CODE } from '@/constants/sigungu'
import { fetchStandardFestivalsGB, normalizeName } from './standardFestival'
import type { CategoryId, Festival, Lang, LatLng, Place } from '@/types/domain'
import { cleanHtml, extractHomepage, forceHttps, inferCategory, isAllowedItem, mapToPlace, type TourApiItem } from '@/lib/placeMapping'
import { isoToYmd, shiftYmd } from '@/lib/ymd'

// 호환 — 다른 모듈이 여기서 import 하던 날짜 유틸 (구현은 lib/ymd.ts).
export { isoToYmd }

/**
 * 공공 관광정보 OpenAPI 클라이언트.
 *
 * serviceKey 는 절대 프론트 번들에 넣지 않는다 — dev 는 Vite proxy, 운영은 서버리스 프록시가 주입.
 * 호출 실패 시 mock 없이 빈 결과를 반환하고 원인은 콘솔 경고로만 남긴다.
 */

const PROXY_BASE = (import.meta.env.VITE_TOUR_PROXY_BASE as string | undefined) || '/api/tour'

// V2 엔드포인트만 사용 — V1 은 신규 발급 키에 HTTP 500 "Unexpected errors" 를 반환한다.
//  - 'normal': 일반 관광정보 (다국어 — KorService2/EngService2/…)
//  - 'with':   무장애여행정보 (한국어판만 존재 → 다국어 사용자도 ko 폴백)
const SERVICE_PATH = {
  normal: {
    ko: 'KorService2',
    en: 'EngService2',
    ja: 'JpnService2',
    zh: 'ChsService2',
  },
  with: {
    ko: 'KorWithService2',
    en: 'KorWithService2',
    ja: 'KorWithService2',
    zh: 'KorWithService2',
  },
  // 반려동물 동반여행 (KorPetTourService2, GW 버전) — 한국어판만 존재해 다국어도 ko 폴백.
  pet: {
    ko: 'KorPetTourService2',
    en: 'KorPetTourService2',
    ja: 'KorPetTourService2',
    zh: 'KorPetTourService2',
  },
} as const
type ServiceKind = keyof typeof SERVICE_PATH

const client = axios.create({
  timeout: 8000,
  headers: { Accept: 'application/json' },
})

interface TourApiBody {
  items?: { item?: TourApiItem[] | TourApiItem } | string
  totalCount?: number
}

interface TourApiResponse {
  response?: {
    header?: { resultCode?: string; resultMsg?: string }
    body?: TourApiBody
  }
  /** 키 미등록·트래픽 초과 등은 200 으로 이 포맷을 준다 (returnReasonCode 30=미등록 키 등). */
  OpenAPI_ServiceResponse?: {
    cmmMsgHeader?: { returnReasonCode?: string; errMsg?: string; returnAuthMsg?: string }
  }
}

function pickItems(res: TourApiResponse): TourApiItem[] {
  const items = res?.response?.body?.items
  if (!items || typeof items === 'string') return []
  const v = items.item
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

/* ────────────────────────────────────────────────────────────────────────────
 * 요청 배칭 — 코스 생성은 시군 × 카테고리로 callTour 를 15~20회 동시에 부른다. 각각 브라우저 왕복하면
 * 가장 느린 한 건이 전체를 잡고, 공공 API 도 사용자 수만큼 두들긴다. 짧은 시간창(BATCH_WINDOW_MS)에
 * 모인 요청을 /api/tour-batch 한 번으로 보내 서버(api/proxy.ts)가 병렬 포워딩한다.
 *  - 단건은 개별 URL 로 보낸다 — 상세 화면처럼 같은 URL 이 반복되는 요청은 엣지 캐시 히트율이 더 높다.
 *  - 같은 입력이면 같은 배치 URL 이 되도록 정렬한다 — 배치 응답도 URL 단위로 엣지 캐시되기 때문.
 *  - 배치 엔드포인트 장애(구 배포·네트워크)면 개별 호출로 폴백해 기능은 유지한다.
 *  - VITE_TOUR_PROXY_BASE 로 다른 게이트웨이를 쓰면 배치 엔드포인트가 없으므로 비활성.
 * ──────────────────────────────────────────────────────────────────────────── */
const BATCH_PATH = '/api/tour-batch'
const BATCH_ENABLED = PROXY_BASE === '/api/tour'
/** 마지막 요청 도착 후 이만큼 조용하면 전송 — cachedFetch 의 IndexedDB 조회 때문에 요청이 몇 ms 간격으로 흩어진다. */
const BATCH_WINDOW_MS = 25
/** 첫 요청 후 최대 대기 — 요청이 계속 들어와도 이 시점엔 보낸다. */
const BATCH_MAX_WAIT_MS = 80
/** 서버(api/proxy.ts BATCH_MAX)와 동일 */
const BATCH_MAX = 30
/** 배치 URL 길이 상한(인코딩 후) — 엣지 요청 URL 한도(약 14KB) 아래로 여유 있게. */
const BATCH_MAX_URL_CHARS = 8000

interface RawTourResponse {
  status: number
  data: TourApiResponse | string
}

interface PendingTour {
  /** 'KorService2/areaBasedList2' */
  path: string
  query: Record<string, string>
  resolve: (r: RawTourResponse) => void
  reject: (e: unknown) => void
}

let batchQueue: PendingTour[] = []
let batchTimer: ReturnType<typeof setTimeout> | undefined
let batchFirstAt = 0

function pendingKey(p: { path: string; query: Record<string, string> }): string {
  return `${p.path}?${new URLSearchParams(p.query).toString()}`
}

async function fetchTourDirect(path: string, query: Record<string, string>): Promise<RawTourResponse> {
  // validateStatus — 미신청 서비스는 게이트웨이가 403 평문으로 응답한다. axios 기본값(2xx만 통과)이면
  // interpretTourResponse 에 오기 전에 throw 돼 FORBIDDEN 분류가 죽은 코드가 되고, UI 는 "잠시 후 다시 시도"만 보인다.
  const { data, status } = await client.get<TourApiResponse | string>(
    `${PROXY_BASE}/${path}?${new URLSearchParams(query).toString()}`,
    { validateStatus: () => true },
  )
  return { status, data }
}

function enqueueTour(path: string, query: Record<string, string>): Promise<RawTourResponse> {
  return new Promise((resolve, reject) => {
    batchQueue.push({ path, query, resolve, reject })
    if (batchQueue.length >= BATCH_MAX) {
      void flushTourBatch()
      return
    }
    const now = Date.now()
    if (batchQueue.length === 1) batchFirstAt = now
    if (batchTimer) clearTimeout(batchTimer)
    const remaining = Math.max(0, BATCH_MAX_WAIT_MS - (now - batchFirstAt))
    batchTimer = setTimeout(() => void flushTourBatch(), Math.min(BATCH_WINDOW_MS, remaining))
  })
}

function parseBatchBody(body: unknown): TourApiResponse | string {
  if (typeof body !== 'string') return body as TourApiResponse
  try {
    return JSON.parse(body) as TourApiResponse
  } catch {
    return body
  }
}

async function flushTourBatch(): Promise<void> {
  if (batchTimer) {
    clearTimeout(batchTimer)
    batchTimer = undefined
  }
  const batch = batchQueue
  batchQueue = []
  if (batch.length === 0) return

  // 같은 요청은 한 번만 보낸다 (cachedFetch 키가 달라도 업스트림 호출이 같은 경우가 있다).
  const groups = new Map<string, PendingTour[]>()
  for (const p of batch) {
    const k = pendingKey(p)
    const g = groups.get(k)
    if (g) g.push(p)
    else groups.set(k, [p])
  }
  const settle = (waiters: PendingTour[], r: RawTourResponse) => waiters.forEach((w) => w.resolve(r))
  const fail = (waiters: PendingTour[], e: unknown) => waiters.forEach((w) => w.reject(e))

  const unique = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  if (unique.length === 1) {
    const [, waiters] = unique[0]
    fetchTourDirect(waiters[0].path, waiters[0].query).then((r) => settle(waiters, r), (e) => fail(waiters, e))
    return
  }

  // URL 길이 상한 안에서 청크로 나눈다.
  const chunks: Array<typeof unique> = []
  let cur: typeof unique = []
  let curLen = 0
  for (const entry of unique) {
    const len = encodeURIComponent(JSON.stringify({ path: entry[1][0].path, query: entry[1][0].query })).length + 3
    if (cur.length > 0 && curLen + len > BATCH_MAX_URL_CHARS) {
      chunks.push(cur)
      cur = []
      curLen = 0
    }
    cur.push(entry)
    curLen += len
  }
  if (cur.length > 0) chunks.push(cur)

  await Promise.all(
    chunks.map(async (chunk) => {
      const reqs = chunk.map(([, waiters]) => ({ path: waiters[0].path, query: waiters[0].query }))
      try {
        const { data, status } = await client.get<unknown>(
          `${BATCH_PATH}?reqs=${encodeURIComponent(JSON.stringify(reqs))}`,
          { validateStatus: () => true, timeout: 15000 },
        )
        if (status !== 200 || !Array.isArray(data) || data.length !== chunk.length) {
          throw new Error(`tour batch HTTP ${status}`)
        }
        chunk.forEach(([, waiters], i) => {
          const r = data[i] as { status?: number; body?: unknown }
          settle(waiters, { status: Number(r?.status ?? 502), data: parseBatchBody(r?.body) })
        })
      } catch (err) {
        // 배치 엔드포인트 장애 — 개별 호출로 폴백해 기능은 유지한다.
        if (import.meta.env.DEV) {
          console.warn(`[tour:batch] ${err instanceof Error ? err.message : String(err)} — 개별 호출로 폴백합니다.`)
        }
        for (const [, waiters] of chunk) {
          fetchTourDirect(waiters[0].path, waiters[0].query).then((r) => settle(waiters, r), (e) => fail(waiters, e))
        }
      }
    }),
  )
}

async function callTour(
  path: string,
  params: Record<string, string | number | undefined>,
  lang: Lang,
  service: ServiceKind = 'normal',
): Promise<TourApiResponse> {
  const fullPath = `${SERVICE_PATH[service][lang]}/${path}`
  const query: Record<string, string> = {
    MobileOS: 'ETC',
    MobileApp: 'Shimmaru',
    _type: 'json',
  }
  // 호출자가 명시하지 않으면 기본 numOfRows=30 / pageNo=1
  if (!('numOfRows' in params)) query.numOfRows = '30'
  if (!('pageNo' in params)) query.pageNo = '1'
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') query[k] = String(v)
  }
  const { data, status } = BATCH_ENABLED
    ? await enqueueTour(fullPath, query)
    : await fetchTourDirect(fullPath, query)
  const denied = status === 401 || status === 403
  // 응답이 평문 (예: "Forbidden") 일 때 — 해당 언어 서비스에 활용신청이 없는 경우
  if (typeof data === 'string') {
    const trimmed = data.trim().slice(0, 80)
    const forbidden = denied || /forbidden|unauthorized|not.?registered/i.test(trimmed)
    throw new TourApiError(
      `${SERVICE_PATH[service][lang]}/${path}: HTTP ${status} ${trimmed}`,
      forbidden ? 'FORBIDDEN' : `HTTP_${status}`,
    )
  }
  // 키 미등록·한도 초과 — 200 으로 OpenAPI_ServiceResponse 포맷을 준다 (returnReasonCode 30/22 등).
  const gw = data?.OpenAPI_ServiceResponse?.cmmMsgHeader
  if (gw?.returnReasonCode) {
    throw new TourApiError(
      `${path} gateway ${gw.returnReasonCode} (${gw.errMsg ?? gw.returnAuthMsg ?? 'unknown'})`,
      denied ? 'FORBIDDEN' : gw.returnReasonCode,
    )
  }
  // 200 을 주고도 body 헤더에 에러 코드를 담아 보내므로 명시적으로 잡는다.
  const code = data?.response?.header?.resultCode
  if (code && code !== '0000') {
    const msg = data?.response?.header?.resultMsg ?? 'unknown'
    throw new TourApiError(`${path} resultCode=${code} (${msg})`, denied ? 'FORBIDDEN' : code)
  }
  if (status >= 400) {
    throw new TourApiError(`${path} HTTP ${status}`, denied ? 'FORBIDDEN' : `HTTP_${status}`)
  }
  return data as TourApiResponse
}

class TourApiError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.code = code
  }
}

function warn(scope: string, err: unknown) {
  if (!import.meta.env.DEV) return
  const msg = err instanceof Error ? err.message : String(err)
  if (err instanceof TourApiError) {
    // 평문 Forbidden — 해당 언어 서비스 활용신청 누락
    if (err.code === 'FORBIDDEN' || /forbidden/i.test(msg)) {
      console.warn(
        `[tour:${scope}] ${msg} — 해당 언어 서비스에 활용신청이 없습니다. ` +
          `공공데이터포털에서 해당 언어의 관광정보 서비스(V2) 도 활용신청 하세요.`,
      )
      return
    }
    // serviceKey 미발급 / 미등록
    if (['30', '10', '20'].includes(err.code)) {
      console.warn(
        `[tour:${scope}] ${msg} — TOUR_API_KEY 가 등록되지 않았거나 잘못된 키. ` +
          `frontend/.env.local 의 키를 확인하고 dev 서버를 재시작하세요.`,
      )
      return
    }
  }
  console.warn(`[tour:${scope}] ${msg} — 빈 결과로 폴백합니다.`)
}

export interface SearchParams {
  category?: CategoryId
  sigunguCode?: number
  keyword?: string
  lang: Lang
  /** cat3 직접 지정 — 카테고리 기본 cat3 를 덮어쓴다(예: 맛집의 음식 종류 한식 A05020100). */
  cat3?: string
  /** 1-based page number */
  pageNo?: number
  /** items per page (default 30) */
  numOfRows?: number
}

export interface SearchResult {
  items: Place[]
  totalCount: number
  pageNo: number
  numOfRows: number
  /** API 호출이 실패해 빈 결과가 반환된 경우의 원인 코드 (성공 시 undefined). */
  error?: TourErrorKind
}

export type TourErrorKind = 'network' | 'forbidden' | 'noKey' | 'unknown'

function classifyError(err: unknown): TourErrorKind {
  if (err instanceof TourApiError) {
    if (err.code === 'FORBIDDEN') return 'forbidden'
    if (['10', '20', '30'].includes(err.code)) return 'noKey'
    if (/^HTTP_5/.test(err.code)) return 'network'
  }
  // axios network/timeout
  const code = (err as { code?: string; message?: string } | null)?.code
  const msg = (err as { message?: string } | null)?.message ?? ''
  if (code === 'ECONNABORTED' || /network|timeout/i.test(msg)) return 'network'
  return 'unknown'
}

/**
 * FR-13, FR-14, FR-22 — 지역/카테고리/키워드 통합 탐색 (페이징 포함).
 * API 가 cat3 를 하나만 받으므로, cat3Aliases 가 있으면 cat3 별 호출 후 contentid dedupe → 클라 페이징.
 */
export async function searchPlaces(p: SearchParams): Promise<SearchResult> {
  const pageNo = p.pageNo ?? 1
  const numOfRows = p.numOfRows ?? 30
  const cat = p.category ? CATEGORY_MAP[p.category] : undefined
  // cat3 직접 지정(예: 맛집 음식종류)이 있으면 그것만 사용. 없으면 카테고리 정의의 cat3.
  const effectiveCat3 = p.cat3 ?? cat?.cat3
  // cat3Aliases 가 있으면 multi 모드. 없으면 cat3 단일.
  const cat3List: string[] = p.cat3 ? [p.cat3] : (cat?.cat3Aliases ?? (cat?.cat3 ? [cat.cat3] : []))
  const isMultiCat3 = cat3List.length > 1
  const effectiveKeyword =
    p.keyword?.trim() ||
    (cat && !cat.cat3 && !cat.cat3Aliases && !p.cat3 ? cat.forceKeyword : undefined)
  // 키워드 검색이 우선 — cat3 multi 무시(키워드로 좁힘).
  const usingKeyword = !!effectiveKeyword
  const useMulti = isMultiCat3 && !usingKeyword

  const cacheKey = useMulti
    ? `places:${p.lang}:${p.category ?? '*'}:${p.sigunguCode ?? '*'}:multi[${cat3List.join('|')}]:p${pageNo}:n${numOfRows}`
    : `places:${p.lang}:${p.category ?? '*'}:${p.sigunguCode ?? '*'}:${p.cat3 ?? ''}:${p.keyword ?? ''}:p${pageNo}:n${numOfRows}`

  return cachedFetch(
    cacheKey,
    async () => {
    try {
      const contentTypeId = cat?.contentTypeIds[0]
      if (useMulti) {
        // 각 cat3 별로 충분히 큰 numOfRows 로 호출 → contentid dedupe → 클라 페이징.
        // 경북 한 카테고리당 union 최대 ~200건 가정 — 첫 페이지 100건 호출이면 커버.
        const results = await Promise.all(
          cat3List.map((c3) =>
            callTour(
              'areaBasedList2',
              {
                areaCode: GB_AREA_CODE,
                sigunguCode: p.sigunguCode,
                contentTypeId,
                cat3: c3,
                cat2: c3.slice(0, 5),
                cat1: c3.slice(0, 3),
                arrange: 'A',
                pageNo: 1,
                numOfRows: 100,
              },
              p.lang,
            ),
          ),
        )
        const merged = new Map<string, TourApiItem>()
        for (const res of results) {
          for (const it of pickItems(res)) {
            if (it.contentid && isAllowedItem(it)) merged.set(it.contentid, it)
          }
        }
        const all = [...merged.values()]
        if (all.length === 0) {
          return { items: [], totalCount: 0, pageNo, numOfRows }
        }
        const offset = (pageNo - 1) * numOfRows
        const slice = all.slice(offset, offset + numOfRows)
        return {
          items: slice.map((it) => mapToPlace(it, p.category ?? inferCategory(it), p.lang)),
          totalCount: all.length,
          pageNo,
          numOfRows,
        }
      }
      // 키워드 검색 — TourAPI 가 유명 명소(도산서원·월영교 등)를 areacode 공백으로 등록한 경우가 있어
      // 지역(areaCode=35) 검색만으론 누락된다. 전국 검색 결과 중 '주소가 경북'인 항목을 합쳐 recall 을 높인다.
      if (usingKeyword) {
        const kw = (effectiveKeyword ?? '').replace(/\s+/g, '')
        const common = { contentTypeId, keyword: effectiveKeyword, arrange: 'A', pageNo: 1, numOfRows: 100 }
        // 지역(35) 검색이 주축. 전국 보강은 areacode 공백 명소를 줍는 용도라 실패해도 무시(지역 결과 유지).
        const [regional, national] = await Promise.all([
          callTour('searchKeyword2', { areaCode: GB_AREA_CODE, sigunguCode: p.sigunguCode, ...common }, p.lang),
          callTour('searchKeyword2', { ...common }, p.lang).catch(() => null),
        ])
        const merged = new Map<string, TourApiItem>()
        for (const it of pickItems(regional)) {
          if (it.contentid && isAllowedItem(it)) merged.set(it.contentid, it)
        }
        for (const it of national ? pickItems(national) : []) {
          const inGB = it.areacode === String(GB_AREA_CODE) || (it.addr1 ?? '').includes('경상북도')
          if (it.contentid && inGB && !merged.has(it.contentid) && isAllowedItem(it)) {
            merged.set(it.contentid, it)
          }
        }
        // 제목에 검색어가 들어간 항목을 앞으로 (관련도 정렬)
        const all = [...merged.values()].sort((a, b) => {
          const am = (a.title ?? '').replace(/\s+/g, '').includes(kw) ? 0 : 1
          const bm = (b.title ?? '').replace(/\s+/g, '').includes(kw) ? 0 : 1
          return am - bm
        })
        if (all.length === 0) {
          return { items: [], totalCount: 0, pageNo, numOfRows }
        }
        const offset = (pageNo - 1) * numOfRows
        return {
          items: all
            .slice(offset, offset + numOfRows)
            .map((it) => mapToPlace(it, p.category ?? inferCategory(it), p.lang)),
          totalCount: all.length,
          pageNo,
          numOfRows,
        }
      }
      // 카테고리 둘러보기(키워드 없음) — areaBasedList2 서버 페이징.
      const res = await callTour(
        'areaBasedList2',
        {
          areaCode: GB_AREA_CODE,
          sigunguCode: p.sigunguCode,
          contentTypeId,
          cat3: effectiveCat3,
          cat2: effectiveCat3?.slice(0, 5) ?? cat?.cat2,
          cat1: effectiveCat3?.slice(0, 3) ?? cat?.cat2?.slice(0, 3),
          arrange: 'A',
          pageNo,
          numOfRows,
        },
        p.lang,
      )
      const items = pickItems(res).filter(isAllowedItem)
      // 0건은 에러가 아니라 "데이터 없음" — throw 하면 호출부가 네트워크 오류로 오인한다.
      if (items.length === 0) {
        return { items: [], totalCount: 0, pageNo, numOfRows }
      }
      // 필터링으로 떨어진 만큼 totalCount 도 비례 감소 추정. 정확 카운트는 어렵지만 UI 가까이 표시.
      const rawTotal = Number(
        (typeof res.response?.body !== 'string' && res.response?.body?.totalCount) ||
          pickItems(res).length,
      )
      const rawCount = pickItems(res).length
      const totalCount =
        rawCount > 0 ? Math.round((items.length / rawCount) * rawTotal) : items.length
      return {
        items: items.map((it) => mapToPlace(it, p.category ?? inferCategory(it), p.lang)),
        totalCount,
        pageNo,
        numOfRows,
      }
    } catch (err) {
      warn('searchPlaces', err)
      const fb = fallbackPlaces(p)
      return {
        items: fb,
        totalCount: fb.length,
        pageNo,
        numOfRows,
        error: classifyError(err),
      }
    }
    },
    undefined,
    (r) => r.items.length > 0 && !r.error,
  )
}

/**
 * 건수 전용 조회 — 탭·칩에 붙는 숫자. 1건짜리 검색의 totalCount 는 그 1건이 제외 규칙(숙박·글램핑)에
 * 걸리면 0 으로 떨어지므로, 항목을 거치지 않고 응답 헤더의 totalCount 를 그대로 쓴다.
 * cat3 가 여럿인 카테고리(체험)는 cat3 별 합, 키워드 카테고리(서원·둘레길)는 키워드 검색 totalCount.
 * 실패하면 undefined (호출부는 숫자를 붙이지 않는다). 24h 캐시.
 */
export async function countPlaces(p: {
  category?: CategoryId
  sigunguCode?: number
  lang: Lang
}): Promise<number | undefined> {
  const cat = p.category ? CATEGORY_MAP[p.category] : undefined
  const cacheKey = `count:${p.lang}:${p.category ?? '*'}:${p.sigunguCode ?? '*'}`
  const total = (res: TourApiResponse) =>
    Number((typeof res.response?.body !== 'string' && res.response?.body?.totalCount) || 0)
  return cachedFetch(
    cacheKey,
    async () => {
      try {
        const contentTypeId = cat?.contentTypeIds[0]
        const cat3List: string[] = cat?.cat3Aliases ?? (cat?.cat3 ? [cat.cat3] : [])
        if (cat3List.length > 1) {
          const rs = await Promise.all(
            cat3List.map((c3) =>
              callTour('areaBasedList2', {
                areaCode: GB_AREA_CODE, sigunguCode: p.sigunguCode, contentTypeId,
                cat3: c3, cat2: c3.slice(0, 5), cat1: c3.slice(0, 3), numOfRows: 1,
              }, p.lang),
            ),
          )
          return rs.reduce((a, r) => a + total(r), 0)
        }
        if (cat && !cat.cat3 && cat.forceKeyword) {
          const r = await callTour('searchKeyword2', {
            areaCode: GB_AREA_CODE, sigunguCode: p.sigunguCode, contentTypeId, keyword: cat.forceKeyword, numOfRows: 1,
          }, p.lang)
          return total(r)
        }
        const c3 = cat?.cat3
        const r = await callTour('areaBasedList2', {
          areaCode: GB_AREA_CODE, sigunguCode: p.sigunguCode, contentTypeId,
          cat3: c3, cat2: c3?.slice(0, 5) ?? cat?.cat2, cat1: c3?.slice(0, 3) ?? cat?.cat2?.slice(0, 3), numOfRows: 1,
        }, p.lang)
        return total(r)
      } catch (err) {
        warn('countPlaces', err)
        return undefined
      }
    },
    undefined,
    (r) => r !== undefined,
  )
}

/**
 * FR-22 — 무장애 등록 장소 전용 검색 (KorWithService2/areaBasedList2).
 * 응답 자체가 무장애 등록 장소만 담고 있어 secondary 필터가 불필요하다. 빈 응답 = 등록 장소 없음.
 */
export async function searchAccessiblePlaces(p: SearchParams): Promise<SearchResult> {
  const pageNo = p.pageNo ?? 1
  const numOfRows = p.numOfRows ?? 30
  const cat = p.category ? CATEGORY_MAP[p.category] : undefined
  const cat3List: string[] = cat?.cat3Aliases ?? (cat?.cat3 ? [cat.cat3] : [])
  const isMultiCat3 = cat3List.length > 1
  const effectiveKeyword =
    p.keyword?.trim() ||
    (cat && !cat.cat3 && !cat.cat3Aliases ? cat.forceKeyword : undefined)
  const usingKeyword = !!effectiveKeyword
  const useMulti = isMultiCat3 && !usingKeyword

  const cacheKey = useMulti
    ? `a11y:${p.lang}:${p.category ?? '*'}:${p.sigunguCode ?? '*'}:multi[${cat3List.join('|')}]:p${pageNo}:n${numOfRows}`
    : `a11y:${p.lang}:${p.category ?? '*'}:${p.sigunguCode ?? '*'}:${p.keyword ?? ''}:p${pageNo}:n${numOfRows}`

  const tagAccessible = (it: TourApiItem): Place => {
    const place = mapToPlace(it, p.category ?? inferCategory(it), p.lang)
    return {
      ...place,
      accessibility: { ...(place.accessibility ?? {}), wheelchair: true },
    }
  }

  return cachedFetch(
    cacheKey,
    async () => {
      try {
        const contentTypeId = cat?.contentTypeIds[0]
        if (useMulti) {
          const results = await Promise.all(
            cat3List.map((c3) =>
              callTour(
                'areaBasedList2',
                {
                  areaCode: GB_AREA_CODE,
                  sigunguCode: p.sigunguCode,
                  contentTypeId,
                  cat3: c3,
                  cat2: c3.slice(0, 5),
                  cat1: c3.slice(0, 3),
                  arrange: 'A',
                  pageNo: 1,
                  numOfRows: 100,
                },
                p.lang,
                'with',
              ),
            ),
          )
          const merged = new Map<string, TourApiItem>()
          for (const res of results) {
            for (const it of pickItems(res)) {
              if (it.contentid && isAllowedItem(it)) merged.set(it.contentid, it)
            }
          }
          const all = [...merged.values()]
          const offset = (pageNo - 1) * numOfRows
          const slice = all.slice(offset, offset + numOfRows)
          return {
            items: slice.map(tagAccessible),
            totalCount: all.length,
            pageNo,
            numOfRows,
          }
        }
        const path = usingKeyword ? 'searchKeyword2' : 'areaBasedList2'
        const res = await callTour(
          path,
          {
            areaCode: GB_AREA_CODE,
            sigunguCode: p.sigunguCode,
            contentTypeId,
            cat3: cat?.cat3,
            cat2: cat?.cat3?.slice(0, 5) ?? cat?.cat2,
            cat1: cat?.cat3?.slice(0, 3) ?? cat?.cat2?.slice(0, 3),
            keyword: effectiveKeyword,
            arrange: 'A',
            pageNo,
            numOfRows,
          },
          p.lang,
          'with',
        )
        const items = pickItems(res).filter(isAllowedItem)
        const totalCount = Number(
          (typeof res.response?.body !== 'string' && res.response?.body?.totalCount) ||
            items.length,
        )
        return {
          items: items.map(tagAccessible),
          totalCount,
          pageNo,
          numOfRows,
        }
      } catch (err) {
        warn('searchAccessiblePlaces', err)
        return {
          items: [],
          totalCount: 0,
          pageNo,
          numOfRows,
          error: classifyError(err),
        }
      }
    },
    undefined,
    (r) => r.items.length > 0 && !r.error,
  )
}

/**
 * 반려동물 동반여행 — 응답 장소는 모두 동반 가능이므로 accessibility.pet=true 로 태깅해
 * 코스 엔진 가산에 쓴다. 실패 시 빈 결과(호출부가 일반 검색으로 폴백).
 */
export async function searchPetFriendlyPlaces(p: SearchParams): Promise<SearchResult> {
  const pageNo = p.pageNo ?? 1
  const numOfRows = p.numOfRows ?? 30
  const cacheKey = `pet:${p.lang}:${p.sigunguCode ?? '*'}:c${p.category ?? '*'}:p${pageNo}:n${numOfRows}`
  return cachedFetch(
    cacheKey,
    async () => {
      try {
        const res = await callTour(
          'areaBasedList2',
          {
            areaCode: GB_AREA_CODE,
            sigunguCode: p.sigunguCode,
            arrange: 'A',
            pageNo,
            numOfRows,
          },
          p.lang,
          'pet',
        )
        const items = pickItems(res).filter(isAllowedItem)
        const totalCount = Number(
          (typeof res.response?.body !== 'string' && res.response?.body?.totalCount) ||
            items.length,
        )
        return {
          items: items.map((it) => {
            const place = mapToPlace(it, p.category ?? inferCategory(it), p.lang)
            return { ...place, accessibility: { ...(place.accessibility ?? {}), pet: true } }
          }),
          totalCount,
          pageNo,
          numOfRows,
        }
      } catch (err) {
        warn('searchPetFriendlyPlaces', err)
        return { items: [], totalCount: 0, pageNo, numOfRows, error: classifyError(err) }
      }
    },
    undefined,
    (r) => r.items.length > 0 && !r.error,
  )
}

/** FR-22 — 반경 기반 주변 탐색 */
export async function searchAround(center: LatLng, radiusM: number, lang: Lang): Promise<Place[]> {
  // v2: 경북(areacode 35·주소) 필터 추가 이전에 저장된 전국 결과 캐시를 무효화한다.
  const cacheKey = `around:v2:${lang}:${center.lat.toFixed(3)}:${center.lng.toFixed(3)}:${radiusM}`
  return cachedFetch(
    cacheKey,
    async () => {
      try {
        const res = await callTour(
          'locationBasedList2',
          { mapX: center.lng, mapY: center.lat, radius: radiusM, arrange: 'E' },
          lang,
        )
        // 반경 검색은 전국 대상이라 대구·울산 등 인접 지역이 섞인다 — 경북(areacode 35 또는 주소) 만 남긴다.
        const items = pickItems(res)
          .filter(isAllowedItem)
          .filter((it) => it.areacode === String(GB_AREA_CODE) || (it.addr1 ?? '').includes('경상북도'))
        if (items.length === 0) throw new Error('empty response')
        return items.map((it) => mapToPlace(it, inferCategory(it), lang))
      } catch (err) {
        warn('searchAround', err)
        return fallbackAround(center, radiusM)
      }
    },
    undefined,
    (r) => r.length > 0,
  )
}

/**
 * FR-15, FR-16 — 축제 검색. 표시 소스는 행정안전부 표준데이터 단일이다.
 * TourAPI 응답은 enrichMissingImages 의 이미지 매칭 풀로만 쓴다 — 두 소스를 머지하면
 * 같은 행사가 다른 표기로 두 번 뜨기 때문.
 * 사진 우선순위: TourAPI image pool → homepage og:image → 디자인 카드 폴백.
 */
export async function searchFestivals(
  lang: Lang,
  range?: { startYmd: string; endYmd: string },
): Promise<Festival[]> {
  const cacheKey = `festivals-std-region:${lang}:${range?.startYmd ?? ''}:${range?.endYmd ?? ''}`
  return cachedFetch(
    cacheKey,
    async () => {
      // 실패는 throw 로 전파 — 호출부(축제 목록)가 "결과 없음"이 아니라 재시도 버튼을 보여야 한다.
      const items = await fetchStandardFestivalsGB(lang)
      const enriched = await enrichMissingImages(items, lang)

      if (range) {
        const startMinus = shiftYmd(range.startYmd, -7)
        const endPlus = shiftYmd(range.endYmd, 7)
        return enriched.filter(
          (f) => !(f.eventEndDate < startMinus || f.eventStartDate > endPlus),
        )
      }
      return enriched
    },
    undefined,
    (r) => r.length > 0,
  )
}

/**
 * 표준데이터 출처 행사(thumbnail 없음)의 사진 보강 — TourAPI 경북 행사 image pool 로
 * 정확/부분 매칭하고, 그래도 없으면 주최 시·군의 대표 관광지 사진으로 채운다.
 * (홈페이지 og:image 는 배너·모델 사진 등 행사와 무관한 이미지가 섞여 들어와 쓰지 않는다.)
 */
async function enrichMissingImages(merged: Festival[], lang: Lang): Promise<Festival[]> {
  const missing = merged.filter((f) => !f.thumbnail)
  if (missing.length === 0) return merged

  // 매칭 풀 — TourAPI 행사 image pool (캐시 24h)
  const pool = await loadFestivalImagePool(lang)
  const exactMap = new Map<string, string>() // normalizedName → image url
  const partials: Array<{ norm: string; url: string }> = []

  const collect = (name: string, img?: string) => {
    if (!name || !img) return
    const norm = normalizeName(name)
    if (!exactMap.has(norm)) exactMap.set(norm, img)
    if (norm.length >= 4) partials.push({ norm, url: img })
  }
  for (const it of pool) {
    const img = forceHttps(it.firstimage || it.firstimage2 || undefined)
    collect(it.title ?? '', img)
  }

  const stage12 = merged.map((f) => {
    if (f.thumbnail) return f
    const targetNorm = normalizeName(f.name)
    // 1) 정확 매칭
    const exact = exactMap.get(targetNorm)
    if (exact) return { ...f, thumbnail: exact }
    // 2) 부분 매칭 — 한쪽 이름이 다른 쪽을 포함하는 경우 (예: "차전장군노국공주축제" ⊃ "노국공주축제")
    //    또는 그 반대 — 표기 차이로 정확 매칭이 자주 실패한다.
    const minLen = 4
    if (targetNorm.length < minLen) return f
    for (const { norm, url } of partials) {
      if (norm.length < minLen) continue
      if (targetNorm.includes(norm) || norm.includes(targetNorm)) {
        return { ...f, thumbnail: url }
      }
    }
    return f
  })

  // 3) 시·군 대표 사진 — 남은 행사는 주최 시·군의 대표 관광지 사진으로(시군당 1회 조회, 캐시).
  const needRegion = [...new Set(stage12.filter((f) => !f.thumbnail && f.sigunguCode).map((f) => f.sigunguCode!))]
  if (needRegion.length === 0) return stage12
  const regionImg = new Map<number, string>()
  await Promise.all(
    needRegion.map(async (code) => {
      const url = await loadRegionImage(code, lang)
      if (url) regionImg.set(code, url)
    }),
  )
  return stage12.map((f) => {
    if (f.thumbnail || !f.sigunguCode) return f
    const url = regionImg.get(f.sigunguCode)
    return url ? { ...f, thumbnail: url, thumbnailIsRegion: true } : f
  })
}

/**
 * 시·군 대표 사진 — 그 시군의 관광지(대표 이미지 있는 것) 중 첫 장. 사진 없는 축제·장소의 폴백용. 24h 캐시.
 */
export async function loadRegionImage(sigunguCode: number, lang: Lang): Promise<string | undefined> {
  return cachedFetch(
    `region-img:${lang}:${sigunguCode}`,
    async () => {
      const pick = (items: Place[]) => items.find((p) => !!p.thumbnail)?.thumbnail
      const a = await searchPlaces({ sigunguCode, lang, category: 'attraction', numOfRows: 10 }).catch(() => undefined)
      const fromAttraction = a ? pick(a.items) : undefined
      if (fromAttraction) return fromAttraction
      const b = await searchPlaces({ sigunguCode, lang, numOfRows: 10 }).catch(() => undefined)
      return b ? pick(b.items) : undefined
    },
    undefined,
    (r) => !!r,
  )
}

/** TourAPI 경북 행사 전체 (areaBasedList2 contentTypeId=15) — 이미지 매칭 풀. 분기 단위 갱신이라 24h 캐시 충분. */
async function loadFestivalImagePool(lang: Lang): Promise<TourApiItem[]> {
  return cachedFetch(
    `festival-img-pool:${lang}`,
    async () => {
      try {
        const res = await callTour(
          'areaBasedList2',
          {
            areaCode: GB_AREA_CODE,
            contentTypeId: 15,
            arrange: 'A',
            numOfRows: 200,
          },
          lang,
        )
        return pickItems(res)
      } catch {
        return []
      }
    },
    undefined,
    (r) => r.length > 0,
  )
}

/**
 * id 만으로 장소를 처음부터 로드. router state 없이 직접 진입한 공유/북마크 링크용.
 * detailCommon2 응답으로 좌표·주소·카테고리(추론)까지 채운다.
 */
export async function loadPlaceById(id: string, lang: Lang): Promise<Place | null> {
  if (!id) return null
  const cacheKey = `placeById:${lang}:${id}`
  return cachedFetch(
    cacheKey,
    async () => {
      try {
        const res = await callTour('detailCommon2', { contentId: id }, lang)
        const it = pickItems(res)[0]
        if (!it) return null
        return mapToPlace(it, inferCategory(it), lang)
      } catch (err) {
        warn('loadPlaceById', err)
        return null
      }
    },
    undefined,
    (r) => r !== null,
  )
}

/**
 * Festival 딥링크/공유 진입용 — 행사 기간까지 복원한다. 기간이 비면 딥링크에서
 * 날짜·상태배지·캘린더 버튼이 모두 사라지므로 반드시 채운다.
 */
export async function loadFestivalById(id: string, lang: Lang): Promise<Festival | null> {
  if (id.startsWith('std-')) {
    const list = await fetchStandardFestivalsGB(lang).catch(() => [] as Festival[])
    const found = list.find((f) => f.id === id)
    if (found) return found
    // 목록에 없으면(과거 인스턴스 등) id 에 박힌 시작일이라도 살린다.
    const ymd = id.match(/^std-(\d{8})-/)?.[1]
    return ymd
      ? {
          id,
          contentTypeId: 15,
          category: 'festival',
          name: '',
          address: '',
          position: { lat: 0, lng: 0 },
          lang,
          eventStartDate: ymd,
          eventEndDate: ymd,
        }
      : null
  }

  // TourAPI 행사 — detailCommon2 로 좌표·기간 복원
  const cacheKey = `festById:${lang}:${id}`
  return cachedFetch(
    cacheKey,
    async () => {
      try {
        const res = await callTour('detailCommon2', { contentId: id }, lang)
        const it = pickItems(res)[0]
        if (!it) return null
        const base = mapToPlace(it, 'festival', lang)
        return {
          ...base,
          category: 'festival' as const,
          eventStartDate: it.eventstartdate ?? '',
          eventEndDate: it.eventenddate ?? it.eventstartdate ?? '',
        }
      } catch (err) {
        warn('loadFestivalById', err)
        return null
      }
    },
    undefined,
    (r) => r !== null,
  )
}

/** FR-07, FR-20 — 장소 상세 보강. detailCommon2 + detailIntro2 동시 호출. */
export async function loadDetail(
  contentId: string,
  contentTypeId: number,
  lang: Lang,
): Promise<Partial<Place>> {
  if (contentId.startsWith('mock-')) {
    return {} // mock 은 이미 모든 정보 포함
  }
  const cacheKey = `detail:${lang}:${contentId}:t${contentTypeId}`
  return cachedFetch(cacheKey, async () => {
    try {
      // V2 detailCommon2 는 defaultYN/overviewYN 플래그를 받지 않는다 — 보내면 응답 전체가 실패.
      const [commonRes, introRes, imageRes] = await Promise.allSettled([
        callTour('detailCommon2', { contentId }, lang),
        contentTypeId > 0
          ? callTour('detailIntro2', { contentId, contentTypeId }, lang)
          : Promise.reject(new Error('no contentTypeId')),
        callTour('detailImage2', { contentId, numOfRows: 10 }, lang),
      ])

      const out: Partial<Place> = {}
      if (commonRes.status === 'fulfilled') {
        const it = pickItems(commonRes.value)[0]
        if (it) {
          out.overview = cleanHtml(it.overview)
          out.thumbnail = forceHttps(it.firstimage || it.firstimage2 || undefined)
          out.homepage = extractHomepage(it.homepage)
          out.tel = it.tel || undefined
          out.openHours = it.usetime || undefined
        }
      }
      if (introRes.status === 'fulfilled') {
        const it = pickItems(introRes.value)[0] as Record<string, string | undefined> | undefined
        if (it) Object.assign(out, mapIntroToPlace(it, contentTypeId))
      }
      if (imageRes.status === 'fulfilled') {
        const list = pickItems(imageRes.value) as Array<{ originimgurl?: string }>
        const images = list
          .map((x) => forceHttps(x.originimgurl))
          .filter((u): u is string => !!u)
        if (images.length > 0) {
          out.images = images
          // 더 큰/공식 originimgurl 이미지를 hero 로 우선 사용
          if (!out.thumbnail) out.thumbnail = images[0]
          else if (images[0]) out.thumbnail = images[0]
        }
      }
      return out
    } catch (err) {
      warn('loadDetail', err)
      return {}
    }
  })
}

/**
 * KorWithService2/detailWithTour2 — 무장애여행정보 상세.
 * 응답 필드는 자유 텍스트(한국어)라 빈 문자열은 빼고 채워진 것만 반환한다.
 */
export async function loadAccessibilityDetail(
  contentId: string,
  lang: Lang,
): Promise<import('@/types/domain').AccessibilityTour> {
  if (contentId.startsWith('mock-')) return {}
  const cacheKey = `a11y-detail:${lang}:${contentId}`
  return cachedFetch(cacheKey, async () => {
    try {
      const res = await callTour('detailWithTour2', { contentId }, lang, 'with')
      const it = pickItems(res)[0] as Record<string, string | undefined> | undefined
      if (!it) return {}
      const keys: Array<keyof import('@/types/domain').AccessibilityTour> = [
        'parking', 'route', 'publictransport', 'ticketoffice', 'promotion',
        'exit', 'elevator', 'restroom', 'guidehuman', 'guidesystem',
        'blindhandicapetc', 'handicapetc', 'audioguide', 'videoguide',
        'braileblock', 'helpdog', 'stroller', 'lactationroom',
        'signguide', 'videosignlanguage', 'hearinghandicapetc', 'bigprint',
      ]
      const out: import('@/types/domain').AccessibilityTour = {}
      for (const k of keys) {
        const v = (it as Record<string, string | undefined>)[k]?.trim()
        if (v) out[k] = v
      }
      return out
    } catch (err) {
      warn('loadAccessibilityDetail', err)
      return {}
    }
  })
}

/**
 * detailIntro2 응답의 contentType별 필드를 도메인 필드로 매핑한다.
 * contentTypeId 마다 필드명이 달라 분기가 필요하다 — 32(숙박), 39(음식점), 15(축제), 12(관광지), 14(문화시설), 28(레포츠).
 */
function mapIntroToPlace(
  it: Record<string, string | undefined>,
  contentTypeId: number,
): Partial<Place> {
  const out: Partial<Place> = {}
  const url = (s?: string) => extractHomepage(s)
  switch (contentTypeId) {
    case 32: // 숙박
      out.bookingUrl = url(it.reservationurl) ?? url(it.reservationlodging)
      out.bookingInfo = stripTags(it.reservationlodging)
      out.infoCenter = it.infocenterlodging
      out.parking = it.parkinglodging
      out.openHours = combineHours(it.checkintime, it.checkouttime)
      out.accessibility = {
        // 숙박은 barrierfree 키워드가 일부 데이터에 있음. 보수적으로 미설정.
        creditCard: ynFlag(it.chkcreditcardlodging),
      }
      break
    case 39: // 음식점
      out.bookingInfo = stripTags(it.reservationfood)
      out.infoCenter = it.infocenterfood
      out.parking = it.parkingfood
      out.openHours = it.opentimefood
      out.restDate = it.restdatefood
      out.accessibility = { creditCard: ynFlag(it.chkcreditcardfood) }
      break
    case 15: // 축제·공연·행사
      out.homepage = url(it.eventhomepage) ?? out.homepage
      out.useFee = it.usetimefestival
      out.sponsor = combine(it.sponsor1, it.sponsor2)
      out.infoCenter = it.sponsor1tel || it.sponsor2tel
      break
    case 14: // 문화시설
      out.infoCenter = it.infocenterculture
      out.parking = it.parkingculture
      out.useFee = it.usefee
      out.openHours = it.usetimeculture
      out.restDate = it.restdateculture
      out.accessibility = {
        wheelchair: ynFlag(it.chkdisabilityculture),
        babyStroller: ynFlag(it.chkbabycarriageculture),
        pet: ynFlag(it.chkpetculture),
        creditCard: ynFlag(it.chkcreditcardculture),
      }
      break
    case 28: // 레포츠
      out.infoCenter = it.infocenterleports
      out.parking = it.parkingleports
      out.useFee = it.usefeeleports
      out.openHours = it.usetimeleports
      out.restDate = it.restdateleports
      out.accessibility = {
        babyStroller: ynFlag(it.chkbabycarriageleports),
        pet: ynFlag(it.chkpetleports),
        creditCard: ynFlag(it.chkcreditcardleports),
      }
      break
    case 38: // 쇼핑
      out.infoCenter = it.infocentershopping
      out.parking = it.parkingshopping
      out.openHours = it.opentime
      out.restDate = it.restdateshopping
      out.accessibility = {
        babyStroller: ynFlag(it.chkbabycarriageshopping),
        pet: ynFlag(it.chkpetshopping),
        creditCard: ynFlag(it.chkcreditcardshopping),
      }
      break
    case 12: // 관광지
    default:
      out.infoCenter = it.infocenter
      out.parking = it.parking
      out.useFee = it.usefee
      out.openHours = it.usetime
      out.restDate = it.restdate
      out.accessibility = {
        babyStroller: ynFlag(it.chkbabycarriage),
        pet: ynFlag(it.chkpet),
        creditCard: ynFlag(it.chkcreditcard),
      }
      break
  }
  return out
}

/** "Y" / "가능" 류는 true, "N" / "불가" 류는 false, 모호하거나 빈값은 undefined. */
function ynFlag(v?: string): boolean | undefined {
  if (!v) return undefined
  const s = v.trim().toLowerCase()
  if (!s) return undefined
  if (/^(y|yes|가능|있음|true|1)$/.test(s)) return true
  if (/^(n|no|불가|없음|false|0)$/.test(s)) return false
  // "가능"이 포함된 자유 텍스트도 true 로
  if (/가능|있음|허용/.test(s)) return true
  if (/불가|없음|제한/.test(s)) return false
  return undefined
}

function combineHours(a?: string, b?: string): string | undefined {
  if (!a && !b) return undefined
  if (a && b) return `Check-in ${a} · Check-out ${b}`
  return a ?? b
}

function combine(a?: string, b?: string): string | undefined {
  return [a, b].filter(Boolean).join(' / ') || undefined
}

function stripTags(s?: string): string | undefined {
  if (!s) return undefined
  return s.replace(/<[^>]+>/g, '').trim() || undefined
}

// ─── Fallback helpers ──────────────────────────────────────────────────────
// API 실패 시 mock 으로 폴백하지 않는다 — 빈 결과 + 콘솔 경고.

function fallbackPlaces(_p: SearchParams): Place[] {
  void _p
  return []
}

function fallbackAround(_center: LatLng, _radiusM: number): Place[] {
  void _center
  void _radiusM
  return []
}

