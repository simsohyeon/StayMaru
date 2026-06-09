import { PROFILE_WEIGHTS, type ProfileWeights } from '@/constants/categories'
import { findSigungu } from '@/constants/sigungu'
import { visitorBoostFor } from '@/lib/visitorIndex'
import { isoToYmd } from '@/api/tour'
import { estimateMinutes, haversineKm } from '@/lib/geo'
import type { RainHint } from '@/api/weather'
import type {
  CategoryId,
  Companion,
  Course,
  CourseItem,
  CourseProfile,
  DateRange,
  Festival,
  LatLng,
  Place,
  TripDuration,
} from '@/types/domain'
import type { Lang } from '@/types/domain'

export interface GenerateOptions {
  candidates: Place[]
  festivals: Festival[]
  baseSigungus: number[]
  /** 사용자 거점 좌표 (없으면 후보들 중 sigungu 중심 fallback) */
  baseCenter?: LatLng
  duration: TripDuration
  dateRange?: DateRange
  /** 단일 또는 다중 코스 유형. profiles 가 있으면 우선. */
  profile?: CourseProfile
  profiles?: CourseProfile[]
  /** 호환용 — 명시되면 사용, 아니면 profiles 에 'hidden_gb' 포함 여부로 자동 결정. */
  hiddenMode?: boolean
  /** 찜한 장소들 — 가중치 부여 (FR-17) */
  favorites?: Place[]
  /** 날씨 힌트 — 'rain-likely' 면 실내(experience/hanok/market/temple) 가중치↑, 야외(trail)↓ */
  rainHint?: RainHint
  /** 동반자 — 카테고리 가중치 조정 (친구·연인·아이·부모님·반려동물·무장애) */
  companions?: Companion[]
  lang: Lang
  title?: string
}

/**
 * 동반자별 카테고리 multiplier — scoreOf 에서 곱한다. 여러 동반자가 겹치면 카테고리별 max 를 취해
 * 과증폭을 막는다(mergeCompanionMult). 'accessible' 은 카테고리가 아니라 장소의 무장애 정보로
 * 별도 가산하므로 여기엔 없다.
 *  - friends:  체험·시장·축제 위주 (활동적)
 *  - couple:   한옥·둘레길·관광지(야경/풍경)
 *  - kids:     체험·관광지 ↑ / 서원·템플스테이 ↓ (정적인 공간 비선호)
 *  - parents:  한옥·시장·서원 ↑ / 둘레길 ↓ (이동 부담)
 *  - pet:      둘레길·관광지(야외) ↑ / 사찰·템플스테이 ↓ (반려동물 제한 잦음)
 *  - solo:     사찰·둘레길·서원(사색)
 */
const COMPANION_MULT: Record<Companion, Partial<Record<CategoryId, number>>> = {
  solo:    { temple: 1.25, trail: 1.2, seowon: 1.15, hanok: 1.1 },
  friends: { experience: 1.35, market: 1.3, festival: 1.25, attraction: 1.15 },
  couple:  { hanok: 1.3, trail: 1.2, attraction: 1.2, seowon: 1.1 },
  kids:    { experience: 1.4, attraction: 1.25, market: 1.15, seowon: 0.7, templestay: 0.7 },
  parents: { hanok: 1.25, market: 1.25, seowon: 1.2, temple: 1.1, trail: 0.7 },
  pet:     { trail: 1.4, attraction: 1.25, market: 1.05, temple: 0.55, templestay: 0.45 },
  accessible: {},
}

/** 선택된 동반자들의 카테고리 multiplier 를 카테고리별 max 로 병합. 빈 배열이면 빈 객체. */
function mergeCompanionMult(companions: Companion[]): Partial<Record<CategoryId, number>> {
  const merged: Partial<Record<CategoryId, number>> = {}
  for (const c of companions) {
    const m = COMPANION_MULT[c]
    for (const cat of Object.keys(m) as CategoryId[]) {
      const v = m[cat]!
      // 1 미만(감점)은 min, 1 이상(가점)은 max — 한쪽이 깎으면 깎인 값을 존중하되 가점은 가장 큰 값.
      const cur = merged[cat]
      if (cur === undefined) merged[cat] = v
      else if (v < 1 || cur < 1) merged[cat] = Math.min(cur, v)
      else merged[cat] = Math.max(cur, v)
    }
  }
  return merged
}

/** 비 오는 날 카테고리 multiplier — generateCourse 의 scoreOf 에서 추가 가중치로 사용. */
const RAIN_MULT: Record<RainHint, Partial<Record<CategoryId, number>>> = {
  'rain-likely': {
    experience: 1.4, hanok: 1.3, market: 1.3, temple: 1.2, seowon: 1.1,
    trail: 0.5, attraction: 0.85,
  },
  'unstable': {
    experience: 1.15, hanok: 1.1, market: 1.1,
    trail: 0.8,
  },
  'clear': {},
}

const DEFAULT_PROFILE: CourseProfile = 'hanok_emotion'

/**
 * 여행 기간별 코스 파라미터.
 *  - target:       카테고리 다양성 채우기의 목표 장소 수
 *  - radiusKm:     거점에서 이 반경 안은 정상 점수. 초과 시 선형 감점.
 *  - hardCutoffKm: 이 거리 초과는 후보 풀에서 아예 제외 (부족하면 폴백).
 *  - allowLodging: hanok/templestay (숙박 카테고리) 포함 여부. 당일치기 false.
 *
 * 경북 도내 거리 감각: 안동↔영주 ≈ 35km, 안동↔포항 ≈ 80km, 청송↔봉화 ≈ 45km.
 */
interface DurationProfile {
  target: number
  radiusKm: number
  hardCutoffKm: number
  allowLodging: boolean
  /** 거점 시군구 외부 후보의 점수 곱 — 당일치기는 거의 0 */
  offBaseMult: number
}
const DURATION_PROFILE: Record<TripDuration, DurationProfile> = {
  day:    { target: 4, radiusKm: 25, hardCutoffKm: 35,  allowLodging: false, offBaseMult: 0.15 },
  '1n2d': { target: 6, radiusKm: 50, hardCutoffKm: 70,  allowLodging: true,  offBaseMult: 0.45 },
  '2n3d': { target: 8, radiusKm: 80, hardCutoffKm: 110, allowLodging: true,  offBaseMult: 0.65 },
  custom: { target: 6, radiusKm: 50, hardCutoffKm: 70,  allowLodging: true,  offBaseMult: 0.45 },
}

/**
 * FR-03·04·16·17·18·21 — 코스 자동 생성 진입점.
 *
 * 절차:
 *  1) 후보 점수화 (카테고리 가중치 × 숨겨진지역 보너스 × 찜 가중치)
 *  2) 카테고리 다양성을 보장하며 상위 N개 선택 (숙박 1, 서원/사찰 1~2, 체험 1~2, 시장 1, +축제)
 *  3) 거점 좌표 기준 Nearest-Neighbor 로 방문 순서 정렬
 *  4) 거리·이동 시간 계산
 */
export function generateCourse(opts: GenerateOptions): Course {
  const {
    candidates,
    festivals,
    baseSigungus,
    duration,
    dateRange,
    favorites = [],
    rainHint,
    companions = [],
    lang,
    title,
  } = opts

  // profiles 정규화 — profiles[] 우선, 단일 profile 폴백, 둘 다 비면 빈 배열(아무 선택 안 함 → known 디폴트)
  const activeProfiles: CourseProfile[] =
    opts.profiles && opts.profiles.length > 0
      ? opts.profiles
      : opts.profile
        ? [opts.profile]
        : []
  const primaryProfile: CourseProfile = activeProfiles[0] ?? DEFAULT_PROFILE
  const hasFestivalLink = activeProfiles.includes('festival_link')
  const hiddenMode = opts.hiddenMode ?? activeProfiles.includes('hidden_gb')

  if (candidates.length === 0) {
    return emptyCourse({ ...opts, profile: primaryProfile, hiddenMode })
  }

  // 멀티 프로필 — 카테고리별 max 가중치 머지. hiddenAreaBonus 도 max.
  const weights: ProfileWeights = mergeWeights(
    activeProfiles.length > 0 ? activeProfiles : [primaryProfile],
  )
  const baseCenter = opts.baseCenter ?? inferBaseCenter(baseSigungus, candidates)
  const favoriteIds = new Set(favorites.map((f) => f.id))
  const durProfile = DURATION_PROFILE[duration]

  // FR-16 — 여행 기간에 겹치는 축제만 후보로. 거점 지역이 정해졌으면 그 시군구의 축제만 연계한다.
  const dateMatched = dateRange
    ? festivals.filter((f) => festivalOverlaps(f, dateRange))
    : festivals.filter((f) => f.eventStartDate && f.eventEndDate)
  const matchingFestivals =
    baseSigungus.length > 0
      ? dateMatched.filter((f) => f.sigunguCode !== undefined && baseSigungus.includes(f.sigunguCode))
      : dateMatched

  // 0) Hard cutoff — 거점 반경을 크게 벗어난 후보는 풀에서 제외.
  //    당일치기 사용자가 멀리 떨어진 후보를 받지 않도록 1차 필터링. 단, 필터 결과가 너무
  //    적으면(목표의 절반 미만) 원본 후보로 폴백해서 빈 결과를 피한다.
  const withinCutoff = candidates.filter((c) => {
    const d = haversineKm(baseCenter, c.position)
    return d <= durProfile.hardCutoffKm
  })
  const workingPool =
    withinCutoff.length >= Math.max(durProfile.target * 1.5, 6) ? withinCutoff : candidates

  // 동반자 가중치 — 카테고리 multiplier 병합 + 무장애/반려동물 장소 가산 플래그
  const companionMult = mergeCompanionMult(companions)
  const accessibleMode = companions.includes('accessible')
  const petMode = companions.includes('pet')

  // 1) 점수화
  const scored = workingPool.map((p) => ({
    place: p,
    score: scoreOf(p, weights, hiddenMode, favoriteIds, baseCenter, baseSigungus, durProfile, rainHint, companionMult, accessibleMode, petMode),
  }))
  scored.sort((a, b) => b.score - a.score)

  // 2) 카테고리 다양성 — 슬롯 채우기
  const desired = durProfile.target
  const quotas = buildQuotasMulti(activeProfiles.length > 0 ? activeProfiles : [primaryProfile], desired, durProfile.allowLodging, hasFestivalLink)
  // 동반자 시그니처 카테고리 슬롯 보장 — 점수 가중만으로는 quota 에 막혀 못 들어오는 걸 보완.
  applyCompanionQuotas(quotas, companions)
  const picked: Place[] = []
  const usedIds = new Set<string>()

  for (const cat of Object.keys(quotas) as CategoryId[]) {
    const need = quotas[cat]
    if (!need) continue
    const fromCat = scored.filter((s) => s.place.category === cat && !usedIds.has(s.place.id))
    for (let i = 0; i < need && i < fromCat.length; i++) {
      picked.push(fromCat[i].place)
      usedIds.add(fromCat[i].place.id)
    }
  }
  // 부족분은 점수 순으로 보충 (FR-17 — 찜 부족 시 동일 카테고리·인근 보완)
  for (const s of scored) {
    if (picked.length >= desired) break
    if (!usedIds.has(s.place.id)) {
      picked.push(s.place)
      usedIds.add(s.place.id)
    }
  }

  // 축제 — 축제연계 프로필 선택 + 여행 기간에 열리는 축제가 있을 때만 1개 포함
  if (
    hasFestivalLink &&
    matchingFestivals.length > 0 &&
    !picked.some((p) => p.category === 'festival')
  ) {
    const fest = matchingFestivals[0]
    picked.push(fest)
    usedIds.add(fest.id)
  }

  // 3) NN 정렬 — 거점 여러 곳이면 시군구별 클러스터로 묶어 점프 최소화. 이후 2-opt 로 총 이동거리 최소화.
  const nnOrdered = clusteredNearestNeighbor(picked, baseCenter, baseSigungus)
  const ordered = twoOptImprove(nnOrdered, baseCenter)

  // 4) 거리 계산
  const items: CourseItem[] = ordered.map((p, i) => {
    const prev = i === 0 ? baseCenter : ordered[i - 1].position
    const d = haversineKm(prev, p.position)
    return { place: p, order: i + 1, distanceFromPrevKm: round1(d) }
  })
  const totalKm = round1(items.reduce((a, it) => a + it.distanceFromPrevKm, 0))

  return {
    id: `course-${Date.now()}`,
    title: title ?? buildAutoTitle(baseSigungus, primaryProfile, lang),
    baseSigungus,
    baseCenter,
    duration,
    dateRange,
    profile: primaryProfile,
    hiddenMode,
    items,
    totalDistanceKm: totalKm,
    estimatedTravelMinutes: estimateMinutes(totalKm),
    createdAt: new Date().toISOString(),
    lang,
  }
}

/** FR-19 — 코스 편집 후 거리/시간 재계산 */
export function recomputeCourse(c: Course, baseCenter?: LatLng): Course {
  if (c.items.length === 0) return { ...c, totalDistanceKm: 0, estimatedTravelMinutes: 0 }
  // 편집 후에도 원본과 동일 기준점에서 거리 합을 내도록 거점 중심을 우선 사용.
  const start = baseCenter ?? c.baseCenter ?? c.items[0].place.position
  const items: CourseItem[] = c.items.map((it, i) => {
    const prev = i === 0 ? start : c.items[i - 1].place.position
    return { ...it, order: i + 1, distanceFromPrevKm: round1(haversineKm(prev, it.place.position)) }
  })
  const totalKm = round1(items.reduce((a, it) => a + it.distanceFromPrevKm, 0))
  return {
    ...c,
    items,
    totalDistanceKm: totalKm,
    estimatedTravelMinutes: estimateMinutes(totalKm),
  }
}

// ─── helpers ───────────────────────────────────────────────────────────────

function scoreOf(
  p: Place,
  w: ProfileWeights,
  hiddenMode: boolean,
  favIds: Set<string>,
  baseCenter: LatLng,
  baseSigungus: number[],
  durProfile: DurationProfile,
  rainHint?: RainHint,
  companionMult?: Partial<Record<CategoryId, number>>,
  accessibleMode?: boolean,
  petMode?: boolean,
): number {
  const catWeight = (w as unknown as Record<CategoryId, number>)[p.category] ?? 1.0
  let score = catWeight

  // 동반자 카테고리 가중치 (친구·연인·아이·부모님·반려동물)
  if (companionMult) {
    const cm = companionMult[p.category]
    if (cm) score *= cm
  }

  // 무장애 여행 — 휠체어 접근/무장애 정보가 있는 장소에 가산. 데이터 없으면 그대로(graceful).
  if (accessibleMode) {
    const a = p.accessibility
    if (a?.wheelchair || a?.tour) score *= 1.6
    else score *= 0.85 // 무장애 정보 미확인 장소는 약하게 감점
  }

  // 반려동물 — 동반 가능 정보가 있으면 가산
  if (petMode && p.accessibility?.pet) score *= 1.3

  // 당일치기는 숙박 카테고리(한옥/템플스테이) 점수 거의 0 — quota 외 자리에서도 안 뽑히게.
  if (!durProfile.allowLodging && (p.category === 'hanok' || p.category === 'templestay')) {
    score *= 0.05
  }

  // 찜 가중치 (FR-17)
  if (favIds.has(p.id)) score *= 2.5

  // FR-04 — 숨겨진 경북 모드: DataLab 실방문자 기반 한적함 보너스 우선, 없으면 정적 hiddenBoost.
  if (hiddenMode || w.hiddenAreaBonus > 1) {
    if (p.sigunguCode) {
      const sg = findSigungu(p.sigunguCode)
      const boost = visitorBoostFor(p.sigunguCode) ?? sg?.hiddenBoost
      if (boost !== undefined) score *= 1 + boost * w.hiddenAreaBonus
    }
  }

  // 날씨 가중치 — 비 오는 날 실내 카테고리 우선
  if (rainHint) {
    const mult = RAIN_MULT[rainHint][p.category]
    if (mult) score *= mult
  }

  // 거점 시군구 외부 — duration 별로 점수 곱 (당일치기 0.15, 1박2일 0.45, 2박3일 0.65)
  if (baseSigungus.length > 0 && p.sigunguCode && !baseSigungus.includes(p.sigunguCode)) {
    score *= durProfile.offBaseMult
  }

  // 거점 반경 초과 — 선형 감점. 반경의 2배 이상이면 거의 0(0.05 floor).
  const distKm = haversineKm(baseCenter, p.position)
  if (distKm > durProfile.radiusKm) {
    const over = distKm / durProfile.radiusKm
    score *= Math.max(0.05, 1 - (over - 1) * 0.6)
  }

  return score
}

function festivalOverlaps(f: Festival, range: DateRange): boolean {
  const start = isoToYmd(range.start)
  const end = isoToYmd(range.end)
  // ±7일 여유
  const startMinus = shiftYmd(start, -7)
  const endPlus = shiftYmd(end, 7)
  return !(f.eventEndDate < startMinus || f.eventStartDate > endPlus)
}

function shiftYmd(ymd: string, deltaDays: number): string {
  if (ymd.length !== 8) return ymd
  const d = new Date(
    Number(ymd.slice(0, 4)),
    Number(ymd.slice(4, 6)) - 1,
    Number(ymd.slice(6, 8)),
  )
  d.setDate(d.getDate() + deltaDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function buildQuotas(
  profile: CourseProfile,
  total: number,
  allowLodging: boolean,
): Record<CategoryId, number> {
  // FR-03 — 숙박 1 / 서원·사찰 1~2 / 전통체험 1~2 / 시장·향토 1 / 축제(선택).
  // allowLodging=false (당일치기) 면 hanok/templestay 는 0 으로 강제, 그 자리를 관람형으로 메꿈.
  const base: Record<CategoryId, number> = {
    hanok: allowLodging ? 1 : 0,
    templestay: 0,
    seowon: 1,
    temple: 1,
    experience: 1,
    market: 1,
    trail: 0,
    attraction: 0,
    festival: 0,
  }
  if (profile === 'temple_healing') {
    base.templestay = allowLodging ? 1 : 0
    base.hanok = 0
    base.temple = 2
  }
  if (profile === 'hanok_emotion') {
    base.hanok = allowLodging ? 1 : 0
    base.seowon = 2
    // 당일치기 한옥감성 → 한옥 못 가는 대신 attraction(한옥마을 등) 한 자리 추가
    if (!allowLodging) base.attraction = 1
  }
  if (profile === 'experience_focus') {
    base.experience = 2
  }
  if (profile === 'known_gb') {
    // 대표 코스 — 정석 관광지 자리 한 칸 추가
    base.attraction = Math.max(base.attraction, 1)
  }
  // 남는 자리는 attraction 으로 (한옥마을·관광지 류)
  const sum = Object.values(base).reduce((a, b) => a + b, 0)
  base.attraction = Math.max(base.attraction, total - sum)
  return base
}

/**
 * 멀티프로필 quota — 각 프로필별 quota 를 카테고리 max 로 합치고
 * total 슬롯을 넘으면 점수 적은 카테고리부터 깎아낸다.
 * 축제 슬롯은 hasFestivalLink 일 때만 1 부여.
 */
function buildQuotasMulti(
  profiles: CourseProfile[],
  total: number,
  allowLodging: boolean,
  hasFestivalLink: boolean,
): Record<CategoryId, number> {
  const merged: Record<CategoryId, number> = {
    hanok: 0, templestay: 0, seowon: 0, temple: 0, experience: 0,
    market: 0, trail: 0, attraction: 0, festival: 0,
  }
  for (const prof of profiles) {
    const q = buildQuotas(prof, total, allowLodging)
    for (const cat of Object.keys(merged) as CategoryId[]) {
      merged[cat] = Math.max(merged[cat], q[cat])
    }
  }
  // 축제 자리는 hasFestivalLink 일 때만 1 (엔진에서 따로 강제 push 함). quota 에 명시할 필요 없음.
  merged.festival = 0
  // 슬롯 캡 — total 을 넘으면 점진적으로 줄이기 (attraction 부터 깎고, 그래도 넘으면 trail/experience 순)
  let sum = Object.values(merged).reduce((a, b) => a + b, 0)
  const order: CategoryId[] = ['attraction', 'trail', 'experience', 'market', 'temple', 'seowon']
  let i = 0
  while (sum > total && i < order.length * 3) {
    const cat = order[i % order.length]
    if (merged[cat] > 0) {
      merged[cat] -= 1
      sum -= 1
    }
    i++
  }
  // 슬롯이 비어 있으면 attraction 으로 메꿈 (축제 자리는 엔진에서 별도 추가)
  const slotsForFest = hasFestivalLink ? 1 : 0
  if (sum + slotsForFest < total) {
    merged.attraction += total - sum - slotsForFest
  }
  return merged
}

/**
 * 동반자 시그니처 카테고리 quota 보장 — 선택된 동반자가 선호하는 카테고리에 슬롯이 0이면
 * 1을 부여하고 filler(attraction, 없으면 최다 카테고리)에서 1을 차감해 총합을 유지한다.
 * 점수 multiplier(COMPANION_MULT)만으로는 quota 에 막혀 못 들어오는 카테고리를 실제로 노출시킨다.
 */
const COMPANION_QUOTA: Partial<Record<Companion, CategoryId[]>> = {
  pet: ['trail'],
  solo: ['trail'],
  couple: ['trail'],
  kids: ['experience'],
  parents: ['market'],
}
function applyCompanionQuotas(quotas: Record<CategoryId, number>, companions: Companion[]): void {
  for (const comp of companions) {
    const cats = COMPANION_QUOTA[comp]
    if (!cats) continue
    for (const cat of cats) {
      if (quotas[cat] >= 1) continue
      const donor: CategoryId =
        quotas.attraction > 0
          ? 'attraction'
          : (Object.keys(quotas) as CategoryId[])
              .filter((c) => c !== cat)
              .sort((a, b) => quotas[b] - quotas[a])[0]
      if (donor && quotas[donor] > 0) {
        quotas[donor] -= 1
        quotas[cat] = 1
      }
    }
  }
}

/** 멀티프로필 가중치 머지 — 카테고리별 max. hiddenAreaBonus 도 max. */
function mergeWeights(profiles: CourseProfile[]): ProfileWeights {
  const cats: CategoryId[] = ['hanok', 'templestay', 'seowon', 'temple', 'experience', 'market', 'trail', 'attraction', 'festival']
  const result = { hiddenAreaBonus: 0 } as ProfileWeights
  for (const cat of cats) {
    let m = 0
    for (const prof of profiles) {
      const w = PROFILE_WEIGHTS[prof] as unknown as Record<CategoryId, number>
      if (w[cat] > m) m = w[cat]
    }
    ;(result as unknown as Record<CategoryId, number>)[cat] = m || 1.0
  }
  for (const prof of profiles) {
    const b = PROFILE_WEIGHTS[prof].hiddenAreaBonus
    if (b > result.hiddenAreaBonus) result.hiddenAreaBonus = b
  }
  return result
}

/**
 * 거점 시군구가 여러 개일 때 — 한 시군구 안 장소를 모두 돈 뒤 다른 시군구로 이동하도록
 * 클러스터 단위로 NN 정렬. 시군구간 점프를 줄여 일정이 자연스럽다.
 *
 * 절차:
 *  1) places 를 baseSigungus 의 cluster + "기타(없음)" 클러스터로 분리
 *  2) baseCenter 에서 가장 가까운 cluster 부터 시작
 *  3) 각 cluster 안에서는 NN 정렬, cluster 종료 위치에서 다음 cluster의 최근접으로 점프
 *  4) "기타" cluster 는 마지막에 (있다면)
 *
 * 거점이 1개거나 baseSigungus 가 비어있으면 기존 단순 NN 과 동일.
 */
function clusteredNearestNeighbor(
  places: Place[],
  origin: LatLng,
  baseSigungus: number[],
): Place[] {
  if (places.length === 0) return []
  if (baseSigungus.length <= 1) return nearestNeighborOrder(places, origin)

  // sigungu 별 그룹화
  const groups = new Map<number | 'other', Place[]>()
  for (const sg of baseSigungus) groups.set(sg, [])
  groups.set('other', [])
  for (const p of places) {
    const key =
      p.sigunguCode && baseSigungus.includes(p.sigunguCode) ? p.sigunguCode : 'other'
    groups.get(key)!.push(p)
  }

  // 비어 있는 그룹 제거하고, 거점→그룹 centroid 거리 순으로 클러스터 방문 순서 결정
  const clusters = [...groups.entries()]
    .filter(([, list]) => list.length > 0)
    .map(([key, list]) => ({
      key,
      list,
      center: centroid(list.map((p) => p.position)),
    }))

  // 'other' 는 끝으로 미루고, 나머지는 NN 으로 클러스터 순회
  const otherCluster = clusters.find((c) => c.key === 'other')
  const baseClusters = clusters.filter((c) => c.key !== 'other')

  const ordered: Place[] = []
  let cur = origin
  const remaining = [...baseClusters]
  while (remaining.length > 0) {
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(cur, remaining[i].center)
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    const cluster = remaining.splice(bestIdx, 1)[0]
    const inner = nearestNeighborOrder(cluster.list, cur)
    ordered.push(...inner)
    cur = inner.length > 0 ? inner[inner.length - 1].position : cluster.center
  }
  if (otherCluster) {
    const inner = nearestNeighborOrder(otherCluster.list, cur)
    ordered.push(...inner)
  }
  return ordered
}

/** 거점(origin)에서 출발하는 열린 경로의 총 직선 이동거리(km). */
function pathLength(order: Place[], origin: LatLng): number {
  let total = 0
  let prev = origin
  for (const p of order) {
    total += haversineKm(prev, p.position)
    prev = p.position
  }
  return total
}

/**
 * 2-opt 지역 최적화 — NN 으로 만든 방문 순서를 받아, 구간을 뒤집어 총 이동거리가 줄면 채택한다.
 * 거점에서 출발하는 열린 경로 기준(돌아오지 않음). 장소 수가 적어(4~8) 비용은 무시할 수준.
 * 거리 우선이라 NN 이 남긴 교차(꼬임) 동선을 펴 총 이동거리를 더 꼼꼼히 줄인다.
 */
function twoOptImprove(order: Place[], origin: LatLng): Place[] {
  if (order.length < 3) return order
  let best = [...order]
  let bestLen = pathLength(best, origin)
  let improved = true
  let guard = 0
  while (improved && guard < 60) {
    improved = false
    guard++
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).reverse(),
          ...best.slice(j + 1),
        ]
        const len = pathLength(candidate, origin)
        if (len + 1e-9 < bestLen) {
          best = candidate
          bestLen = len
          improved = true
        }
      }
    }
  }
  return best
}

function nearestNeighborOrder(places: Place[], origin: LatLng): Place[] {
  const remaining = [...places]
  const ordered: Place[] = []
  let cur = origin
  while (remaining.length > 0) {
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(cur, remaining[i].position)
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    const next = remaining.splice(bestIdx, 1)[0]
    ordered.push(next)
    cur = next.position
  }
  return ordered
}

function inferBaseCenter(baseSigungus: number[], candidates: Place[]): LatLng {
  if (baseSigungus.length > 0) {
    const matching = candidates.filter((c) => c.sigunguCode && baseSigungus.includes(c.sigunguCode))
    if (matching.length > 0) return centroid(matching.map((m) => m.position))
  }
  return centroid(candidates.map((c) => c.position))
}

function centroid(points: LatLng[]): LatLng {
  if (points.length === 0) return { lat: 36.5685, lng: 128.7282 }
  const lat = points.reduce((a, p) => a + p.lat, 0) / points.length
  const lng = points.reduce((a, p) => a + p.lng, 0) / points.length
  return { lat, lng }
}

function buildAutoTitle(baseSigungus: number[], profile: CourseProfile, lang: Lang): string {
  const names = baseSigungus
    .map((c) => findSigungu(c))
    .filter(Boolean)
    .map((s) => s![lang as 'ko' | 'en' | 'ja' | 'zh'])
  const head = names.length > 0 ? names.join(' · ') : (lang === 'ko' ? '경북' : 'Gyeongbuk')
  const tail: Record<CourseProfile, Record<Lang, string>> = {
    known_gb:         { ko: '대표 코스',       en: 'Signature',           ja: '定番コース',   zh: '经典路线' },
    hanok_emotion:    { ko: '한옥의 결',       en: 'Hanok Lines',         ja: '韓屋の趣',     zh: '韩屋纹理' },
    temple_healing:   { ko: '템플 힐링',       en: 'Temple Healing',      ja: 'テンプル癒し', zh: '寺院疗愈' },
    experience_focus: { ko: '전통체험',         en: 'Tradition',           ja: '伝統体験',     zh: '传统体验' },
    festival_link:    { ko: '축제 연계',        en: 'Festival',            ja: '祭り連携',     zh: '庆典' },
    hidden_gb:        { ko: '한적한 경북',      en: 'Quiet Gyeongbuk',     ja: '静かな慶北',   zh: '静谧庆北' },
  }
  return `${head} · ${tail[profile][lang]}`
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function emptyCourse(opts: GenerateOptions): Course {
  return {
    id: `course-${Date.now()}`,
    title: opts.title ?? '',
    baseSigungus: opts.baseSigungus,
    duration: opts.duration,
    dateRange: opts.dateRange,
    profile: opts.profile,
    hiddenMode: opts.hiddenMode ?? false,
    items: [],
    totalDistanceKm: 0,
    estimatedTravelMinutes: 0,
    createdAt: new Date().toISOString(),
    lang: opts.lang,
  }
}
