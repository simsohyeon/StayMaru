import { SIGUNGUS } from '../constants/sigungu.ts'
import type { Festival, Lang } from '../types/domain'

/**
 * 전국문화축제표준데이터 → Festival 정규화 — 순수 함수만.
 *
 * api/standardFestival.ts 에서 분리한 이유: 서버(api/course.ts)가 같은 규칙으로 축제를 정규화해 코스 엔진에
 * 넣어야 한다. api/standardFestival.ts 는 axios·IndexedDB 캐시를 쓰는 브라우저 전용 모듈이라 서버 번들에
 * 실을 수 없다. (상대 경로 import 도 같은 이유 — 서버 번들러는 `@/` 를 모른다.)
 */

const TARGET_AREA = '경상북도'

export interface StdRow {
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

export interface StdBody {
  /** 구 포맷은 배열, 2026-09 현재 포맷은 `{ item: [...] }` 래핑 — 둘 다 받는다. */
  items?: StdRow[] | { item?: StdRow[] | StdRow }
  totalCount?: number | string
  numOfRows?: number | string
  pageNo?: number | string
}
export interface StdEnvelope {
  header?: { resultCode?: string; resultMsg?: string }
  body?: StdBody
}
/** 응답 최상위가 `response` 로 감싸인 형태와 감싸이지 않은 형태가 모두 관측된다. */
export type StdResponse = StdEnvelope & { response?: StdEnvelope }

export function pickStdRows(data: StdResponse): StdRow[] {
  const items = (data.response ?? data).body?.items
  if (!items) return []
  if (Array.isArray(items)) return items
  const v = items.item
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

/** 표준데이터 전국 행 → 경북만 골라 Festival 로 정규화 + 같은 행사 병합 */
export function normalizeStdFestivals(rows: StdRow[], lang: Lang): Festival[] {
  const mapped = rows
    .filter((r) => isGyeongbuk(r))
    .map((r) => mapStdToFestival(r, lang))
    .filter((f): f is Festival => f !== null)
  return dedupByEventSeries(mapped)
}

/**
 * 같은 행사를 1건으로 병합한다. 표준데이터는 같은 축제가 연도별·출처별로 여러 행으로 들어온다.
 * 이름이 같으면 같은 행사로 보되, 둘 다 시군구코드가 있고 서로 다를 때만 분리한다 —
 * 시군구코드가 없는 행은 동기화 출처라 같은 이름의 지자체 행과 합친다.
 * 병합 시 더 미래 일정을 유지해야 한쪽이 2025, 다른 쪽이 2026 일 때 종료된 쪽이 살아남지 않는다.
 */
export function dedupByEventSeries(items: Festival[]): Festival[] {
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

export function isGyeongbuk(r: StdRow): boolean {
  const inst = r.insttNm ?? ''
  const addr = r.rdnmadr ?? r.lnmadr ?? ''
  return inst.includes(TARGET_AREA) || addr.includes(TARGET_AREA)
}

export function mapStdToFestival(r: StdRow, lang: Lang): Festival | null {
  const name = r.fstvlNm?.trim()
  if (!name) return null
  const start = r.fstvlStartDate ?? ''
  const end = r.fstvlEndDate ?? start
  const ymdStart = stdDateToYmd(start)
  const ymdEnd = stdDateToYmd(end)
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

/** "2026-10-02" → "20261002". 이미 YYYYMMDD 면 그대로. */
function stdDateToYmd(s: string): string {
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
