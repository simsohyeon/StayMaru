import { SIGUNGUS } from '@/constants/sigungu'
import { THEMES } from '@/constants/themes'
import type { CategoryId, CourseProfile, DateRange, TripDuration } from '@/types/domain'

export interface TripIntent {
  /** 추출된 시군구 코드 (최대 3개) */
  sigunguCodes?: number[]
  duration?: TripDuration
  /** custom duration 으로 빠진 경우 자동 계산된 오늘 기준 범위 (3박4일 이상 등) */
  dateRange?: DateRange
  profile?: CourseProfile
  /** 발견된 카테고리 id (보조) */
  category?: CategoryId
  /** 매칭된 테마 id */
  themeId?: string
  /** 사용자에게 피드백할 매칭 키워드 */
  matched: string[]
}

const DURATION_PATTERNS: Array<{ p: RegExp; v: TripDuration; label: string }> = [
  { p: /당일|하루|반나절|짧게/, v: 'day', label: '당일' },
  { p: /1박\s*2일|일박이일|1박2일|이틀|주말여행|주말/, v: '1n2d', label: '1박 2일' },
  { p: /2박\s*3일|이박삼일|2박3일|삼일/, v: '2n3d', label: '2박 3일' },
]

/** "N박 M일" — 일반 패턴. 3박 이상은 custom 으로 매핑하고 오늘 기준 range 계산. */
const GENERIC_NM_DAYS = /(\d{1,2})\s*박\s*(\d{1,2})\s*일/

function todayPlus(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const PROFILE_PATTERNS: Array<{ p: RegExp; v: CourseProfile; label: string }> = [
  { p: /한옥|고택|종택|선비/, v: 'hanok_emotion', label: '한옥 감성' },
  { p: /템플\s*스테이|템플스테이|산사|명상|힐링|불교|스님/, v: 'temple_healing', label: '템플/힐링' },
  { p: /체험|공방|만들|배우/, v: 'experience_focus', label: '전통체험' },
  { p: /축제|페스티벌|행사/, v: 'festival_link', label: '축제 연계' },
  { p: /숨겨진|숨은|덜.{0,3}알려|덜.{0,3}유명|구석|아는\s*사람만/, v: 'hidden_gb', label: '숨겨진 경북' },
]

const CATEGORY_PATTERNS: Array<{ p: RegExp; v: CategoryId; label: string }> = [
  { p: /한옥|고택|종택/, v: 'hanok', label: '한옥' },
  { p: /템플\s*스테이|템플스테이/, v: 'templestay', label: '템플스테이' },
  { p: /서원/, v: 'seowon', label: '서원' },
  { p: /사찰|산사|절\s/, v: 'temple', label: '사찰' },
  { p: /체험|공방/, v: 'experience', label: '체험' },
  { p: /시장|먹거리|미식|맛집|향토음식/, v: 'market', label: '시장·미식' },
  { p: /둘레길|옛길|선비길|걷기|트레킹|산책로/, v: 'trail', label: '둘레길' },
  { p: /축제|페스티벌/, v: 'festival', label: '축제' },
]

/** 자연어 입력에서 거점·기간·프로필 추출. 룰베이스(정규식), LLM 호출 없음. */
export function parseTripIntent(text: string): TripIntent {
  const t = text.trim()
  if (!t) return { matched: [] }

  const matched: string[] = []

  // 1) 시군구 — 풀네임(예: 안동시) 또는 단축형(예: 안동) 매칭
  const sigunguCodes: number[] = []
  for (const s of SIGUNGUS) {
    const full = s.ko
    const short = full.replace(/(시|군)$/, '')
    if (t.includes(full) || t.includes(short)) {
      sigunguCodes.push(s.code)
      matched.push(full)
      if (sigunguCodes.length >= 3) break
    }
  }

  // 2) 여행 기간 — 우선 명시 패턴 (당일·1박2일·2박3일) 시도
  let duration: TripDuration | undefined
  let dateRange: DateRange | undefined
  for (const { p, v, label } of DURATION_PATTERNS) {
    if (p.test(t)) {
      duration = v
      matched.push(label)
      break
    }
  }
  // 2-b) 명시 패턴이 못 잡았으면 일반 "N박 M일" 시도. 3박 이상은 custom + 자동 range.
  if (!duration) {
    const m = t.match(GENERIC_NM_DAYS)
    if (m) {
      const nights = Number(m[1])
      const totalDays = Math.max(nights + 1, Number(m[2]))
      if (nights === 0) {
        duration = 'day'
        matched.push('당일')
      } else if (nights === 1) {
        duration = '1n2d'
        matched.push('1박 2일')
      } else if (nights === 2) {
        duration = '2n3d'
        matched.push('2박 3일')
      } else {
        duration = 'custom'
        dateRange = { start: todayPlus(0), end: todayPlus(totalDays - 1) }
        matched.push(`${nights}박 ${totalDays}일`)
      }
    }
  }

  // 3) 프로필 (감성/유형)
  let profile: CourseProfile | undefined
  for (const { p, v, label } of PROFILE_PATTERNS) {
    if (p.test(t)) {
      profile = v
      matched.push(label)
      break
    }
  }

  // 4) 카테고리 보조 (Explore 진입 시 유용)
  let category: CategoryId | undefined
  for (const { p, v, label } of CATEGORY_PATTERNS) {
    if (p.test(t)) {
      category = v
      if (!matched.includes(label)) matched.push(label)
      break
    }
  }

  // 5) 테마 키워드 매칭 (단풍/벚꽃/야경/일출/단풍 등)
  let themeId: string | undefined
  for (const th of THEMES) {
    if (th.keyword && t.includes(th.keyword)) {
      themeId = th.id
      matched.push(th.label.ko)
      break
    }
    if (th.label.ko && t.includes(th.label.ko)) {
      themeId = th.id
      matched.push(th.label.ko)
      break
    }
  }

  return {
    sigunguCodes: sigunguCodes.length > 0 ? sigunguCodes : undefined,
    duration,
    dateRange,
    profile,
    category,
    themeId,
    matched,
  }
}
