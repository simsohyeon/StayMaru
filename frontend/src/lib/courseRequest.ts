import type { Companion, Course, CourseProfile, DateRange, Lang, Place, TripDuration } from '../types/domain.js'
import type { RainHint } from './rainHint.js'

/**
 * 서버 코스 생성(POST /api/course) 요청·응답 계약 — 클라이언트(api/course.ts)와 서버(api/course.ts)가 공유.
 * Home 의 GenInput 과 같은 입력에 lang·favorites 를 더한 것. 후보 장소·축제·날씨는 서버가 모은다.
 */
export interface CourseRequest {
  sigunguCodes: number[]
  profiles: CourseProfile[]
  companions?: Companion[]
  duration: TripDuration
  dateRange?: DateRange
  lang: Lang
  /** 찜한 장소 — 점수 가중(×2.5). 클라이언트 상태라 요청에 실어 보낸다. */
  favorites?: Place[]
  /**
   * 반드시 넣을 장소의 contentid — 운영자가 테마 코스에 고정해 둔 곳.
   * 장소 자체가 아니라 id 만 보낸다: 서버는 이미 그 시군의 후보를 들고 있고,
   * 클라이언트가 보낸 장소 정보를 그대로 믿을 이유도 없다.
   */
  pinnedIds?: string[]
}

export interface CourseResponse {
  course: Course
  /** 디버깅·출처 표기용 */
  meta: {
    candidates: number
    festivals: number
    rainHint?: RainHint
    elapsedMs: number
  }
}

export const VALID_PROFILES: readonly CourseProfile[] = [
  'known_gb', 'hanok_emotion', 'temple_healing', 'experience_focus', 'festival_link', 'hidden_gb',
]
export const VALID_COMPANIONS: readonly Companion[] = ['solo', 'friends', 'couple', 'kids', 'parents', 'pet', 'accessible']
export const VALID_DURATIONS: readonly TripDuration[] = ['day', '1n2d', '2n3d', 'custom']
export const VALID_LANGS: readonly Lang[] = ['ko', 'en', 'ja', 'zh']
