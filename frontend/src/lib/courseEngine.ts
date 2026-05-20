import { PROFILE_WEIGHTS, type ProfileWeights } from '@/constants/categories'
import { findSigungu } from '@/constants/sigungu'
import { isoToYmd } from '@/api/tour'
import { estimateMinutes, haversineKm } from '@/lib/geo'
import type {
  CategoryId,
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
  profile?: CourseProfile
  hiddenMode: boolean
  /** 찜한 장소들 — 가중치 부여 (FR-17) */
  favorites?: Place[]
  lang: Lang
  title?: string
}

const DEFAULT_PROFILE: CourseProfile = 'hanok_emotion'

const TARGET_COUNT: Record<TripDuration, number> = {
  day: 4,
  '1n2d': 6,
  '2n3d': 8,
  custom: 6,
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
    profile = DEFAULT_PROFILE,
    hiddenMode,
    favorites = [],
    lang,
    title,
  } = opts

  if (candidates.length === 0) {
    return emptyCourse(opts)
  }

  const weights = PROFILE_WEIGHTS[profile]
  const baseCenter = opts.baseCenter ?? inferBaseCenter(baseSigungus, candidates)
  const favoriteIds = new Set(favorites.map((f) => f.id))

  // FR-16 — 여행 기간에 겹치는 축제만 후보로
  const matchingFestivals = dateRange
    ? festivals.filter((f) => festivalOverlaps(f, dateRange))
    : festivals.filter((f) => f.eventStartDate && f.eventEndDate)

  // 1) 점수화
  const scored = candidates.map((p) => ({
    place: p,
    score: scoreOf(p, weights, hiddenMode, favoriteIds, baseCenter, baseSigungus),
  }))
  scored.sort((a, b) => b.score - a.score)

  // 2) 카테고리 다양성 — 슬롯 채우기
  const desired = TARGET_COUNT[duration]
  const quotas = buildQuotas(profile, desired)
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

  // 축제 — 매칭되는 게 있으면 1개 강제 포함 (FR-16, FR-24)
  if (matchingFestivals.length > 0 && !picked.some((p) => p.category === 'festival')) {
    const fest = matchingFestivals[0]
    picked.push(fest)
    usedIds.add(fest.id)
  }

  // 3) NN 정렬 — 숙박을 기점으로
  const ordered = nearestNeighborOrder(picked, baseCenter)

  // 4) 거리 계산
  const items: CourseItem[] = ordered.map((p, i) => {
    const prev = i === 0 ? baseCenter : ordered[i - 1].position
    const d = haversineKm(prev, p.position)
    return { place: p, order: i + 1, distanceFromPrevKm: round1(d) }
  })
  const totalKm = round1(items.reduce((a, it) => a + it.distanceFromPrevKm, 0))

  return {
    id: `course-${Date.now()}`,
    title: title ?? buildAutoTitle(baseSigungus, profile, lang),
    baseSigungus,
    duration,
    dateRange,
    profile,
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
  const start = baseCenter ?? c.items[0].place.position
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
): number {
  const catWeight = (w as unknown as Record<CategoryId, number>)[p.category] ?? 1.0
  let score = catWeight

  // 찜 가중치 (FR-17)
  if (favIds.has(p.id)) score *= 2.5

  // FR-04 — 숨겨진 경북 모드: sigungu hiddenBoost 사용
  if (hiddenMode || w.hiddenAreaBonus > 1) {
    const sg = p.sigunguCode ? findSigungu(p.sigunguCode) : undefined
    if (sg) score *= 1 + sg.hiddenBoost * w.hiddenAreaBonus
  }

  // 거점 근접 보너스 — 너무 멀면 감점
  if (baseSigungus.length > 0 && p.sigunguCode && !baseSigungus.includes(p.sigunguCode)) {
    score *= 0.7
  }
  const distKm = haversineKm(baseCenter, p.position)
  if (distKm > 60) score *= 0.8
  if (distKm > 100) score *= 0.6

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

function buildQuotas(profile: CourseProfile, total: number): Record<CategoryId, number> {
  // FR-03 — 숙박 1 / 서원·사찰 1~2 / 전통체험 1~2 / 시장·향토 1 / 축제(선택)
  const base: Record<CategoryId, number> = {
    hanok: 1,
    templestay: 0,
    seowon: 1,
    temple: 1,
    experience: 1,
    market: 1,
    attraction: 0,
    festival: 0,
  }
  if (profile === 'temple_healing') {
    base.templestay = 1
    base.hanok = 0
    base.temple = 2
  }
  if (profile === 'hanok_emotion') {
    base.hanok = 1
    base.seowon = 2
  }
  if (profile === 'experience_focus') {
    base.experience = 2
  }
  // 남는 자리는 attraction 으로
  let sum = Object.values(base).reduce((a, b) => a + b, 0)
  base.attraction = Math.max(0, total - sum)
  return base
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
    hanok_emotion:    { ko: '한옥의 결',       en: 'Hanok Lines',         ja: '韓屋の趣',     zh: '韩屋纹理' },
    temple_healing:   { ko: '템플 힐링',       en: 'Temple Healing',      ja: 'テンプル癒し', zh: '寺院疗愈' },
    experience_focus: { ko: '전통체험',         en: 'Tradition',           ja: '伝統体験',     zh: '传统体验' },
    festival_link:    { ko: '축제 연계',        en: 'Festival',            ja: '祭り連携',     zh: '庆典' },
    hidden_gb:        { ko: '숨겨진 경북',      en: 'Hidden Gyeongbuk',    ja: '隠れた慶北',   zh: '隐藏庆北' },
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
    hiddenMode: opts.hiddenMode,
    items: [],
    totalDistanceKm: 0,
    estimatedTravelMinutes: 0,
    createdAt: new Date().toISOString(),
    lang: opts.lang,
  }
}
