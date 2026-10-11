/**
 * 기상청 강수확률 → 코스 가중치용 힌트 — 순수 함수만.
 *
 * 예보는 기간에 따라 두 서비스로 나뉜다. 둘을 이어 붙여야 "이번 주말"이 늘 실제 예보로 덮인다.
 *   단기예보 (VilageFcstInfoService_2.0) : D+0 ~ D+2, 시·군 격자 단위, 3시간 간격 POP
 *   중기육상예보 (MidFcstInfoService)     : D+3 ~ D+10, 광역 예보구역 단위, 오전/오후 강수확률
 * 둘 다 범위 밖(열흘 넘는 코스 날짜)일 때만 평년값으로 떨어진다.
 *
 * api/weather.ts 에서 분리한 이유: 서버(api/course.ts)가 같은 규칙으로 강수 힌트를 계산해 코스 엔진에
 * 넣어야 한다. api/weather.ts 는 fetch·IndexedDB 캐시를 쓰는 브라우저 전용 모듈이라 서버 번들에 실을 수 없다.
 */

/**
 * 경상북도 평균 월별 강수일수 비율 (기상청 평년값 근사) — 1월=idx 0.
 * 예보가 닿지 않는 먼 미래(열흘 초과) 코스 날짜 전용. 화면에 "예보"로 표시되는 일이 없도록
 * WeatherHint.source 가 'climatology' 로 구분된다.
 */
const MONTHLY_RAIN_CHANCE: number[] = [
  0.10, 0.13, 0.20, 0.25, 0.30, 0.40, 0.55, 0.50, 0.30, 0.20, 0.15, 0.10,
]

/** 중기육상예보 예보구역 — 경북은 대구·경북 광역 하나다. 시·군 단위 중기예보는 제공되지 않는다. */
export const MID_LAND_REG_ID_GB = '11H10000'

/** 중기예보가 덮는 범위 (발표일 기준 일수). */
export const MID_MIN_DAY = 3
export const MID_MAX_DAY = 10

export type RainHint = 'rain-likely' | 'unstable' | 'clear'

export interface WeatherHint {
  rainChance: number
  /** forecast = 단기(시·군) · mid-forecast = 중기(광역) · climatology = 평년값 */
  source: 'forecast' | 'mid-forecast' | 'climatology'
  hint: RainHint
}

export function climatologyRainChance(date: Date = new Date()): number {
  return MONTHLY_RAIN_CHANCE[date.getMonth()] ?? 0.2
}

export function toRainHint(rainChance: number): RainHint {
  if (rainChance >= 0.5) return 'rain-likely'
  if (rainChance >= 0.3) return 'unstable'
  return 'clear'
}

/** 예보를 못 받을 때의 평년값 힌트 */
export function climatologyHint(date: Date = new Date()): WeatherHint {
  const c = climatologyRainChance(date)
  return { rainChance: c, source: 'climatology', hint: toRainHint(c) }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
}

/**
 * 기상청 단기예보 발표시각(02·05·08·11·14·17·20·23시, +10분 후 제공) 중
 * 현재 시각 기준 가장 최근 base_date/base_time 을 계산. `now` 는 KST 기준 Date 여야 한다
 * (브라우저 로컬=KST 가정. 서버(UTC)에서는 toKst() 로 보정해 넘긴다).
 */
export function latestBaseDateTime(now: Date): { baseDate: string; baseTime: string } {
  const slots = [2, 5, 8, 11, 14, 17, 20, 23]
  const d = new Date(now.getTime() - 10 * 60 * 1000) // 제공 지연 10분 버퍼
  const h = d.getHours()
  let chosen = -1
  for (const s of slots) if (s <= h) chosen = s
  if (chosen === -1) {
    d.setDate(d.getDate() - 1) // 02:10 이전 → 전날 23시 발표
    chosen = 23
  }
  return { baseDate: ymd(d), baseTime: `${pad2(chosen)}00` }
}

/** UTC 기준 런타임(엣지)에서 "KST 벽시계"를 로컬 필드로 읽을 수 있는 Date 로 이동 */
export function toKst(d: Date = new Date()): Date {
  return new Date(d.getTime() + (9 * 60 + d.getTimezoneOffset()) * 60 * 1000)
}

export interface VilageItem {
  category?: string
  fcstDate?: string
  fcstValue?: string
}

export interface VilageResponse {
  response?: { header?: { resultCode?: string }; body?: { items?: { item?: VilageItem[] } } }
}

/**
 * 단기예보 응답에서 대상 날짜의 시간대별 POP 최댓값으로 힌트를 만든다.
 * 오류 코드·예보 범위(약 3일) 밖이면 null → 호출부가 중기예보로 넘어간다.
 */
export function rainHintFromForecast(data: VilageResponse | undefined, targetYmd: string): WeatherHint | null {
  const code = data?.response?.header?.resultCode
  if (code && code !== '00') return null
  const items = data?.response?.body?.items?.item ?? []
  const pops = items
    .filter((it) => it.category === 'POP' && String(it.fcstDate) === targetYmd)
    .map((it) => Number(it.fcstValue))
    .filter((n) => !Number.isNaN(n))
  if (pops.length === 0) return null
  const maxPop = Math.max(...pops)
  const chance = Math.min(1, Math.max(0, maxPop / 100))
  return { rainChance: chance, source: 'forecast', hint: toRainHint(chance) }
}

/* ───────────────────────────── 중기육상예보 ───────────────────────────── */

/** 날짜 문자열(YYYYMMDD) 사이의 일수. 시간대 영향을 받지 않도록 UTC 자정끼리 뺀다. */
export function daysBetweenYmd(fromYmd: string, toYmd: string): number {
  const at = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)))
  return Math.round((at(toYmd) - at(fromYmd)) / 86_400_000)
}

/**
 * 중기예보 발표시각 — 하루 두 번(06·18시, +15분 후 제공) 중 가장 최근 것.
 * 예보 항목은 이 발표일 기준 +3 ~ +10일이라 baseYmd 를 함께 돌려준다.
 * `now` 는 단기예보와 마찬가지로 KST 기준 Date 여야 한다.
 */
export function latestMidBaseTime(now: Date): { tmFc: string; baseYmd: string } {
  const d = new Date(now.getTime() - 15 * 60 * 1000)
  const h = d.getHours()
  if (h >= 18) return { tmFc: `${ymd(d)}1800`, baseYmd: ymd(d) }
  if (h >= 6) return { tmFc: `${ymd(d)}0600`, baseYmd: ymd(d) }
  d.setDate(d.getDate() - 1) // 06:15 이전 → 전날 18시 발표
  return { tmFc: `${ymd(d)}1800`, baseYmd: ymd(d) }
}

/** rnSt3Am … rnSt7Pm, rnSt8 … rnSt10 — 8일째부터는 오전/오후 구분이 없다. */
export type MidLandItem = Record<string, string | number | undefined>

export interface MidLandResponse {
  response?: { header?: { resultCode?: string }; body?: { items?: { item?: MidLandItem[] } } }
}

/**
 * 중기육상예보에서 대상 날짜의 강수확률을 꺼낸다 — 오전·오후 중 큰 쪽(하루 중 최대 위험).
 * 발표일 기준 +3 ~ +10일 밖이거나 값이 없으면 null → 호출부가 평년값으로 폴백.
 */
export function rainHintFromMid(
  data: MidLandResponse | undefined,
  targetYmd: string,
  baseYmd: string,
): WeatherHint | null {
  const code = data?.response?.header?.resultCode
  if (code && code !== '00') return null
  const item = data?.response?.body?.items?.item?.[0]
  if (!item) return null
  const day = daysBetweenYmd(baseYmd, targetYmd)
  if (day < MID_MIN_DAY || day > MID_MAX_DAY) return null
  const keys = day <= 7 ? [`rnSt${day}Am`, `rnSt${day}Pm`] : [`rnSt${day}`]
  const pops = keys.map((k) => Number(item[k])).filter((n) => Number.isFinite(n))
  if (pops.length === 0) return null
  const chance = Math.min(1, Math.max(0, Math.max(...pops) / 100))
  return { rainChance: chance, source: 'mid-forecast', hint: toRainHint(chance) }
}
