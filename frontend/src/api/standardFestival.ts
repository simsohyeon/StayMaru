import axios from 'axios'
import { cachedFetch } from '@/lib/cache'
import { SIGUNGUS } from '@/constants/sigungu'
import type { Festival, Lang } from '@/types/domain'

/**
 * 전국문화축제표준데이터 (행정안전부 표준데이터셋, 분기 갱신).
 * 공공데이터포털 ID: 15013104.
 * 엔드포인트: https://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api
 *
 * 한국관광공사 TourAPI(searchFestival2) 의 보완용. TourAPI 는 5월 시점에 2026년
 * 행사가 거의 비어있지만 표준데이터는 지자체 직접 입력이라 2026년 데이터가 풍부하다.
 *
 * 키 노출 방지: serviceKey 는 vite dev proxy / 서버리스 프록시에서만 주입 (`FESTIVAL_STD_API_KEY`).
 *
 * 호출 패턴:
 *   - 한 페이지당 numOfRows 상한 1000. 전국 1281건이라 2페이지 필요.
 *   - 분기 갱신이라 IDB 캐시 24h 충분.
 *   - 응답에 areaCode/sigunguCode 가 없으므로 `insttNm` 문자열 매칭으로 경북 추출 + 시군구 추정.
 */

const PROXY_BASE = '/api/festival-std'
const TARGET_AREA = '경상북도'

interface StdRow {
  fstvlNm?: string
  opar?: string
  fstvlStartDate?: string // "2026-10-02"
  fstvlEndDate?: string
  fstvlCo?: string
  mnnstNm?: string
  auspcInsttNm?: string
  suprtInsttNm?: string
  phoneNumber?: string
  homepageUrl?: string
  rdnmadr?: string
  lnmadr?: string
  latitude?: string
  longitude?: string
  referenceDate?: string
  insttCode?: string
  insttNm?: string
}

interface StdResponse {
  response?: {
    header?: { resultCode?: string; resultMsg?: string }
    body?: { items?: StdRow[]; totalCount?: number | string; numOfRows?: number | string; pageNo?: number | string }
  }
}

const client = axios.create({ timeout: 12000, headers: { Accept: 'application/json' } })

async function fetchPage(pageNo: number): Promise<StdRow[]> {
  const { data } = await client.get<StdResponse>(
    `${PROXY_BASE}?type=json&numOfRows=1000&pageNo=${pageNo}`,
  )
  const code = data?.response?.header?.resultCode
  if (code && code !== '00' && code !== '0000') {
    throw new Error(`festival-std resultCode=${code} (${data?.response?.header?.resultMsg ?? 'unknown'})`)
  }
  return data?.response?.body?.items ?? []
}

/**
 * 경북 전체 표준데이터 — 페이지 합산 후 dedup + 캐시.
 * 응답이 분기 단위로만 바뀌므로 24h 캐시로 충분 (cache.ts 기본값).
 *
 * 내부 dedup: 같은 행사가 연도별로 여러 행으로 등록된 경우(예: "영천보현산별빛축제" 2024/2025/2026)
 * 가장 최신 fstvlStartDate 하나만 남긴다. 키: normalizedName + sigungu(insttCode).
 */
export async function fetchStandardFestivalsGB(lang: Lang): Promise<Festival[]> {
  return cachedFetch(
    `festival-std:${lang}:gb`,
    async () => {
      try {
        // 1281건 / 1000건/페이지 = 2회 호출. 두 번째 페이지를 추가 안 잡으면 약 15건 누락.
        const [p1, p2] = await Promise.all([fetchPage(1), fetchPage(2)])
        const all = [...p1, ...p2]
        const gb = all.filter((r) => isGyeongbuk(r))
        const mapped = gb
          .map((r) => mapStdToFestival(r, lang))
          .filter((f): f is Festival => f !== null)
        return dedupByEventSeries(mapped)
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[festival-std] fetch failed', err)
        return []
      }
    },
    undefined,
    (r) => r.length > 0,
  )
}

/**
 * 같은 행사(이름+지역) 의 다년도 row 중 가장 최신 시작일 1건만 유지.
 * 시작일이 같으면 종료일이 더 늦은 것을 유지.
 */
function dedupByEventSeries(items: Festival[]): Festival[] {
  const bestByKey = new Map<string, Festival>()
  for (const f of items) {
    const key = `${normalizeName(f.name)}@${f.sigunguCode ?? 0}`
    const prev = bestByKey.get(key)
    if (!prev) {
      bestByKey.set(key, f)
      continue
    }
    // 더 미래의 시작일이거나, 같은 날이면 더 늦은 종료일을 선호
    const a = `${f.eventStartDate}-${f.eventEndDate}`
    const b = `${prev.eventStartDate}-${prev.eventEndDate}`
    if (a > b) bestByKey.set(key, f)
  }
  return Array.from(bestByKey.values())
}

function isGyeongbuk(r: StdRow): boolean {
  const inst = r.insttNm ?? ''
  const addr = r.rdnmadr ?? r.lnmadr ?? ''
  return inst.includes(TARGET_AREA) || addr.includes(TARGET_AREA)
}

function mapStdToFestival(r: StdRow, lang: Lang): Festival | null {
  const name = r.fstvlNm?.trim()
  if (!name) return null
  const start = r.fstvlStartDate ?? ''
  const end = r.fstvlEndDate ?? start
  const ymdStart = isoToYmd(start)
  const ymdEnd = isoToYmd(end)
  if (!ymdStart) return null

  const lat = Number(r.latitude ?? '') || 0
  const lng = Number(r.longitude ?? '') || 0
  // 결정적 id — 공유 링크/캐시에서 안정적이도록 시작일+이름 해시 사용.
  // contentid 충돌 방지를 위해 std- prefix.
  const id = `std-${ymdStart}-${slugify(name)}`

  return {
    id,
    contentTypeId: 15,
    category: 'festival',
    name,
    address: r.rdnmadr || r.lnmadr || r.opar || '',
    sigunguCode: guessSigunguCode(r),
    position: { lat, lng },
    thumbnail: undefined, // 표준데이터에는 이미지 필드가 없음
    overview: r.fstvlCo || undefined,
    tel: r.phoneNumber || undefined,
    homepage: normalizeHomepage(r.homepageUrl),
    sponsor: combine(r.auspcInsttNm, r.mnnstNm),
    infoCenter: r.phoneNumber || undefined,
    lang,
    eventStartDate: ymdStart,
    eventEndDate: ymdEnd || ymdStart,
  }
}

function isoToYmd(s: string): string {
  // "2026-10-02" → "20261002". 이미 YYYYMMDD 면 그대로.
  if (!s) return ''
  if (/^\d{8}$/.test(s)) return s
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}${m[2]}${m[3]}` : ''
}

function slugify(s: string): string {
  // contentid 자리. 한글 그대로 두고 공백·특수문자만 정리. URL 인코딩은 사용처(공유 링크 등)에서.
  return s.replace(/\s+/g, '').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 40)
}

function normalizeHomepage(raw?: string): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  // "www.example.kr" 또는 "한글도메인.kr" 등은 https 보강
  return `https://${trimmed}`
}

function combine(a?: string, b?: string): string | undefined {
  const out = [a, b].filter((s): s is string => !!s && s.trim().length > 0)
  if (out.length === 0) return undefined
  return Array.from(new Set(out)).join(' / ')
}

/**
 * insttNm("경상북도 안동시") → sigunguCode(11).
 * SIGUNGUS 의 ko 명을 우선 매칭. 못 찾으면 undefined (지도 핀 없이 리스트에만).
 */
function guessSigunguCode(r: StdRow): number | undefined {
  const inst = r.insttNm ?? ''
  // "경상북도 안동시" 에서 시군구 추출
  const m = inst.match(/경상북도\s+(\S+)/)
  const key = (m?.[1] ?? '').trim()
  if (!key) return undefined
  // 정확 일치 → 부분 일치 순으로
  const exact = SIGUNGUS.find((s) => s.ko === key)
  if (exact) return exact.code
  const partial = SIGUNGUS.find((s) => key.includes(s.ko) || s.ko.includes(key))
  return partial?.code
}

/**
 * 머지 — TourAPI 결과를 우선하고, 표준데이터 중 같은 행사로 추정되는 항목은 제외.
 * dedup 키: 이름 정규화 + 시작 연월(YYYYMM). 표준데이터의 "2026 안동국제탈춤페스티벌" 과
 * TourAPI 의 "안동국제탈춤페스티벌" 을 같은 행사로 묶기 위해 숫자/제N회 prefix 를 제거한다.
 */
export function mergeFestivals(primary: Festival[], extra: Festival[]): Festival[] {
  const keyOf = (f: Festival) =>
    `${normalizeName(f.name)}::${f.eventStartDate.slice(0, 6)}`
  const seen = new Set(primary.map(keyOf))
  const dedup = extra.filter((f) => !seen.has(keyOf(f)))
  return [...primary, ...dedup]
}

export function normalizeName(name: string): string {
  return name
    .replace(/^\d{4}\s*/g, '') // "2026 안동..." → "안동..."
    .replace(/^제\s*\d+\s*회\s*/g, '') // "제7회 의성..." → "의성..."
    .replace(/\s+/g, '')
    .toLowerCase()
}

/** 매칭 호출용 — "2026 안동국제탈춤페스티벌" → "안동국제탈춤페스티벌". 공백은 살린다. */
export function stripYearPrefix(name: string): string {
  return name
    .replace(/^\d{4}\s*/g, '')
    .replace(/^제\s*\d+\s*회\s*/g, '')
    .trim()
}
