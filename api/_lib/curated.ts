/**
 * 테마 코스(큐레이션) — 서버 검증과 DB 행 매핑.
 *
 * 두 소비자:
 *  - api/content.ts : 공개된 코스만 앱에 내려 준다 (인증 없음)
 *  - api/admin.ts   : 관리자 화면의 목록·저장·삭제 (세션 쿠키 필요)
 *
 * 들어오는 값은 전부 관리자 입력이라 형태를 신뢰하지 않는다 — 허용 목록에 없는 프로필·카테고리·
 * 시군 코드는 저장 단계에서 걸러야 앱이 렌더할 수 없는 데이터가 표에 남지 않는다.
 *
 * 스키마: supabase/migrations/20260920_curated_courses.sql
 * 기본값(표가 비었을 때 앱이 쓰는 6개): frontend/src/constants/curatedCourses.ts
 */
import type { CategoryId, CourseProfile, Lang, TripDuration } from '../../frontend/src/types/domain.js'
import { GB_SIGUNGU_CODES, pgrest, type Db } from './places-db.js'

export const LANGS = ['ko', 'en', 'ja', 'zh'] as const

// 아래 세 목록은 frontend/src/types/domain.ts 의 유니온과 같은 값이다.
// (api/ 는 카테고리 상수 모듈을 못 쓴다 — 그쪽은 React 아이콘을 함께 들고 있다.)
const PROFILES = new Set(['known_gb', 'hanok_emotion', 'temple_healing', 'experience_focus', 'festival_link', 'hidden_gb'])
const DURATIONS = new Set(['day', '1n2d', '2n3d', 'custom'])
const CATEGORY_IDS = new Set([
  'hanok', 'templestay', 'seowon', 'temple', 'experience',
  'market', 'restaurant', 'trail', 'attraction', 'festival',
])

const ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/
const ACCENT_RE = /^#[0-9a-fA-F]{6}$/
/** TourAPI contentid — 숫자 문자열. 고정 장소는 이 값으로 지목한다. */
const CONTENT_ID_RE = /^[0-9]{1,12}$/
const TITLE_MAX = 80
const DESC_MAX = 240
const IMAGE_MAX = 500
/** 한 코스에 고정할 수 있는 장소 수 — 당일 코스의 방문지 수를 넘기지 않게. */
const MAX_PLACES = 10
/** 한 번에 저장할 수 있는 코스 수 — 화면에 실제로 거는 개수보다 넉넉하되 무한하지 않게. */
export const MAX_ITEMS = 50

export interface CuratedText {
  title: string
  desc: string
}

/** 코스에 반드시 넣을 장소. title 은 관리자 화면 표시용 사본이고, 실제 조회는 id(contentid)로 한다. */
export interface CuratedPlace {
  id: string
  title: string
}

export interface CuratedCourse {
  id: string
  sort: number
  published: boolean
  sigunguCodes: number[]
  profile: CourseProfile
  duration: TripDuration
  themes: CategoryId[]
  accent: string
  /** 카드 배경 사진 URL. 비면 수상작 사진을 거점 시군으로 자동 매칭한다. */
  image: string
  /** 고정 장소. 비면 엔진이 알아서 고른다. */
  places: CuratedPlace[]
  i18n: Record<Lang, CuratedText>
}

interface Row {
  id: string
  sort_order: number
  published: boolean
  sigungu_codes: number[]
  profile: string
  duration: string
  themes: string[]
  accent: string
  image: string | null
  places: CuratedPlace[] | null
  i18n: Record<string, CuratedText>
}

/* ── 검증 ─────────────────────────────────────────────────────────── */

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function fail(id: string, reason: string) {
  return { ok: false as const, error: id ? `${id}: ${reason}` : reason }
}

/**
 * 관리자 입력 한 건을 저장 가능한 형태로 정규화한다.
 * 한국어 제목은 필수, 나머지 언어는 비면 한국어를 그대로 쓴다 —
 * 번역이 아직 없다고 해서 다른 언어 화면이 빈칸으로 나가면 안 된다.
 */
export function parseCourse(input: unknown, fallbackSort = 0): { ok: true; value: CuratedCourse } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return fail('', 'not an object')
  const o = input as Record<string, unknown>
  const id = str(o.id)
  if (!ID_RE.test(id)) return fail(id || '(no id)', 'id must be 2-64 chars of a-z, 0-9, -')

  const codes = Array.isArray(o.sigunguCodes) ? o.sigunguCodes.map(Number) : []
  if (codes.length < 1 || codes.length > 3) return fail(id, 'sigunguCodes must hold 1-3 codes')
  if (!codes.every((c) => GB_SIGUNGU_CODES.includes(c))) return fail(id, 'sigunguCodes must be Gyeongbuk codes')

  const profile = str(o.profile)
  if (!PROFILES.has(profile)) return fail(id, `unknown profile ${profile}`)
  const duration = str(o.duration)
  if (!DURATIONS.has(duration)) return fail(id, `unknown duration ${duration}`)

  const themesIn = Array.isArray(o.themes) ? o.themes.map(str) : []
  if (themesIn.length > 6) return fail(id, 'themes must hold at most 6')
  if (!themesIn.every((c) => CATEGORY_IDS.has(c))) return fail(id, 'themes must be category ids')

  const accent = str(o.accent) || '#8B4513'
  if (!ACCENT_RE.test(accent)) return fail(id, 'accent must be #rrggbb')

  // 사진은 https 만 — http 이미지는 배포(https) 화면에서 혼합 콘텐츠로 차단된다.
  const image = str(o.image)
  if (image && !/^https:\/\//i.test(image)) return fail(id, 'image must be an https URL')
  if (image.length > IMAGE_MAX) return fail(id, `image is longer than ${IMAGE_MAX}`)

  const placesIn = Array.isArray(o.places) ? o.places : []
  if (placesIn.length > MAX_PLACES) return fail(id, `places must hold at most ${MAX_PLACES}`)
  const places: CuratedPlace[] = []
  const seenPlace = new Set<string>()
  for (const raw of placesIn) {
    const p = (raw ?? {}) as Record<string, unknown>
    const pid = str(p.id)
    if (!CONTENT_ID_RE.test(pid)) return fail(id, `place id ${pid || '(empty)'} is not a contentid`)
    if (seenPlace.has(pid)) continue
    seenPlace.add(pid)
    places.push({ id: pid, title: str(p.title).slice(0, TITLE_MAX) })
  }

  const i18nIn = (o.i18n ?? {}) as Record<string, unknown>
  const ko = i18nIn.ko as Record<string, unknown> | undefined
  const koTitle = str(ko?.title)
  if (!koTitle) return fail(id, 'Korean title is required')
  const koDesc = str(ko?.desc)
  const i18n = {} as Record<Lang, CuratedText>
  for (const lang of LANGS) {
    const t = i18nIn[lang] as Record<string, unknown> | undefined
    const title = str(t?.title) || koTitle
    const desc = str(t?.desc) || koDesc
    if (title.length > TITLE_MAX) return fail(id, `${lang} title is longer than ${TITLE_MAX}`)
    if (desc.length > DESC_MAX) return fail(id, `${lang} desc is longer than ${DESC_MAX}`)
    i18n[lang] = { title, desc }
  }

  const sortRaw = Number(o.sort)
  return {
    ok: true,
    value: {
      id,
      sort: Number.isFinite(sortRaw) ? Math.trunc(sortRaw) : fallbackSort,
      published: o.published !== false,
      sigunguCodes: codes,
      profile: profile as CourseProfile,
      duration: duration as TripDuration,
      themes: themesIn as CategoryId[],
      accent,
      image,
      places,
      i18n,
    },
  }
}

/** 목록 전체 검증 — 한 건이라도 어긋나면 저장하지 않고 사유를 돌려준다. */
export function parseCourses(input: unknown): { ok: true; value: CuratedCourse[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return fail('', 'items must be an array')
  if (input.length > MAX_ITEMS) return fail('', `items must hold at most ${MAX_ITEMS}`)
  const out: CuratedCourse[] = []
  const seen = new Set<string>()
  for (let i = 0; i < input.length; i++) {
    const parsed = parseCourse(input[i], i)
    if (!parsed.ok) return parsed
    if (seen.has(parsed.value.id)) return fail(parsed.value.id, 'duplicate id')
    seen.add(parsed.value.id)
    out.push(parsed.value)
  }
  return { ok: true, value: out }
}

/* ── 행 매핑 ──────────────────────────────────────────────────────── */

function toCourse(r: Row): CuratedCourse {
  const i18n = {} as Record<Lang, CuratedText>
  for (const lang of LANGS) {
    const t = r.i18n?.[lang]
    i18n[lang] = { title: str(t?.title), desc: str(t?.desc) }
  }
  return {
    id: r.id,
    sort: r.sort_order ?? 0,
    published: r.published !== false,
    sigunguCodes: Array.isArray(r.sigungu_codes) ? r.sigungu_codes : [],
    profile: r.profile as CourseProfile,
    duration: r.duration as TripDuration,
    themes: (Array.isArray(r.themes) ? r.themes : []) as CategoryId[],
    accent: r.accent,
    image: str(r.image),
    places: (Array.isArray(r.places) ? r.places : []).map((p) => ({ id: str(p?.id), title: str(p?.title) })).filter((p) => p.id),
    i18n,
  }
}

function toRow(c: CuratedCourse): Row & { updated_at: string } {
  return {
    id: c.id,
    sort_order: c.sort,
    published: c.published,
    sigungu_codes: c.sigunguCodes,
    profile: c.profile,
    duration: c.duration,
    themes: c.themes,
    accent: c.accent,
    image: c.image || null,
    places: c.places,
    i18n: c.i18n,
    updated_at: new Date().toISOString(),
  }
}

/* ── DB ───────────────────────────────────────────────────────────── */

const SELECT = 'id,sort_order,published,sigungu_codes,profile,duration,themes,accent,image,places,i18n'

export async function listCurated(db: Db, publishedOnly: boolean): Promise<CuratedCourse[]> {
  const filter = publishedOnly ? 'published=is.true&' : ''
  const res = await pgrest(db, 'GET', `curated_courses?${filter}select=${SELECT}&order=sort_order.asc,id.asc&limit=${MAX_ITEMS}`)
  const rows = (await res.json()) as Row[]
  return Array.isArray(rows) ? rows.map(toCourse) : []
}

export async function upsertCurated(db: Db, items: CuratedCourse[]): Promise<void> {
  if (items.length === 0) return
  await pgrest(db, 'POST', 'curated_courses?on_conflict=id', {
    body: items.map(toRow),
    prefer: 'resolution=merge-duplicates,return=minimal',
  })
}

export async function deleteCurated(db: Db, id: string): Promise<void> {
  await pgrest(db, 'DELETE', `curated_courses?id=eq.${encodeURIComponent(id)}`, { prefer: 'return=minimal' })
}
