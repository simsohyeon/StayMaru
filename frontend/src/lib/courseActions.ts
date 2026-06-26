import type { Course, CourseItem, Place } from '@/types/domain'
import { useCourses } from '@/stores/courses'
import { useCollab } from '@/stores/collab'
import { recomputeCourse } from '@/lib/courseEngine'

/**
 * 탐색·장소상세 등 어디서든 "현재 코스에 장소 담기".
 * - 현재 코스가 있으면 거기에 추가(중복이면 무시) → 거리 재계산 + 저장 + 협업 반영(방이면 publish).
 * - 현재 코스가 없으면 이 장소로 새 코스를 시작한다.
 * 동선 직접 편집/협업을 강화하는 진입점(찜 목록에만 의존하던 한계 해소).
 */
export type AddToCourseResult = 'added' | 'duplicate' | 'created'

export function addPlaceToCourse(place: Place): AddToCourseResult {
  const courses = useCourses.getState()
  const collab = useCollab.getState()
  const cur = courses.current

  if (cur) {
    if (cur.items.some((it) => it.place.id === place.id)) return 'duplicate'
    const item: CourseItem = {
      place,
      order: cur.items.length + 1,
      distanceFromPrevKm: 0,
      addedBy: collab.me.id,
    }
    const updated = recomputeCourse({ ...cur, items: [...cur.items, item] })
    courses.setCurrent(updated)
    courses.save(updated)
    collab.publish(updated) // 협업 방이면 실시간 반영, 아니면 no-op
    return 'added'
  }

  // 현재 코스 없음 — 이 장소로 새 코스 시작
  const course: Course = {
    id: `course-${Date.now()}`,
    title: place.name,
    baseSigungus: place.sigunguCode ? [place.sigunguCode] : [],
    duration: '1n2d',
    hiddenMode: false,
    items: [{ place, order: 1, distanceFromPrevKm: 0, addedBy: collab.me.id }],
    totalDistanceKm: 0,
    estimatedTravelMinutes: 0,
    createdAt: new Date().toISOString(),
    lang: place.lang ?? 'ko',
  }
  courses.setCurrent(course)
  courses.save(course)
  return 'created'
}
