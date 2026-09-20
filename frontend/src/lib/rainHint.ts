/**
 * 기상청 단기예보 강수확률(POP) → 코스 가중치용 힌트 — 순수 함수만.
 *
 * api/weather.ts 에서 분리한 이유: 서버(api/course.ts)가 같은 규칙으로 강수 힌트를 계산해 코스 엔진에
 * 넣어야 한다. api/weather.ts 는 fetch·IndexedDB 캐시를 쓰는 브라우저 전용 모듈이라 서버 번들에 실을 수 없다.
 */

/** 경상북도 평균 월별 강수일수 비율 (기상청 평년값 근사) — 1월=idx 0 */
const MONTHLY_RAIN_CHANCE: number[] = [
  0.10, 0.13, 0.20, 0.25, 0.30, 0.40, 0.55, 0.50, 0.30, 0.20, 0.15, 0.10,
]

export type RainHint = 'rain-likely' | 'unstable' | 'clear'

export interface WeatherHint {
  rainChance: number
  source: 'forecast' | 'climatology'
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
 * 오류 코드·예보 범위(약 3일) 밖이면 null → 호출부가 평년값으로 폴백.
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
