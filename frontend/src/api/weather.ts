import { findSigungu } from '@/constants/sigungu'

/**
 * 기상청 단기예보 강수확률(POP) — 코스 가중치 조정에 사용.
 *
 * 실제 API(`apis.data.go.kr/1360000/VilageFcstInfoService_2.0`) 호출은
 * service key 가 필요해 서버리스 프록시 경유로 가야 한다. MVP 단계에서는
 * 30년 평년값 기반 월별 강수일수 비율을 fallback 으로 사용한다.
 *
 * 응답이 'rain-likely' 면 코스 엔진에서 실내(experience·hanok·market·temple) 카테고리
 * 가중치를 높이고, trail 가중치는 낮춰 비 오는 날 경험을 보정한다.
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

/**
 * 거점 시군구의 예보. 백엔드 프록시가 준비되면 실호출로 교체, 현재는 climatology fallback.
 */
export async function fetchRainChance(
  sigunguCode: number,
  date: Date = new Date(),
): Promise<WeatherHint> {
  const sg = findSigungu(sigunguCode)
  if (!sg) {
    const fallback = climatologyRainChance(date)
    return { rainChance: fallback, source: 'climatology', hint: toRainHint(fallback) }
  }

  // 백엔드 프록시 활성화 시: /api/weather?nx=..&ny=..&date=YYYYMMDD
  // try {
  //   const r = await fetch(`/api/weather?nx=${sg.gridX}&ny=${sg.gridY}&date=${ymd(date)}`)
  //   if (r.ok) {
  //     const d = (await r.json()) as { rainChance: number }
  //     return { rainChance: d.rainChance, source: 'forecast', hint: toRainHint(d.rainChance) }
  //   }
  // } catch { /* ignore */ }

  const fallback = climatologyRainChance(date)
  return { rainChance: fallback, source: 'climatology', hint: toRainHint(fallback) }
}
