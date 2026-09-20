import { findSigungu } from '@/constants/sigungu'
import { cachedFetch } from '@/lib/cache'
import {
  climatologyHint,
  latestBaseDateTime,
  rainHintFromForecast,
  ymd,
  type VilageResponse,
  type WeatherHint,
} from '@/lib/rainHint'

/**
 * 기상청 단기예보 강수확률(POP) — 코스 가중치 조정에 사용.
 * 'rain-likely' 면 코스 엔진이 실내 카테고리 가중치를 올리고 trail 을 낮춘다.
 * 예보를 못 받으면 30년 평년값 기반 월별 강수일수 비율로 폴백한다.
 *
 * 계산 규칙(발표시각·POP 집계·평년값)은 lib/rainHint.ts 에 있고 서버(api/course.ts)와 공유한다.
 * 이 파일은 브라우저 전용 — /api/weather 호출과 IndexedDB 캐시만 담당한다.
 */

export { climatologyRainChance, toRainHint, type RainHint, type WeatherHint } from '@/lib/rainHint'

/**
 * 거점 시군구의 강수확률 — 대상 날짜의 시간대별 POP 중 최댓값을 쓴다.
 * 예보범위(약 3일) 초과·실패 시 평년값으로 폴백하고, 결과는 1시간 캐시한다.
 */
export async function fetchRainChance(
  sigunguCode: number,
  date: Date = new Date(),
): Promise<WeatherHint> {
  const sg = findSigungu(sigunguCode)
  if (!sg) return climatologyHint(date)
  const targetYmd = ymd(date)

  return cachedFetch<WeatherHint>(
    `weather:${sg.code}:${targetYmd}`,
    async () => {
      try {
        // 브라우저 로컬 시각 = KST 가정 (서비스 대상이 국내)
        const { baseDate, baseTime } = latestBaseDateTime(new Date())
        const r = await fetch(
          `/api/weather?base_date=${baseDate}&base_time=${baseTime}&nx=${sg.gridX}&ny=${sg.gridY}&numOfRows=1000&pageNo=1`,
          { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(7000) },
        )
        if (!r.ok) return climatologyHint(date)
        const data = (await r.json()) as VilageResponse
        return rainHintFromForecast(data, targetYmd) ?? climatologyHint(date) // null = 오류 코드·예보 범위 밖
      } catch {
        return climatologyHint(date) // XML 에러응답(JSON 파싱 실패) 포함
      }
    },
    60 * 60 * 1000, // 1h
  )
}
