import axios from 'axios'
import { cachedFetch } from '@/lib/cache'
import { searchPlaces } from '@/api/tour'
import type { Lang } from '@/types/domain'

/**
 * 한국불교문화사업단 공식 포털(templestay.com) 클라이언트.
 *
 * 배경:
 *   templestay.com 은 외부용 OpenAPI 를 제공하지 않는다 (관광공사·카카오와 달리).
 *   사찰 목록은 select#templeId 의 option 들로 prgList.do HTML 페이지에 서버사이드 렌더링되어 있다.
 *   따라서 우리는 vite dev proxy(/api/templestay) 로 HTML 을 받아와 그 부분만 파싱한다.
 *
 * 운영(빌드 후):
 *   브라우저에서 직접 templestay.com 호출 → CORS 차단.
 *   Vercel / Cloud Function 등 동일 경로(/api/templestay/*) 의 서버리스 함수가 필요하다.
 *   배포 시 VITE_TEMPLESTAY_PROXY_BASE 로 다른 베이스를 가리킬 수도 있다.
 */

const PROXY_BASE =
  (import.meta.env.VITE_TEMPLESTAY_PROXY_BASE as string | undefined) || '/api/templestay'

/** 지역 코드 — templestay.com 의 areaCd 값 */
export const TEMPLESTAY_AREA_GYEONGBUK = 'CD00000292'

export interface Temple {
  /** templestay.com 의 고유 templeId (예: 'Bulguksa') */
  id: string
  /** 사찰명 (한글) */
  name: string
  /** 직접 연결되는 사찰 프로그램 페이지 URL */
  reserveUrl: string
  /** 관광공사 사찰 데이터에서 매칭된 대표 이미지 (있을 때만) */
  thumbnail?: string
  /** 매칭된 관광공사 contentId (있으면 우리 상세 페이지로 연결 가능) */
  contentId?: string
}

const client = axios.create({
  timeout: 10_000,
  // 텍스트 HTML 그대로 받기
  responseType: 'text',
  // text/html 응답이라 axios 가 JSON parse 시도 안 하도록
  transformResponse: [(d) => d],
})

/**
 * 지역별 templestay 사찰 목록을 가져온다. 24h 캐시.
 * 옵션으로 lang 을 받으면 사찰명을 관광공사 사찰 데이터와 매칭해 firstimage·contentId 까지 채운다.
 */
export async function fetchTemples(
  areaCd = TEMPLESTAY_AREA_GYEONGBUK,
  lang?: Lang,
): Promise<Temple[]> {
  const cacheKey = `templestay:area:${areaCd}:${lang ?? 'none'}`
  return cachedFetch(cacheKey, async () => {
    try {
      const url = `${PROXY_BASE}/fe/MI000000000000000062/templestay/prgList.do?pageIndex=1&areaCd=${areaCd}&areaSelect=${areaCd}`
      const { data } = await client.get<string>(url)
      const parsed = parseTempleOptions(data)
      if (parsed.length === 0) throw new Error('empty option list')
      const base = parsed.map((p) => ({
        ...p,
        reserveUrl: buildReserveUrl(p.id, areaCd),
      }))
      if (!lang) return base
      // lang 가 주어졌을 때만 관광공사 사찰 데이터로 이미지 보강 (각 사찰명 키워드 검색).
      return enrichWithTourImages(base, lang)
    } catch (err) {
      if (import.meta.env.DEV) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(
          `[templestay] failed to fetch temple list: ${msg}. ` +
            '운영에서는 /api/templestay 경로의 서버리스 프록시가 필요합니다.',
        )
      }
      return []
    }
  })
}

async function enrichWithTourImages(temples: Temple[], lang: Lang): Promise<Temple[]> {
  return Promise.all(
    temples.map(async (t) => {
      // "심원사(성주)" → "심원사" 같이 괄호 안 제거 후 키워드 검색
      const cleaned = t.name.replace(/\([^)]*\)/g, '').trim()
      try {
        const res = await searchPlaces({
          keyword: cleaned,
          category: 'temple',
          lang,
          numOfRows: 5,
        })
        // 같은 사찰명 정확 매칭 우선, 그래도 없으면 첫번째 결과 이미지
        const exact = res.items.find((p) => p.name.replace(/\s/g, '') === cleaned.replace(/\s/g, ''))
        const matched = exact ?? res.items[0]
        return {
          ...t,
          thumbnail: matched?.thumbnail,
          contentId: matched?.id,
        }
      } catch {
        return t
      }
    }),
  )
}

/** 사찰명 → templeId 매칭. fetchTemples 가 캐시되어 있어 비동기지만 빠르다. */
export async function findTempleIdByName(
  name: string,
  areaCd = TEMPLESTAY_AREA_GYEONGBUK,
): Promise<string | undefined> {
  const list = await fetchTemples(areaCd)
  const cleaned = normalizeTempleName(name)
  return list.find((t) => normalizeTempleName(t.name) === cleaned)?.id
}

/** templestay.com 사찰 프로그램 페이지 URL */
export function buildReserveUrl(templeId: string, areaCd = TEMPLESTAY_AREA_GYEONGBUK): string {
  const u = new URL(
    'https://www.templestay.com/fe/MI000000000000000062/templestay/prgList.do',
  )
  u.searchParams.set('pageIndex', '1')
  u.searchParams.set('areaCd', areaCd)
  u.searchParams.set('areaSelect', areaCd)
  u.searchParams.set('templeId', templeId)
  return u.toString()
}

/** 지역 페이지 (사찰 미지정) — '모든 경북 사찰' 보기 */
export function buildAreaUrl(areaCd = TEMPLESTAY_AREA_GYEONGBUK): string {
  return buildReserveUrl('', areaCd).replace(/&templeId=$/, '')
}

// ─── helpers ──────────────────────────────────────────────────────────

/**
 * prgList.do HTML 에서 <select id="templeId"> 의 <option value="X">사찰명</option> 추출.
 * "사찰선택" 같은 placeholder option(value="") 은 건너뛴다.
 */
function parseTempleOptions(html: string): { id: string; name: string }[] {
  // select 블록 추출
  const selectMatch = html.match(/<select[^>]*id="templeId"[^>]*>([\s\S]*?)<\/select>/i)
  if (!selectMatch) return []
  const body = selectMatch[1]
  const out: { id: string; name: string }[] = []
  const re = /<option\s+value="([^"]+)"[^>]*>\s*([^<]+?)\s*<\/option>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    const id = m[1].trim()
    const name = m[2].trim()
    if (!id) continue // placeholder
    out.push({ id, name })
  }
  return out
}

/** "심원사(성주)" / "심원사" 같은 이름 변형을 정규화해서 매칭률 높임 */
function normalizeTempleName(s: string): string {
  return s
    .replace(/\([^)]*\)/g, '') // 괄호 안 제거
    .replace(/\s+/g, '') // 공백 제거
    .toLowerCase()
}
