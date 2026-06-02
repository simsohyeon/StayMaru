import axios from 'axios'
import { cachedFetch } from '@/lib/cache'
import type { Lang } from '@/types/domain'

/**
 * 한국관광공사 빅데이터 OpenAPI 클라이언트.
 *
 *  ① 관광지 연관 추천 (TarRlteService1) — "이 곳을 찾은 여행자가 함께 본 관광지"
 *     · keywordBasedList1 : 관광지명(키워드) 기반 연관 추천 — PlaceDetail 에서 사용
 *     · areaBasedList1    : 지역(법정동) 기반 연관 추천 — 경북 인사이트에서 사용
 *  ② 한국관광 데이터랩 (DataLabService) — 시군구 방문자 통계
 *     · locgoRegnVisitrDDList : 기초지자체 일자별 방문자수
 *
 * 두 서비스 모두 공공데이터포털에서 **별도 활용신청(무료 승인)** 이 필요하다.
 * 활용신청 전에는 게이트웨이가 평문 "Unexpected errors" / "Forbidden" 을 반환하므로
 * 이를 `not-subscribed` 상태로 분류해 UI 가 활용신청 안내를 노출한다 (가짜 데이터 미사용).
 *
 * 보안·프록시는 기존 TourAPI 와 동일 — /api/tour/<service>/<op> 로 호출하면
 * vite dev proxy / Vercel edge function 이 serviceKey 를 주입한다 (B551011 하위 전 서비스 공용).
 */

const PROXY_BASE = (import.meta.env.VITE_TOUR_PROXY_BASE as string | undefined) || '/api/tour'

const client = axios.create({ timeout: 9000, headers: { Accept: 'application/json' } })

/** 빅데이터 호출 결과 상태 — UI 가 빈/미구독/에러를 구분해 안내하도록. */
export type BigDataStatus = 'ok' | 'empty' | 'not-subscribed' | 'error'

export interface BigDataResult<T> {
  items: T[]
  status: BigDataStatus
  /** 실제 데이터가 존재한 기준 연월(YYYYMM) — UI 출처 표기용. */
  baseYm?: string
}

/** 경상북도 법정동 시도 코드 (TarRlte/DataLab areaCd). */
export const GB_LDONG_AREA_CD = '47'

/**
 * TourAPI sigunguCode(1~23) → 법정동 시군구 코드(5자리) 매핑.
 * 빅데이터 서비스는 관광정보 서비스의 areaCode2(1,2,3…) 가 아니라 행정표준 법정동 코드를 쓴다.
 * 포항시는 남구(47111)·북구(47113)로 분리되어 있어 두 코드를 합산한다.
 */
export const SIGUNGU_LDONG: Record<number, string[]> = {
  1: ['47290'], // 경산시
  2: ['47130'], // 경주시
  3: ['47830'], // 고령군
  4: ['47190'], // 구미시
  6: ['47150'], // 김천시
  7: ['47280'], // 문경시
  8: ['47920'], // 봉화군
  9: ['47250'], // 상주시
  10: ['47840'], // 성주군
  11: ['47170'], // 안동시
  12: ['47770'], // 영덕군
  13: ['47760'], // 영양군
  14: ['47210'], // 영주시
  15: ['47230'], // 영천시
  16: ['47900'], // 예천군
  17: ['47940'], // 울릉군
  18: ['47930'], // 울진군
  19: ['47730'], // 의성군
  20: ['47820'], // 청도군
  21: ['47750'], // 청송군
  22: ['47850'], // 칠곡군
  23: ['47111', '47113'], // 포항시 남구·북구
}

// ─── 응답 파싱 공통 ──────────────────────────────────────────────────────────

interface RawResponse {
  response?: {
    header?: { resultCode?: string; resultMsg?: string }
    body?: {
      items?: { item?: Record<string, string>[] | Record<string, string> } | string
      totalCount?: number
    }
  }
}

function pickItems(res: RawResponse): Record<string, string>[] {
  const items = res?.response?.body?.items
  if (!items || typeof items === 'string') return []
  const v = items.item
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

/**
 * 한 번의 빅데이터 호출. 평문 응답("Unexpected errors"/"Forbidden")과 resultCode 에러를 분류한다.
 * @returns items 와 status. status !== 'ok' 이면 items 는 빈 배열.
 */
async function callBigData(
  service: string,
  op: string,
  params: Record<string, string | number | undefined>,
): Promise<{ items: Record<string, string>[]; status: BigDataStatus }> {
  const url = `${PROXY_BASE}/${service}/${op}`
  const search = new URLSearchParams({ MobileOS: 'ETC', MobileApp: 'Shimmaru', _type: 'json' })
  if (!('numOfRows' in params)) search.set('numOfRows', '25')
  if (!('pageNo' in params)) search.set('pageNo', '1')
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v))
  }
  try {
    // ⚠️ validateStatus: () => true — 미구독 서비스는 게이트웨이가 4xx/5xx(평문 본문)로 응답한다.
    // axios 기본값(2xx만 통과)이면 곧장 throw 되어 아래 평문 분류가 죽은 코드가 된다.
    const { data, status: httpStatus } = await client.get<RawResponse | string>(
      `${url}?${search.toString()}`,
      { validateStatus: () => true },
    )
    // 평문 응답 = 게이트웨이 거부. 활용신청 누락이 대부분.
    if (typeof data === 'string') {
      const s = data.toLowerCase()
      if (
        s.includes('forbidden') ||
        s.includes('unexpected') ||
        s.includes('service key') ||
        s.includes('not registered') ||
        httpStatus === 401 ||
        httpStatus === 403 ||
        httpStatus === 500
      ) {
        return { items: [], status: 'not-subscribed' }
      }
      return { items: [], status: 'error' }
    }
    // JSON 본문인데 4xx/5xx — 라우팅/게이트웨이 오류. 401/403 은 미신청으로 분류.
    if (httpStatus >= 400) {
      return { items: [], status: httpStatus === 401 || httpStatus === 403 ? 'not-subscribed' : 'error' }
    }
    const code = data?.response?.header?.resultCode
    if (code && code !== '0000') {
      // 30/20/10 = 키 미등록·미신청 계열
      if (['30', '20', '10'].includes(code)) return { items: [], status: 'not-subscribed' }
      return { items: [], status: 'error' }
    }
    return { items: pickItems(data), status: 'ok' }
  } catch {
    return { items: [], status: 'error' }
  }
}

/**
 * 빅데이터 통계는 3~4개월 지연 공개된다. 최신 가용 baseYm 을 모르므로
 * (오늘 - lagMonths) 부터 과거로 한 달씩 내려가며 데이터가 잡히는 첫 달을 사용한다.
 */
function recentBaseYms(count = 6, lagMonths = 3): string[] {
  const out: string[] = []
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - lagMonths)
  for (let i = 0; i < count; i++) {
    out.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`)
    d.setMonth(d.getMonth() - 1)
  }
  return out
}

// ─── ① 관광지 연관 추천 (TarRlteService1) ───────────────────────────────────

export interface RelatedSpot {
  /** 연관 관광지명 */
  name: string
  /** 연관 순위 (1 = 가장 함께 많이 찾음) */
  rank: number
  /** 대분류 카테고리명 (예: 자연, 역사관광, 음식 등) */
  categoryName?: string
  /** 중분류 */
  subCategoryName?: string
  /** 시군구명 */
  signguName?: string
  /** 시도명 */
  regionName?: string
}

function mapRelated(it: Record<string, string>): RelatedSpot {
  return {
    name: it.rlteTatsNm ?? '',
    rank: Number(it.rlteRank ?? it.rank ?? 0),
    categoryName: it.rlteCtgryLclsNm || undefined,
    subCategoryName: it.rlteCtgryMclsNm || undefined,
    signguName: it.rlteSignguNm || undefined,
    regionName: it.rlteRegnNm || undefined,
  }
}

function dedupeRanked(spots: RelatedSpot[], excludeName?: string): RelatedSpot[] {
  const seen = new Set<string>()
  const out: RelatedSpot[] = []
  const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()
  const exclude = excludeName ? norm(excludeName) : undefined
  for (const s of spots.sort((a, b) => a.rank - b.rank)) {
    if (!s.name) continue
    const k = norm(s.name)
    if (k === exclude || seen.has(k)) continue
    seen.add(k)
    out.push(s)
  }
  return out
}

/**
 * 관광지명(키워드) 기반 연관 추천 — "이 곳을 찾은 여행자가 함께 본 관광지".
 * baseYm 을 최근부터 내려가며 데이터가 잡히는 첫 달을 사용한다.
 */
export async function fetchRelatedByKeyword(
  keyword: string,
  lang: Lang,
  limit = 8,
): Promise<BigDataResult<RelatedSpot>> {
  const kw = keyword.trim()
  if (!kw) return { items: [], status: 'empty' }
  const cacheKey = `bigdata:rlte:kw:${lang}:${kw}:n${limit}`
  return cachedFetch(
    cacheKey,
    async () => {
      let lastStatus: BigDataStatus = 'empty'
      for (const baseYm of recentBaseYms()) {
        const { items, status } = await callBigData('TarRlteService1', 'keywordBasedList1', {
          baseYm,
          keyword: kw,
          areaCd: GB_LDONG_AREA_CD,
          numOfRows: 50,
        })
        lastStatus = status
        if (status === 'not-subscribed') return { items: [], status }
        if (status === 'ok' && items.length > 0) {
          const spots = dedupeRanked(items.map(mapRelated), kw).slice(0, limit)
          return { items: spots, status: spots.length ? 'ok' : 'empty', baseYm }
        }
      }
      return { items: [], status: lastStatus }
    },
    undefined,
    (r) => r.status === 'ok',
  )
}

/**
 * 지역(법정동 시군구) 기반 연관 추천 — 해당 시군에서 빅데이터가 주목한 관광지.
 */
export async function fetchRelatedByArea(
  sigunguCode: number,
  lang: Lang,
  limit = 10,
): Promise<BigDataResult<RelatedSpot>> {
  const ldongs = SIGUNGU_LDONG[sigunguCode]
  if (!ldongs || ldongs.length === 0) return { items: [], status: 'empty' }
  const cacheKey = `bigdata:rlte:area:${lang}:${sigunguCode}:n${limit}`
  return cachedFetch(
    cacheKey,
    async () => {
      let lastStatus: BigDataStatus = 'empty'
      for (const baseYm of recentBaseYms()) {
        const perCode = await Promise.all(
          ldongs.map((signguCd) =>
            callBigData('TarRlteService1', 'areaBasedList1', {
              baseYm,
              areaCd: GB_LDONG_AREA_CD,
              signguCd,
              numOfRows: 50,
            }),
          ),
        )
        if (perCode.some((r) => r.status === 'not-subscribed')) {
          return { items: [], status: 'not-subscribed' as BigDataStatus }
        }
        const merged = perCode.flatMap((r) => r.items)
        lastStatus = perCode[0]?.status ?? 'empty'
        if (merged.length > 0) {
          const spots = dedupeRanked(merged.map(mapRelated)).slice(0, limit)
          return { items: spots, status: spots.length ? 'ok' : 'empty', baseYm }
        }
      }
      return { items: [], status: lastStatus }
    },
    undefined,
    (r) => r.status === 'ok',
  )
}

// ─── ② 한국관광 데이터랩 — 시군구 방문자 통계 (DataLabService) ────────────────

export interface RegionVisit {
  sigunguCode: number
  /** 합산 방문자수 (기간 누계) */
  visitors: number
}

/** YYYYMM → 해당 월 1일/말일 YYYYMMDD 범위. */
function monthRange(baseYm: string): { startYmd: string; endYmd: string } {
  const y = Number(baseYm.slice(0, 4))
  const m = Number(baseYm.slice(4, 6))
  return {
    startYmd: `${baseYm}01`,
    endYmd: `${baseYm}${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`,
  }
}

function sumVisitors(items: Record<string, string>[]): number {
  let sum = 0
  for (const it of items) {
    const n = Number(it.touNum ?? it.cnt ?? 0)
    if (!Number.isNaN(n) && n > 0) sum += n
  }
  return sum
}

/**
 * 경북 전체 시군구의 최근 한 달 방문자수를 합산해 랭킹용으로 반환한다.
 * locgoRegnVisitrDDList: 일자별 응답을 시군구별로 누계.
 *
 * 효율을 위해 ① 대표 시군(경주)으로 가용 baseYm 을 먼저 탐색하고,
 * ② 미구독이면 즉시 종료, ③ 확정된 baseYm 으로만 전 시군 fan-out 한다.
 */
export async function fetchGyeongbukVisitors(): Promise<BigDataResult<RegionVisit>> {
  const cacheKey = `bigdata:datalab:gb-visitors`
  return cachedFetch(
    cacheKey,
    async () => {
      // ① 대표 시군(경주 47130)으로 데이터가 잡히는 baseYm 탐색.
      let resolvedYm: string | undefined
      let lastStatus: BigDataStatus = 'empty'
      for (const baseYm of recentBaseYms(6, 3)) {
        const { startYmd, endYmd } = monthRange(baseYm)
        const { items, status } = await callBigData('DataLabService', 'locgoRegnVisitrDDList', {
          startYmd,
          endYmd,
          signguCd: '47130',
          numOfRows: 1000,
        })
        lastStatus = status
        if (status === 'not-subscribed') return { items: [], status }
        if (status === 'ok' && sumVisitors(items) > 0) {
          resolvedYm = baseYm
          break
        }
      }
      if (!resolvedYm) return { items: [], status: lastStatus }

      // ② 확정된 baseYm 으로 전 시군 fan-out.
      const { startYmd, endYmd } = monthRange(resolvedYm)
      const perSigungu = await Promise.all(
        Object.entries(SIGUNGU_LDONG).map(async ([code, ldongs]) => {
          let sum = 0
          for (const signguCd of ldongs) {
            const { items, status } = await callBigData('DataLabService', 'locgoRegnVisitrDDList', {
              startYmd,
              endYmd,
              signguCd,
              numOfRows: 1000,
            })
            if (status === 'ok') sum += sumVisitors(items)
          }
          return { sigunguCode: Number(code), visitors: sum }
        }),
      )
      const items = perSigungu.filter((r) => r.visitors > 0).sort((a, b) => b.visitors - a.visitors)
      return items.length > 0
        ? { items, status: 'ok' as BigDataStatus, baseYm: resolvedYm }
        : { items: [], status: 'empty' as BigDataStatus }
    },
    undefined,
    (r) => r.status === 'ok',
  )
}
