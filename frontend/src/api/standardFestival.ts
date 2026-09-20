import axios from 'axios'
import { cachedFetch } from '@/lib/cache'
import { normalizeStdFestivals, pickStdRows, type StdResponse, type StdRow } from '@/lib/festivalStd'
import type { Festival, Lang } from '@/types/domain'

// 정규화 규칙은 lib/festivalStd.ts (서버 코스 엔진과 공유). 기존 import 경로 호환용 re-export.
export { mergeFestivals, normalizeName, stripYearPrefix } from '@/lib/festivalStd'

/**
 * 전국문화축제표준데이터 (행정안전부 표준데이터셋, 공공데이터포털 15013104, 분기 갱신).
 * 지자체가 직접 입력해 TourAPI 보다 당해연도 행사가 풍부하다.
 *
 * serviceKey(`FESTIVAL_STD_API_KEY`)는 프록시에서만 주입한다.
 * 응답에 areaCode/sigunguCode 가 없어 `insttNm` 문자열 매칭으로 경북 추출 + 시군구를 추정한다.
 */

const PROXY_BASE = '/api/festival-std'

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
      // 두 페이지 모두 실패 = API 장애. 빈 배열로 삼키면 UI 가 "결과 없음"으로 오인하므로 throw.
      if (r1.status === 'rejected' && r2.status === 'rejected') throw r1.reason
      if (all.length === 0) return []
      return normalizeStdFestivals(all, lang)
    },
    undefined,
    (r) => r.length > 0,
  )
}
