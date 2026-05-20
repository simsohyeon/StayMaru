import axios from 'axios'
import { cachedFetch } from '@/lib/cache'
import { CATEGORY_MAP } from '@/constants/categories'
import { GB_AREA_CODE } from '@/constants/sigungu'
import type { CategoryId, Festival, Lang, LatLng, Place } from '@/types/domain'

/**
 * 한국관광공사 OpenAPI 클라이언트.
 *
 * 보안:
 *  - serviceKey 는 절대 프론트 번들에 포함시키지 않는다.
 *  - 개발 환경: Vite dev proxy(/api/tour → apis.data.go.kr/B551011, 키 주입은 vite.config.ts)
 *  - 운영 환경: Vercel/Netlify Edge Function 등 서버리스 프록시(VITE_TOUR_PROXY_BASE)
 *
 * 폴백:
 *  - 실패 시 빈 배열을 반환한다. (mock 데이터 모두 제거됨)
 *  - 콘솔 경고로 원인을 표시하므로 dev 콘솔에서 진단 가능.
 */

const PROXY_BASE = (import.meta.env.VITE_TOUR_PROXY_BASE as string | undefined) || '/api/tour'

// TourAPI V2 — 2025년 신규 발급 키는 V2 엔드포인트로만 응답.
// V1(KorService1) 은 신규 발급 키에 대해 HTTP 500 "Unexpected errors" 반환.
const LANG_PATH: Record<Lang, string> = {
  ko: 'KorService2',
  en: 'EngService2',
  ja: 'JpnService2',
  zh: 'ChsService2',
}

const client = axios.create({
  timeout: 8000,
  headers: { Accept: 'application/json' },
})

interface TourApiItem {
  contentid?: string
  contenttypeid?: string
  title?: string
  addr1?: string
  firstimage?: string
  firstimage2?: string
  mapx?: string
  mapy?: string
  sigungucode?: string
  tel?: string
  homepage?: string
  overview?: string
  eventstartdate?: string
  eventenddate?: string
  usetime?: string
}

interface TourApiBody {
  items?: { item?: TourApiItem[] | TourApiItem } | string
  totalCount?: number
}

interface TourApiResponse {
  response?: {
    header?: { resultCode?: string; resultMsg?: string }
    body?: TourApiBody
  }
}

function pickItems(res: TourApiResponse): TourApiItem[] {
  const items = res?.response?.body?.items
  if (!items || typeof items === 'string') return []
  const v = items.item
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

function mapToPlace(item: TourApiItem, category: CategoryId, lang: Lang): Place {
  const lng = Number(item.mapx ?? 0)
  const lat = Number(item.mapy ?? 0)
  return {
    id: item.contentid ?? `unknown-${Math.random()}`,
    contentTypeId: Number(item.contenttypeid ?? 0),
    category,
    name: item.title ?? '',
    address: item.addr1 ?? '',
    sigunguCode: item.sigungucode ? Number(item.sigungucode) : undefined,
    position: { lat, lng },
    thumbnail: item.firstimage || item.firstimage2 || undefined,
    overview: item.overview,
    tel: item.tel,
    homepage: extractHomepage(item.homepage),
    openHours: item.usetime,
    lang,
  }
}

function extractHomepage(raw?: string): string | undefined {
  if (!raw) return undefined
  const m = raw.match(/href="([^"]+)"/i)
  return m?.[1] ?? raw
}

function mapToFestival(item: TourApiItem, lang: Lang): Festival {
  const base = mapToPlace(item, 'festival', lang)
  return {
    ...base,
    category: 'festival',
    eventStartDate: item.eventstartdate ?? '',
    eventEndDate: item.eventenddate ?? '',
  }
}

async function callTour(
  path: string,
  params: Record<string, string | number | undefined>,
  lang: Lang,
): Promise<TourApiResponse> {
  const url = `${PROXY_BASE}/${LANG_PATH[lang]}/${path}`
  const search = new URLSearchParams({
    MobileOS: 'ETC',
    MobileApp: 'Shimmaru',
    _type: 'json',
  })
  // 호출자가 명시하지 않으면 기본 numOfRows=30 / pageNo=1
  if (!('numOfRows' in params)) search.set('numOfRows', '30')
  if (!('pageNo' in params)) search.set('pageNo', '1')
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v))
  }
  const { data } = await client.get<TourApiResponse | string>(`${url}?${search.toString()}`)
  // 응답이 평문 (예: "Forbidden") 일 때 — 해당 언어 서비스에 활용신청이 없는 경우
  if (typeof data === 'string') {
    const trimmed = data.trim().slice(0, 80)
    throw new TourApiError(`${LANG_PATH[lang]}/${path}: ${trimmed}`, 'FORBIDDEN')
  }
  // 관광공사 API 는 200을 주고도 body 헤더에 에러 코드를 담아준다. 명시적으로 잡는다.
  const code = data?.response?.header?.resultCode
  if (code && code !== '0000') {
    const msg = data?.response?.header?.resultMsg ?? 'unknown'
    throw new TourApiError(`${path} resultCode=${code} (${msg})`, code)
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
          `공공데이터포털에서 "한국관광공사_영문/일본어/중국어 관광정보 서비스(V2)" 도 활용신청 하세요.`,
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
  console.warn(`[tour:${scope}] ${msg} — mock 데이터로 폴백합니다.`)
}

export interface SearchParams {
  category?: CategoryId
  sigunguCode?: number
  keyword?: string
  lang: Lang
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
}

/** FR-13, FR-14, FR-22 — 지역/카테고리/키워드 통합 탐색 (페이징 포함). */
export async function searchPlaces(p: SearchParams): Promise<SearchResult> {
  const pageNo = p.pageNo ?? 1
  const numOfRows = p.numOfRows ?? 30
  const cacheKey = `places:${p.lang}:${p.category ?? '*'}:${p.sigunguCode ?? '*'}:${p.keyword ?? ''}:p${pageNo}:n${numOfRows}`
  return cachedFetch(cacheKey, async () => {
    try {
      const cat = p.category ? CATEGORY_MAP[p.category] : undefined
      const contentTypeId = cat?.contentTypeIds[0]
      // 사용자가 입력한 키워드가 우선. 없을 때 카테고리의 forceKeyword 가 있으면 그것 사용 (cat3 없을 때만).
      const effectiveKeyword =
        p.keyword?.trim() || (cat && !cat.cat3 ? cat.forceKeyword : undefined)
      const usingKeyword = !!effectiveKeyword
      const path = usingKeyword ? 'searchKeyword2' : 'areaBasedList2'
      const res = await callTour(
        path,
        {
          areaCode: GB_AREA_CODE,
          sigunguCode: p.sigunguCode,
          contentTypeId,
          // cat3(9자) 가 있으면 정확 분류, 없으면 cat2(5자) 로 넓힘
          cat3: cat?.cat3,
          cat2: cat?.cat3?.slice(0, 5) ?? cat?.cat2,
          cat1: cat?.cat3?.slice(0, 3) ?? cat?.cat2?.slice(0, 3),
          keyword: effectiveKeyword,
          arrange: 'A', // 제목순 (모두 안전)
          pageNo,
          numOfRows,
        },
        p.lang,
      )
      const items = pickItems(res)
      if (items.length === 0) throw new Error('empty response')
      const totalCount = Number(
        (typeof res.response?.body !== 'string' && res.response?.body?.totalCount) || items.length,
      )
      return {
        items: items.map((it) => mapToPlace(it, p.category ?? inferCategory(it), p.lang)),
        totalCount,
        pageNo,
        numOfRows,
      }
    } catch (err) {
      warn('searchPlaces', err)
      const fb = fallbackPlaces(p)
      // mock 폴백은 페이징 없이 모두 반환
      return { items: fb, totalCount: fb.length, pageNo, numOfRows }
    }
  })
}

/** FR-22 — 반경 기반 주변 탐색 */
export async function searchAround(center: LatLng, radiusM: number, lang: Lang): Promise<Place[]> {
  const cacheKey = `around:${lang}:${center.lat.toFixed(3)}:${center.lng.toFixed(3)}:${radiusM}`
  return cachedFetch(cacheKey, async () => {
    try {
      const res = await callTour(
        'locationBasedList2',
        { mapX: center.lng, mapY: center.lat, radius: radiusM, arrange: 'E' },
        lang,
      )
      const items = pickItems(res)
      if (items.length === 0) throw new Error('empty response')
      return items.map((it) => mapToPlace(it, inferCategory(it), lang))
    } catch (err) {
      warn('searchAround', err)
      return fallbackAround(center, radiusM)
    }
  })
}

/** FR-15, FR-16 — 축제 검색. dateRange 가 주어지면 그 기간 ± 7일 안의 축제로 좁힌다. */
export async function searchFestivals(
  lang: Lang,
  range?: { startYmd: string; endYmd: string },
): Promise<Festival[]> {
  const cacheKey = `festivals:${lang}:${range?.startYmd ?? ''}:${range?.endYmd ?? ''}`
  return cachedFetch(cacheKey, async () => {
    try {
      // range 미지정 시 "오늘 기준 365일 전" 부터 검색 — 진행 중인 축제와 가까운 다가올 축제를 함께 노출.
      // (관광공사 축제 데이터는 보통 1~2년 단위 입력이라 너무 좁게 잡으면 0건이 빈번하다.)
      const start = range?.startYmd ?? shiftYmd(todayYmd(), -365)
      const res = await callTour(
        'searchFestival2',
        {
          areaCode: GB_AREA_CODE,
          eventStartDate: start,
          eventEndDate: range?.endYmd,
        },
        lang,
      )
      const items = pickItems(res)
      if (items.length === 0) throw new Error('empty response')
      return items.map((it) => mapToFestival(it, lang))
    } catch (err) {
      warn('searchFestivals', err)
      return fallbackFestivals(range)
    }
  })
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
      // V2 의 detailCommon2 는 V1 과 달리 defaultYN/overviewYN 같은 플래그를 받지 않는다.
      // (보내면 INVALID_REQUEST_PARAMETER_ERROR 로 응답 전체가 실패함)
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
          out.overview = it.overview ?? undefined
          out.thumbnail = it.firstimage || it.firstimage2 || undefined
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
        const images = list.map((x) => x.originimgurl).filter((u): u is string => !!u)
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
 * detailIntro2 응답의 contentType별 필드를 도메인 필드로 매핑한다.
 * 관광공사 API는 contentTypeId 마다 필드명이 다르다 — 32(숙박), 39(음식점), 15(축제), 12(관광지), 14(문화시설), 28(레포츠).
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
      break
    case 39: // 음식점
      out.bookingInfo = stripTags(it.reservationfood)
      out.infoCenter = it.infocenterfood
      out.parking = it.parkingfood
      out.openHours = it.opentimefood
      out.restDate = it.restdatefood
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
      break
    case 28: // 레포츠
      out.infoCenter = it.infocenterleports
      out.parking = it.parkingleports
      out.useFee = it.usefeeleports
      out.openHours = it.usetimeleports
      out.restDate = it.restdateleports
      break
    case 38: // 쇼핑
      out.infoCenter = it.infocentershopping
      out.parking = it.parkingshopping
      out.openHours = it.opentime
      out.restDate = it.restdateshopping
      break
    case 12: // 관광지
    default:
      out.infoCenter = it.infocenter
      out.parking = it.parking
      out.useFee = it.usefee
      out.openHours = it.usetime
      out.restDate = it.restdate
      break
  }
  return out
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
// API 호출 실패 시 더 이상 mock 데이터로 폴백하지 않는다 — 빈 결과 + 콘솔 경고.
// (이전 버전에는 안동 하회마을 등 mock 장소가 있었지만 사용자 요청으로 제거됨)

function fallbackPlaces(_p: SearchParams): Place[] {
  return []
}

function fallbackAround(_center: LatLng, _radiusM: number): Place[] {
  return []
}

function fallbackFestivals(_range?: { startYmd: string; endYmd: string }): Festival[] {
  return []
}

function inferCategory(item: TourApiItem): CategoryId {
  const id = Number(item.contenttypeid ?? 0)
  const name = (item.title ?? '').toLowerCase()
  if (id === 15) return 'festival'
  if (id === 38) return 'market'
  if (id === 39) return 'market'
  if (name.includes('서원')) return 'seowon'
  if (name.includes('사') && id === 12) return 'temple'
  if (name.includes('한옥') || name.includes('고택')) return 'hanok'
  if (id === 32) return 'hanok'
  if (id === 14 || id === 28) return 'experience'
  return 'attraction'
}

function todayYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function shiftYmd(ymd: string, deltaDays: number): string {
  if (ymd.length !== 8) return ymd
  const d = new Date(
    Number(ymd.slice(0, 4)),
    Number(ymd.slice(4, 6)) - 1,
    Number(ymd.slice(6, 8)),
  )
  d.setDate(d.getDate() + deltaDays)
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

export function isoToYmd(iso: string): string {
  return iso.replaceAll('-', '')
}
