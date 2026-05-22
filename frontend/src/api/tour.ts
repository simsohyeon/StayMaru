import axios from 'axios'
import { cachedFetch } from '@/lib/cache'
import { CATEGORY_MAP } from '@/constants/categories'
import { GB_AREA_CODE } from '@/constants/sigungu'
import { fetchStandardFestivalsGB, normalizeName } from './standardFestival'
import { fetchOgImage } from '@/lib/ogImage'
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
    thumbnail: forceHttps(item.firstimage || item.firstimage2 || undefined),
    overview: item.overview,
    tel: item.tel,
    homepage: extractHomepage(item.homepage),
    openHours: item.usetime,
    lang,
  }
}

/**
 * TourAPI 이미지 CDN(`tong.visitkorea.or.kr`)은 https 를 지원하지만 API 응답은
 * 일관되게 `http://` 로 반환된다. 운영(https) 페이지에서 mixed content 로 차단되므로 강제 변환.
 */
function forceHttps(url?: string): string | undefined {
  if (!url) return undefined
  return url.replace(/^http:\/\//i, 'https://')
}

function extractHomepage(raw?: string): string | undefined {
  if (!raw) return undefined
  const m = raw.match(/href="([^"]+)"/i)
  return m?.[1] ?? raw
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
  /** API 호출이 실패해 빈 결과가 반환된 경우의 원인 코드 (성공 시 undefined). */
  error?: TourErrorKind
}

export type TourErrorKind = 'network' | 'forbidden' | 'noKey' | 'unknown'

function classifyError(err: unknown): TourErrorKind {
  if (err instanceof TourApiError) {
    if (err.code === 'FORBIDDEN') return 'forbidden'
    if (['10', '20', '30'].includes(err.code)) return 'noKey'
  }
  // axios network/timeout
  const code = (err as { code?: string; message?: string } | null)?.code
  const msg = (err as { message?: string } | null)?.message ?? ''
  if (code === 'ECONNABORTED' || /network|timeout/i.test(msg)) return 'network'
  return 'unknown'
}

/** FR-13, FR-14, FR-22 — 지역/카테고리/키워드 통합 탐색 (페이징 포함). */
export async function searchPlaces(p: SearchParams): Promise<SearchResult> {
  const pageNo = p.pageNo ?? 1
  const numOfRows = p.numOfRows ?? 30
  const cacheKey = `places:${p.lang}:${p.category ?? '*'}:${p.sigunguCode ?? '*'}:${p.keyword ?? ''}:p${pageNo}:n${numOfRows}`
  return cachedFetch(
    cacheKey,
    async () => {
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
    (r) => r.items.length > 0 && !r.error, // 빈 결과/에러는 캐시하지 않음
  )
}

/** FR-22 — 반경 기반 주변 탐색 */
export async function searchAround(center: LatLng, radiusM: number, lang: Lang): Promise<Place[]> {
  const cacheKey = `around:${lang}:${center.lat.toFixed(3)}:${center.lng.toFixed(3)}:${radiusM}`
  return cachedFetch(
    cacheKey,
    async () => {
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
    },
    undefined,
    (r) => r.length > 0,
  )
}

/**
 * FR-15, FR-16 — 축제 검색.
 *
 * VisitKorea(국문/영문/일문/중문 관광정보 V2) 의 searchFestival2 호출.
 * arrange='C' (등록일순 + 이미지 있음만) — 진행/예정 축제가 시작 부분에 모이도록.
 * eventStartDate 는 "행사 시작일 >=" 필터이므로:
 *   - 진행 중인 축제(이미 시작했지만 끝나지 않은) 까지 잡으려면 과거 일자를 줘야 함
 *   - 너무 과거로 가면 종료된 행사가 다수 섞임
 *   - 6개월 lookback 이 균형점 (대부분 축제 기간은 1~2주이지만 일부 시리즈는 2~3개월)
 *
 * dateRange 가 주어진 경우(여행 기간 매칭): range.startYmd ± 7일 으로 더 좁힌다.
 */
/**
 * 행사 표시 소스 = 행정안전부 표준데이터(FESTIVAL_STD_API_KEY) **단일**.
 * TourAPI(searchFestival2)는 더 이상 표시 소스로 쓰지 않는다 — 두 소스 머지 시
 * 발생하던 중복(같은 행사가 다른 표기로 두 카드) 완전 제거.
 *
 * TourAPI 의 areaBasedList2 응답은 enrichMissingImages 안에서 **이미지 매칭 풀**로만
 * 활용된다 — 행사 카드 자체가 추가되지 않으므로 중복 없음.
 *
 * 사진 우선순위:
 *   ① TourAPI image pool (areaBasedList2 contentType=15) — 약 30건의 firstimage 매칭
 *   ② homepage og:image (api/og-image 서버리스 함수, 7일 캐시)
 *   ③ 폴백 — 카테고리 그라데이션 + 행사명 첫 글자 디자인 카드
 */
export async function searchFestivals(
  lang: Lang,
  range?: { startYmd: string; endYmd: string },
): Promise<Festival[]> {
  const cacheKey = `festivals-std-only:${lang}:${range?.startYmd ?? ''}:${range?.endYmd ?? ''}`
  return cachedFetch(
    cacheKey,
    async () => {
      const items = await fetchStandardFestivalsGB(lang).catch(() => [] as Festival[])
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
 * 표준데이터 출처 행사(thumbnail 미존재)에 대해 사진을 보강한다.
 *
 * 매칭 풀 = TourAPI 경북 행사 전체 (areaBasedList2 contentType=15).
 * 한 번 호출로 약 30건의 firstimage 매칭 풀을 확보 (24h 캐시) → 정확/부분 매칭.
 * 매칭 실패 시 행사 homepage 의 og:image 를 서버리스 함수로 추출 (7일 캐시).
 */
async function enrichMissingImages(
  merged: Festival[],
  lang: Lang,
): Promise<Festival[]> {
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
    // 2) 부분 매칭 — 표준명이 더 길고 풀명이 그 안에 포함되거나 (예: "차전장군노국공주축제" ⊃ "노국공주축제")
    //    반대로 풀명이 더 길어 표준명 부분을 포함하는 경우
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

  // 3) og:image — stage 1/2 에서 못 잡은 표준데이터 행사 중 homepage 가 있으면
  //    서버리스 함수로 og:image 추출 시도. 동시 8건, 결과는 IDB 7일 캐시.
  const stillMissing = stage12
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => !f.thumbnail && f.homepage)

  if (stillMissing.length === 0) return stage12

  const ogResults = new Map<number, string>()
  const concurrency = 8
  for (let start = 0; start < stillMissing.length; start += concurrency) {
    const batch = stillMissing.slice(start, start + concurrency)
    await Promise.all(
      batch.map(async ({ f, i }) => {
        const url = await fetchOgImage(f.homepage!)
        if (url) ogResults.set(i, url)
      }),
    )
  }

  if (ogResults.size === 0) return stage12
  return stage12.map((f, i) => {
    const og = ogResults.get(i)
    return og ? { ...f, thumbnail: og } : f
  })
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

/** Festival 용 — loadPlaceById 와 동일하지만 eventStart/End 는 detailInfo2 에서 보강 시도. */
export async function loadFestivalById(id: string, lang: Lang): Promise<Festival | null> {
  const base = await loadPlaceById(id, lang)
  if (!base) return null
  // detailInfo2 로 행사 기간을 시도 — 실패해도 base 정보만으로 화면 렌더 가능하게.
  try {
    const res = await callTour(
      'detailInfo2',
      { contentId: id, contentTypeId: base.contentTypeId || 15 },
      lang,
    )
    const items = pickItems(res) as Array<{ infoname?: string; infotext?: string }>
    // detailInfo2 의 일부 행사는 별도 필드 미제공 — 빈 문자열 폴백
    void items
  } catch {
    /* ignore */
  }
  return {
    ...base,
    category: 'festival',
    eventStartDate: '',
    eventEndDate: '',
  }
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
// API 호출 실패 시 더 이상 mock 데이터로 폴백하지 않는다 — 빈 결과 + 콘솔 경고.
// (이전 버전에는 안동 하회마을 등 mock 장소가 있었지만 사용자 요청으로 제거됨)

function fallbackPlaces(_p: SearchParams): Place[] {
  return []
}

function fallbackAround(_center: LatLng, _radiusM: number): Place[] {
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
