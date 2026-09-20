import type { RegionVisit } from '@/api/bigdata'
import type { CategoryId, CourseProfile } from '@/types/domain'

/**
 * "지금 경북" — 데이터 나열이 아니라 여행자의 질문 세 개에 답하는 판단 계층.
 *
 *   Q1 이번 주말 어디 가면 안 붐빌까?   → pickQuietRegions · busiestRegions · overlapsWeekend
 *   Q2 가려던 곳이 붐비면 대신 어디로?   → busyLevel · alternativesFor
 *   Q3 내 취향이면 어디가 맞을까?        → tasteRanking
 *
 * 전부 순수 함수 — 데이터 호출(방문자·축제·강수·장소 수)은 화면이 하고 여기서는 합치기만 한다.
 */

/** 울릉군 — 뱃길 기상에 좌우돼 "주말 어디로" 추천에서는 뺀다(목록·랭킹에는 그대로). */
export const ULLEUNG_CODE = 17

export interface Weekend {
  sat: Date
  sun: Date
  /** YYYYMMDD */
  satYmd: string
  /** YYYYMMDD */
  sunYmd: string
}

export function toYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

/**
 * 다가오는(또는 진행 중인) 주말.
 * 월~금 → 이번 주 토·일 / 토 → 오늘·내일 / 일 → 어제·오늘(아직 주말이므로 다음 주로 넘기지 않는다).
 */
export function upcomingWeekend(now: Date = new Date()): Weekend {
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dow = base.getDay() // 0=일 … 6=토
  const sat = new Date(base)
  if (dow === 0) sat.setDate(base.getDate() - 1)
  else sat.setDate(base.getDate() + (6 - dow))
  const sun = new Date(sat)
  sun.setDate(sat.getDate() + 1)
  return { sat, sun, satYmd: toYmd(sat), sunYmd: toYmd(sun) }
}

/** 행사 기간(YYYYMMDD)이 주말과 하루라도 겹치는가. */
export function overlapsWeekend(
  f: { eventStartDate: string; eventEndDate: string },
  w: Weekend,
): boolean {
  return f.eventStartDate <= w.sunYmd && f.eventEndDate >= w.satYmd
}

/** 붐빔 5단계 — 최다 시·군 대비 비율. 1=한적 … 5=매우 붐빔. */
export type BusyLevel = 1 | 2 | 3 | 4 | 5
export function busyLevel(visitors: number, max: number): BusyLevel {
  if (max <= 0) return 1
  const r = visitors / max
  if (r < 0.05) return 1
  if (r < 0.15) return 2
  if (r < 0.3) return 3
  if (r < 0.6) return 4
  return 5
}

export interface QuietPickInput {
  visits: RegionVisit[]
  /** 주말과 겹치는 축제가 있는 시·군 */
  festivalRegions?: Set<number>
  /** 시·군별 주말 강수확률(%) — 없는 시·군은 제외하지 않는다 */
  rainByRegion?: Map<number, number>
  /** 이 값 이상이면 비 예보로 제외 */
  rainMax?: number
  exclude?: number[]
  take?: number
}

/** Q1 — 한적 순으로 훑되 축제 겹침·비 예보·제외 목록을 건너뛴 상위 N. */
export function pickQuietRegions({
  visits,
  festivalRegions = new Set(),
  rainByRegion = new Map(),
  rainMax = 60,
  exclude = [ULLEUNG_CODE],
  take = 3,
}: QuietPickInput): RegionVisit[] {
  const asc = [...visits].sort((a, b) => a.visitors - b.visitors)
  const out: RegionVisit[] = []
  for (const v of asc) {
    if (exclude.includes(v.sigunguCode)) continue
    if (festivalRegions.has(v.sigunguCode)) continue
    const rain = rainByRegion.get(v.sigunguCode)
    if (rain !== undefined && rain >= rainMax) continue
    out.push(v)
    if (out.length >= take) break
  }
  return out
}

/** 방문자 많은 순 상위 N (Q1 문장의 "붐비는 곳", Q2 칩). */
export function busiestRegions(visits: RegionVisit[], take = 2): RegionVisit[] {
  return [...visits].sort((a, b) => b.visitors - a.visitors).slice(0, take)
}

/** 한적 순위 (1 = 가장 한적). 목록에 없으면 undefined. */
export function quietRankOf(visits: RegionVisit[], sigunguCode: number): number | undefined {
  const asc = [...visits].sort((a, b) => a.visitors - b.visitors)
  const i = asc.findIndex((v) => v.sigunguCode === sigunguCode)
  return i < 0 ? undefined : i + 1
}

export interface Alternative {
  sigunguCode: number
  /** 해당 카테고리 장소 수 */
  count: number
  visitors: number
  /** 대상 시·군 방문자 대비 비율(0~1) */
  ratio: number
}

/**
 * Q2 — 대상 시·군과 "같은 결"인데 더 조용한 시·군.
 * 기준 카테고리 장소가 minPlaces 이상이고, 방문자가 대상의 maxRatio 이하인 곳을 한적 순으로.
 */
export function alternativesFor(
  target: number,
  visits: RegionVisit[],
  countsByRegion: Map<number, number>,
  { minPlaces = 5, maxRatio = 0.2, take = 3 }: { minPlaces?: number; maxRatio?: number; take?: number } = {},
): Alternative[] {
  const t = visits.find((v) => v.sigunguCode === target)
  if (!t) return []
  return visits
    .filter((v) => v.sigunguCode !== target)
    .map((v) => ({
      sigunguCode: v.sigunguCode,
      count: countsByRegion.get(v.sigunguCode) ?? 0,
      visitors: v.visitors,
      ratio: t.visitors > 0 ? v.visitors / t.visitors : 1,
    }))
    .filter((a) => a.count >= minPlaces && a.ratio <= maxRatio)
    .sort((a, b) => a.visitors - b.visitors)
    .slice(0, take)
}

/** 카테고리별 장소 수에서 가장 많은 카테고리 — Q2 의 "결"을 정한다. 전부 0 이면 undefined. */
export function pickBestCategory(counts: Partial<Record<CategoryId, number>>): CategoryId | undefined {
  let best: CategoryId | undefined
  let max = 0
  for (const [k, n] of Object.entries(counts) as [CategoryId, number | undefined][]) {
    if ((n ?? 0) > max) {
      max = n ?? 0
      best = k
    }
  }
  return best
}

export interface TasteRow {
  sigunguCode: number
  count: number
  visitors: number
  quietRank: number
  /** minPlaces 미만이면 "갈 곳이 적음" — 뒤로 밀린다 */
  sparse: boolean
  score: number
}

/**
 * Q3 — "갈 곳이 충분하면서 한적한" 순.
 * score = log1p(장소 수) × (1 − 정규화된 log 방문자)². 한적을 제곱으로 세게 봐서
 * 안동(33곳·30만)처럼 장소는 많지만 붐비는 곳이 봉화(9곳·8.5만) 뒤로 간다. 장소 0 은 제외, minPlaces 미만은 뒤로.
 */
export function tasteRanking(
  countsByRegion: Map<number, number>,
  visits: RegionVisit[],
  { minPlaces = 5 }: { minPlaces?: number } = {},
): TasteRow[] {
  const asc = [...visits].sort((a, b) => a.visitors - b.visitors)
  if (asc.length === 0) return []
  const logs = asc.map((v) => Math.log10(Math.max(1, v.visitors)))
  const lmin = Math.min(...logs)
  const lspan = Math.max(...logs) - lmin || 1
  const rows: TasteRow[] = []
  asc.forEach((v, i) => {
    const count = countsByRegion.get(v.sigunguCode) ?? 0
    if (count <= 0) return
    const norm = (Math.log10(Math.max(1, v.visitors)) - lmin) / lspan
    rows.push({
      sigunguCode: v.sigunguCode,
      count,
      visitors: v.visitors,
      quietRank: i + 1,
      sparse: count < minPlaces,
      score: Math.log1p(count) * (1 - norm) ** 2,
    })
  })
  return rows.sort((a, b) => {
    if (a.sparse !== b.sparse) return a.sparse ? 1 : -1
    return b.score - a.score
  })
}

/** 취향 탭 → 코스 생성 프로필 (홈 ?gen= 진입용). */
export const TASTE_PROFILE: Record<'hanok' | 'seowon' | 'templestay' | 'festival', CourseProfile> = {
  hanok: 'hanok_emotion',
  seowon: 'known_gb',
  templestay: 'temple_healing',
  festival: 'festival_link',
}

/** 홈 코스 생성 진입 URL — 시·군 + 프로필. */
export function courseUrl(profile: CourseProfile, sigunguCodes: number[]): string {
  const sg = sigunguCodes.filter((n) => n > 0).join(',')
  return `/?gen=${profile}${sg ? `&sigungu=${sg}` : ''}`
}
