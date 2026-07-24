import type { Course, CourseItem, DateRange, TripDuration } from '@/types/domain'

/**
 * 코스 → 날짜별 일정표 분할.
 *
 * 규칙:
 *  1) 일수 = 당일 1 / 1박2일 2 / 2박3일 3 / custom 은 dateRange 박수+1 (1~4로 클램프).
 *  2) 숙박 카테고리(hanok/templestay)는 그 날의 마지막 일정 — 숙박을 만나면 하루를 닫는다.
 *  3) 숙박 앵커가 없으면 장소 수를 일수로 균등 분할(앞쪽부터 ceil).
 *  4) 남은 날마다 최소 1곳은 보장 — 마지막 날이 비지 않도록 분할을 미룬다.
 *
 * 표시 전용 분할이며 코스 데이터 자체(순서/거리)는 건드리지 않는다.
 * 뒤 날짜 첫 장소의 distanceFromPrevKm 은 "전날 마지막 → 오늘 첫" 이동으로 그 날 소계에 포함.
 */
export interface DayPlan {
  /** 1-based 일차 */
  day: number
  items: CourseItem[]
  /** 이 날의 이동 거리 소계(km, 반올림 1자리) */
  distanceKm: number
}

const LODGING = new Set(['hanok', 'templestay'])

/** 여행 일수. custom 은 dateRange 로 계산, 없으면 2일 폴백. */
export function daysOf(duration: TripDuration, dateRange?: DateRange): number {
  switch (duration) {
    case 'day':
      return 1
    case '1n2d':
      return 2
    case '2n3d':
      return 3
    case 'custom': {
      if (!dateRange) return 2
      const ms = Date.parse(dateRange.end) - Date.parse(dateRange.start)
      if (Number.isNaN(ms)) return 2
      const nights = Math.max(0, Math.round(ms / 86_400_000))
      return Math.min(4, Math.max(1, nights + 1))
    }
  }
}

export function splitIntoDays(course: Course): DayPlan[] {
  const items = course.items
  const totalDays = Math.min(daysOf(course.duration, course.dateRange), Math.max(1, items.length))
  if (items.length === 0) return []
  if (totalDays <= 1) {
    return [{ day: 1, items: [...items], distanceKm: sumKm(items) }]
  }

  const plans: DayPlan[] = []
  let cur: CourseItem[] = []
  let startIdx = 0 // 현재 날의 첫 item 인덱스 — quota 계산 기준

  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    cur.push(it)

    const dayNo = plans.length + 1
    const isLastDay = dayNo === totalDays
    if (isLastDay) continue // 마지막 날 — 남은 전부

    const remainingAfter = items.length - (i + 1)
    const remainingDays = totalDays - dayNo // 오늘을 닫은 뒤 남는 날 수
    if (remainingAfter < remainingDays) continue // 남은 날 최소 1곳 보장 불가 → 더 담는다

    // 오늘 시작 시점 기준 균등 quota (숙박 없을 때의 기본 분할선)
    const quota = Math.ceil((items.length - startIdx) / (totalDays - dayNo + 1))
    const lodgingHere = LODGING.has(it.place.category)

    if (lodgingHere || cur.length >= quota) {
      plans.push({ day: dayNo, items: cur, distanceKm: sumKm(cur) })
      cur = []
      startIdx = i + 1
    }
  }
  if (cur.length > 0) {
    plans.push({ day: plans.length + 1, items: cur, distanceKm: sumKm(cur) })
  }
  return plans
}

function sumKm(items: CourseItem[]): number {
  return Math.round(items.reduce((a, it) => a + it.distanceFromPrevKm, 0) * 10) / 10
}
