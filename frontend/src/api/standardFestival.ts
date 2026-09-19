import axios from 'axios'
import { cachedFetch } from '@/lib/cache'
import { SIGUNGUS } from '@/constants/sigungu'
import type { Festival, Lang } from '@/types/domain'

/**
 * 전국문화축제표준데이터 (행정안전부 표준데이터셋, 공공데이터포털 15013104, 분기 갱신).
 * 지자체가 직접 입력해 TourAPI 보다 당해연도 행사가 풍부하다.
 *
 * serviceKey(`FESTIVAL_STD_API_KEY`)는 프록시에서만 주입한다.
 * 응답에 areaCode/sigunguCode 가 없어 `insttNm` 문자열 매칭으로 경북 추출 + 시군구를 추정한다.
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

interface StdBody {
  /** 구 포맷은 배열, 2026-09 현재 포맷은 `{ item: [...] }` 래핑 — 둘 다 받는다. */
  items?: StdRow[] | { item?: StdRow[] | StdRow }
  totalCount?: number | string
  numOfRows?: number | string
  pageNo?: number | string
}
interface StdEnvelope {
  header?: { resultCode?: string; resultMsg?: string }
  body?: StdBody
}
/** 응답 최상위가 `response` 로 감싸인 형태와 감싸이지 않은 형태가 모두 관측된다. */
type StdResponse = StdEnvelope & { response?: StdEnvelope }

function pickStdRows(data: StdResponse): StdRow[] {
  const items = (data.response ?? data).body?.items
  if (!items) return []
  if (Array.isArray(items)) return items
  const v = items.item
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

// 전국 1000행/페이지 응답이라 평소 5~10초 — 12초는 빠듯해 네트워크가 느리면 빈 화면이 된다.
const client = axios.create({ timeout: 25000, headers: { Accept: 'application/json' } })

async function fetchPage(pageNo: number): Promise<StdRow[]> {
  const { data } = await client.get<StdResponse>(
    `${PROXY_BASE}?type=json&numOfRows=1000&pageNo=${pageNo}`,
  )
  const header = (data?.response ?? data)?.header
  const code = header?.resultCode
  if (code && code !== '00' && code !== '0000') {
    throw new Error(`festival-std resultCode=${code} (${header?.resultMsg ?? 'unknown'})`)
  }
  return pickStdRows(data ?? {})
}

/**
 * 업스트림(data.go.kr 표준데이터)이 동일 요청에도 간헐적으로 HTTP 500 을 반환한다.
 * 한 번 실패해도 곧바로 재시도하면 대개 성공하므로 지수 백오프로 2회까지 재시도한다.
 */
async function fetchPageWithRetry(pageNo: number, retries = 2): Promise<StdRow[]> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchPage(pageNo)
    } catch (err) {
      lastErr = err
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)))
      }
    }
  }
  throw lastErr
}

/**
 * 경북 전체 표준데이터 — 페이지 합산 후 dedup + 캐시.
 *
 * 같은 행사가 연도별로 여러 행이면 최신 fstvlStartDate 하나만 남긴다(키: 정규화명 + insttCode).
 */
export async function fetchStandardFestivalsGB(lang: Lang): Promise<Festival[]> {
  return cachedFetch(
    `festival-std:${lang}:gb`,
    async () => {
      // 1000행/페이지라 2회 호출 필요. 한 페이지가 실패해도 성공분은 살린다(부분 성공 허용) —
      // 둘 다 실패해야 빈 배열이고, 그때는 shouldCache 가 막아 다음 진입에서 재시도된다.
      const [r1, r2] = await Promise.allSettled([
        fetchPageWithRetry(1),
        fetchPageWithRetry(2),
      ])
      const all = [
        ...(r1.status === 'fulfilled' ? r1.value : []),
        ...(r2.status === 'fulfilled' ? r2.value : []),
      ]
      if (import.meta.env.DEV && (r1.status === 'rejected' || r2.status === 'rejected')) {
        console.warn('[festival-std] partial fetch', { p1: r1.status, p2: r2.status })
      }
      if (all.length === 0) return []
      const gb = all.filter((r) => isGyeongbuk(r))
      const mapped = gb
        .map((r) => mapStdToFestival(r, lang))
        .filter((f): f is Festival => f !== null)
      return dedupByEventSeries(mapped)
    },
    undefined,
    (r) => r.length > 0,
  )
}

/**
 * 같은 행사를 1건으로 병합한다. 표준데이터는 같은 축제가 연도별·출처별로 여러 행으로 들어온다.
 * 이름이 같으면 같은 행사로 보되, 둘 다 시군구코드가 있고 서로 다를 때만 분리한다 —
 * 시군구코드가 없는 행은 동기화 출처라 같은 이름의 지자체 행과 합친다.
 * 병합 시 더 미래 일정을 유지해야 한쪽이 2025, 다른 쪽이 2026 일 때 종료된 쪽이 살아남지 않는다.
 */
function dedupByEventSeries(items: Festival[]): Festival[] {
  const result: Festival[] = []
  for (const f of items) {
    const fName = normalizeName(f.name)
    const idx = result.findIndex(
      (g) =>
        normalizeName(g.name) === fName &&
        (g.sigunguCode === f.sigunguCode || g.sigunguCode == null || f.sigunguCode == null),
    )
    if (idx < 0) {
      result.push(f)
      continue
    }
    result[idx] = mergeSeries(result[idx], f)
  }
  return result
}

/** 같은 행사의 두 행을 병합 — 최신 일정 유지 + 누락 필드 형제에서 보강. */
function mergeSeries(a: Festival, b: Festival): Festival {
  const latest = `${b.eventStartDate}-${b.eventEndDate}` > `${a.eventStartDate}-${a.eventEndDate}` ? b : a
  const other = latest === b ? a : b
  const hasCoord = (f: Festival) => !!(f.position.lat && f.position.lng)
  return {
    ...latest,
    sigunguCode: latest.sigunguCode ?? other.sigunguCode,
    position: hasCoord(latest) ? latest.position : other.position,
    thumbnail: latest.thumbnail ?? other.thumbnail,
    homepage: latest.homepage ?? other.homepage,
    tel: latest.tel ?? other.tel,
  }
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
  // 결정적 id — 공유 링크/캐시 안정성을 위해 시작일+이름 해시, std- prefix 로 contentid 충돌 회피.
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
