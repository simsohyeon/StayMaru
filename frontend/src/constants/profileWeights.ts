import type { CourseProfile } from '../types/domain'

/**
 * FR-21 코스 유형별 카테고리 가중치 프로파일 — 코스 생성 엔진이 후보 장소 점수에 곱하는 multiplier.
 *
 * categories.ts 에서 분리한 이유: 코스 엔진(lib/courseEngine.ts)을 서버(api/course.ts)에서도 실행하는데,
 * categories.ts 는 아이콘 컴포넌트(React)를 끌고 와 서버 번들에 실을 수 없다. 이 파일은 순수 데이터만 둔다.
 * 기존 import 경로(@/constants/categories) 는 re-export 로 그대로 동작한다.
 * (상대 경로 import 인 것도 같은 이유 — 서버 번들러는 `@/` 별칭을 모른다.)
 */
export interface ProfileWeights {
  hanok: number
  templestay: number
  seowon: number
  temple: number
  experience: number
  market: number
  restaurant: number
  trail: number
  attraction: number
  festival: number
  hiddenAreaBonus: number
}

export const PROFILE_WEIGHTS: Record<CourseProfile, ProfileWeights> = {
  known_gb: {
    // 대표 코스 — 유명 지역·관광지·시장 위주, hiddenBoost 없음
    hanok: 1.2, templestay: 0.8, seowon: 1.1, temple: 1.0,
    experience: 1.0, market: 1.2, restaurant: 1.2, trail: 0.9, attraction: 1.4, festival: 0.8,
    hiddenAreaBonus: 0,
  },
  hanok_emotion: {
    hanok: 2.0, templestay: 0.7, seowon: 1.3, temple: 0.8,
    experience: 1.0, market: 1.0, restaurant: 0.9, trail: 1.1, attraction: 0.8, festival: 0.6,
    hiddenAreaBonus: 0.2,
  },
  temple_healing: {
    hanok: 0.7, templestay: 2.0, seowon: 0.9, temple: 1.8,
    experience: 0.9, market: 0.7, restaurant: 0.7, trail: 1.4, attraction: 0.7, festival: 0.5,
    hiddenAreaBonus: 0.4,
  },
  experience_focus: {
    hanok: 1.0, templestay: 0.8, seowon: 1.1, temple: 1.0,
    experience: 2.0, market: 1.2, restaurant: 1.1, trail: 1.1, attraction: 0.8, festival: 0.9,
    hiddenAreaBonus: 0.3,
  },
  festival_link: {
    hanok: 1.0, templestay: 0.8, seowon: 0.9, temple: 0.8,
    experience: 1.0, market: 1.1, restaurant: 1.1, trail: 0.8, attraction: 1.0, festival: 2.2,
    hiddenAreaBonus: 0.2,
  },
  hidden_gb: {
    hanok: 1.0, templestay: 1.0, seowon: 1.0, temple: 1.0,
    experience: 1.1, market: 1.1, restaurant: 0.9, trail: 1.5, attraction: 0.9, festival: 0.9,
    hiddenAreaBonus: 1.5,
  },
}
