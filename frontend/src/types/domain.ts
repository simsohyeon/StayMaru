// 도메인 타입 정의
// 주의: 필드명은 추후 DB 컬럼과 1:1 매핑되도록 snake/camel 혼용을 피하고 camelCase로 통일.

export type Lang = 'ko' | 'en' | 'ja' | 'zh'

export type CategoryId =
  | 'hanok' // 한옥/고택
  | 'templestay' // 템플스테이
  | 'seowon' // 서원
  | 'temple' // 사찰
  | 'experience' // 전통체험
  | 'market' // 전통시장/향토음식
  | 'attraction' // 관광지 일반
  | 'festival' // 축제

export type CourseProfile =
  | 'hanok_emotion' // 한옥 감성
  | 'temple_healing' // 템플스테이 힐링
  | 'experience_focus' // 전통체험 중심
  | 'festival_link' // 축제 연계
  | 'hidden_gb' // 숨겨진 경북

export type TripDuration = 'day' | '1n2d' | '2n3d' | 'custom'

export interface DateRange {
  /** ISO date (YYYY-MM-DD) */
  start: string
  /** ISO date (YYYY-MM-DD) */
  end: string
}

export interface LatLng {
  lat: number
  lng: number
}

/** 관광공사 API contentTypeId 매핑 표.
 *  - 12 관광지 / 14 문화시설 / 15 행사·축제 / 25 여행코스
 *  - 28 레포츠 / 32 숙박 / 38 쇼핑 / 39 음식점
 *  카테고리 → contentTypeId 는 단일이 아닐 수 있어 검색 시에는 키워드 조합을 함께 사용한다. */
export interface Place {
  id: string // contentId
  contentTypeId: number
  category: CategoryId
  name: string
  address: string
  /** 시군구 코드(경북 sigunguCode) */
  sigunguCode?: number
  thumbnail?: string
  position: LatLng
  /** 소개 글 */
  overview?: string
  tel?: string
  homepage?: string
  /** detailImage2 로 받아온 추가 이미지 (originimgurl 들). 첫 항목이 hero 폴백. */
  images?: string[]
  /** 외부 예약/문의 링크 (템플스테이·한옥·음식점 예약 URL 또는 예약 안내 텍스트) */
  bookingUrl?: string
  /** 예약 안내 텍스트 (URL 없을 때) — 예: "전화 예약 가능", "현장 접수만" */
  bookingInfo?: string
  /** 운영 시간 (detailCommon2 usetime / detailIntro2 의 opentimefood 등) */
  openHours?: string
  /** 휴무일 */
  restDate?: string
  /** 안내 센터 / 문의 전화 (관광지의 infocenter, 축제의 sponsor1tel 등) */
  infoCenter?: string
  /** 주차 안내 */
  parking?: string
  /** 입장료 / 이용 요금 */
  useFee?: string
  /** 행사 주최/주관 (축제 전용) */
  sponsor?: string
  /** 키워드 태그 — 경북 특화 검색 가중치 계산에 사용 */
  tags?: string[]
  /** 응답 언어 */
  lang?: Lang
}

export interface Festival extends Place {
  category: 'festival'
  /** YYYYMMDD */
  eventStartDate: string
  /** YYYYMMDD */
  eventEndDate: string
}

export interface CourseItem {
  place: Place
  /** 방문 순서(1-based) */
  order: number
  /** 직전 장소로부터의 직선 거리(km). 첫 장소는 0 */
  distanceFromPrevKm: number
}

export interface Course {
  id: string
  title: string
  /** 사용자가 선택한 거점 sigunguCode 목록 */
  baseSigungus: number[]
  duration: TripDuration
  dateRange?: DateRange
  profile?: CourseProfile
  /** 숨겨진 경북 모드 여부 */
  hiddenMode: boolean
  items: CourseItem[]
  totalDistanceKm: number
  /** 직선 거리 기준 추정 이동 시간(분). 60km/h 평균 가정 */
  estimatedTravelMinutes: number
  createdAt: string // ISO
  /** 응답 언어 */
  lang: Lang
}

/** 경북 시군구 (관광공사 sigunguCode — areaCode=35) */
export interface Sigungu {
  code: number
  /** 영문 슬러그 */
  slug: string
  ko: string
  en: string
  ja: string
  zh: string
  /** '숨겨진 경북' 가중치 (관광지 수 하위일수록 큼) */
  hiddenBoost: number
}
