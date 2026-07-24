/**
 * 한적지수(Quiet Index) — '숨은 경북 코스'의 데이터 근거.
 *
 * 방문자(또는 인구밀도)가 적을수록 한적하다고 보고 0~100 점수를 매긴다.
 * 로그 정규화로 극단값(경주·안동 같은 초대형 방문지) 쏠림을 완화한다.
 *
 * 데이터 출처: 한국관광공사 DataLab '외부 방문객(외지인+외국인)' 통계.
 *   라이브 데이터가 없으면(미구독/지연/에러) 통계청 인구밀도를 대리값으로 폴백해
 *   항상 렌더된다. (Insights 방문자 지도와 동일한 폴백 정책)
 */
import type { RegionVisit } from '@/api/bigdata'
import { SIGUNGUS } from '@/constants/sigungu'

export interface QuietRegion {
  sigunguCode: number
  /** 외부 방문객 수(라이브) 또는 인구밀도(폴백) — 낮을수록 한적 */
  metric: number
  /** 한적지수 0~100 (높을수록 한적) */
  quietScore: number
  /** 1 = 가장 한적 */
  rank: number
}

/**
 * 울릉군(code 17) — 섬. 인구밀도가 낮아 한적지수 상위에 오르지만, 코스 엔진은 직선거리로
 * 동선을 짜고 배편을 모델링하지 않아 본토 시·군과 한 코스로 묶으면 바다 횡단 동선이 된다.
 * 숨은 코스 후보/리스트에서 제외한다. (정복지도·일러스트 지도도 code 17 을 별도 처리)
 */
const ISLAND_CODE = 17

function scoreByMetric(input: { sigunguCode: number; metric: number }[]): QuietRegion[] {
  const rows = input.filter((r) => r.sigunguCode !== ISLAND_CODE)
  if (rows.length === 0) return []
  const logs = rows.map((r) => Math.log(Math.max(1, r.metric)))
  const min = Math.min(...logs)
  const max = Math.max(...logs)
  const span = max - min || 1
  return rows
    .map((r, i) => {
      const norm = (logs[i] - min) / span // 0(적음) ~ 1(많음)
      return { sigunguCode: r.sigunguCode, metric: r.metric, quietScore: Math.round((1 - norm) * 100) }
    })
    .sort((a, b) => b.quietScore - a.quietScore)
    .map((r, i) => ({ ...r, rank: i + 1 }))
}

/** 라이브 DataLab 방문자 데이터로 한적지수 산출. */
export function computeQuietRegions(visits: RegionVisit[]): QuietRegion[] {
  return scoreByMetric(visits.map((v) => ({ sigunguCode: v.sigunguCode, metric: v.visitors })))
}

/** 폴백 — 통계청 인구밀도를 방문 신호 대리값으로. 라이브가 오기 전에도 항상 렌더. */
export function staticQuietRegions(): QuietRegion[] {
  return scoreByMetric(SIGUNGUS.map((sg) => ({ sigunguCode: sg.code, metric: sg.populationDensity })))
}
