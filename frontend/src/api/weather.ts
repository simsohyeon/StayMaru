import { findSigungu } from '@/constants/sigungu'
import { cachedFetch } from '@/lib/cache'
import {
  climatologyHint,
  latestBaseDateTime,
  latestMidBaseTime,
  rainHintFromForecast,
  rainHintFromMid,
  ymd,
  MID_LAND_REG_ID_GB,
  type MidLandResponse,
  type VilageResponse,
  type WeatherHint,
} from '@/lib/rainHint'

/**
 * 기상청 강수확률 — 코스 가중치 조정에 사용.
 * 'rain-likely' 면 코스 엔진이 실내 카테고리 가중치를 올리고 trail 을 낮춘다.
 *
 * 예보를 두 서비스로 이어 붙인다. 단기예보만 쓰면 D+3 이후가 비어 "이번 주말"이 주중 내내
 * 평년값으로 떨어졌다 — 월~수에 보면 토요일은 D+3~D+5 라 항상 범위 밖이었다.
 *   단기(D+0~2, 시·군 격자) → 중기(D+3~10, 대구·경북 광역) → 평년값(그 밖)
 *
 * 계산 규칙(발표시각·POP 집계·평년값)은 lib/rainHint.ts 에 있고 서버(api/course.ts)와 공유한다.
 * 이 파일은 브라우저 전용 — /api/weather 호출과 IndexedDB 캐시만 담당한다.
 */

export { climatologyRainChance, toRainHint, type RainHint, type WeatherHint } from '@/lib/rainHint'

const TIMEOUT_MS = 7000

async function getJson<T>(url: string): Promise<T | undefined> {
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!r.ok) return undefined
    return (await r.json()) as T
  } catch {
    return undefined // XML 에러응답(JSON 파싱 실패)·타임아웃 포함
  }
}

/** 단기예보 — 시·군 격자의 3시간 간격 POP. 대상 날짜가 범위(약 3일) 밖이면 null. */
async function shortTermHint(gridX: number, gridY: number, targetYmd: string): Promise<WeatherHint | null> {
  // 브라우저 로컬 시각 = KST 가정 (서비스 대상이 국내)
  const { baseDate, baseTime } = latestBaseDateTime(new Date())
  const data = await getJson<VilageResponse>(
    `/api/weather?base_date=${baseDate}&base_time=${baseTime}&nx=${gridX}&ny=${gridY}&numOfRows=1000&pageNo=1`,
  )
  return data ? rainHintFromForecast(data, targetYmd) : null
}

/** 중기육상예보 — 발표일 +3~+10일. 예보구역이 대구·경북 하나라 시·군별 차이는 없다. */
async function midTermHint(targetYmd: string): Promise<WeatherHint | null> {
  const { tmFc, baseYmd } = latestMidBaseTime(new Date())
  const data = await getJson<MidLandResponse>(
    `/api/weather-mid?regId=${MID_LAND_REG_ID_GB}&tmFc=${tmFc}&numOfRows=10&pageNo=1`,
  )
  return data ? rainHintFromMid(data, targetYmd, baseYmd) : null
}

/**
 * 거점 시군구의 강수확률. 단기 → 중기 → 평년값 순으로 내려가고, 결과는 1시간 캐시한다.
 * source 로 어느 단계에서 나온 값인지 구분되므로 화면이 "예보"와 "평년값"을 섞어 쓰지 않는다.
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
    async () =>
      (await shortTermHint(sg.gridX, sg.gridY, targetYmd)) ??
      (await midTermHint(targetYmd)) ??
      climatologyHint(date),
    60 * 60 * 1000, // 1h
  )
}
