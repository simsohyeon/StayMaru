import { findSigungu } from '@/constants/sigungu'
import { cachedFetch } from '@/lib/cache'

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

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function ymd(d: Date): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
}

/**
 * 기상청 단기예보 발표시각(02·05·08·11·14·17·20·23시, +10분 후 제공) 중
 * 현재 시각 기준 가장 최근 base_date/base_time 을 KST(브라우저 로컬=KST) 기준으로 계산.
 */
function latestBaseDateTime(now: Date): { baseDate: string; baseTime: string } {
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

interface VilageItem {
  category?: string
  fcstDate?: string
  fcstValue?: string
}

/**
 * 거점 시군구의 강수확률(POP). 기상청 단기예보 실연동(`/api/weather` 프록시) →
 * 대상 날짜의 시간대별 POP 중 최댓값을 강수확률로 사용한다.
 *
 * graceful: 활용신청 미승인·예보범위(약 3일) 초과·네트워크 실패 시 평년값(climatology)으로 폴백.
 * 결과는 1시간 캐시(예보 갱신 주기 고려).
 */
export async function fetchRainChance(
  sigunguCode: number,
  date: Date = new Date(),
): Promise<WeatherHint> {
  const climoFallback = (): WeatherHint => {
    const c = climatologyRainChance(date)
    return { rainChance: c, source: 'climatology', hint: toRainHint(c) }
  }
  const sg = findSigungu(sigunguCode)
  if (!sg) return climoFallback()
  const targetYmd = ymd(date)

  return cachedFetch<WeatherHint>(
    `weather:${sg.code}:${targetYmd}`,
    async () => {
      try {
        const { baseDate, baseTime } = latestBaseDateTime(new Date())
        const r = await fetch(
          `/api/weather?base_date=${baseDate}&base_time=${baseTime}&nx=${sg.gridX}&ny=${sg.gridY}&numOfRows=1000&pageNo=1`,
          { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(7000) },
        )
        if (!r.ok) return climoFallback()
        const data = (await r.json()) as {
          response?: { header?: { resultCode?: string }; body?: { items?: { item?: VilageItem[] } } }
        }
        if (data?.response?.header?.resultCode && data.response.header.resultCode !== '00') {
          return climoFallback()
        }
        const items = data?.response?.body?.items?.item ?? []
        const pops = items
          .filter((it) => it.category === 'POP' && String(it.fcstDate) === targetYmd)
          .map((it) => Number(it.fcstValue))
          .filter((n) => !Number.isNaN(n))
        if (pops.length === 0) return climoFallback() // 예보 범위(약 3일) 밖
        const maxPop = Math.max(...pops)
        const chance = Math.min(1, Math.max(0, maxPop / 100))
        return { rainChance: chance, source: 'forecast', hint: toRainHint(chance) }
      } catch {
        return climoFallback() // XML 에러응답(JSON 파싱 실패) 포함
      }
    },
    60 * 60 * 1000, // 1h
  )
}
