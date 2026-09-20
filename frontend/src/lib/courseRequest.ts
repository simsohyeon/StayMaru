import type { Companion, Course, CourseProfile, DateRange, Lang, Place, TripDuration } from '../types/domain'
import type { RainHint } from './rainHint'

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
