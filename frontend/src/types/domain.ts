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
  | 'restaurant' // 맛집/음식점
  | 'trail' // 둘레길·옛길
  | 'attraction' // 관광지 일반
  | 'festival' // 축제

export type CourseProfile =
  | 'known_gb' // 대표 코스 (유명·정석)
  | 'hanok_emotion' // 한옥 감성
  | 'temple_healing' // 템플스테이 힐링
  | 'experience_focus' // 전통체험 중심
  | 'festival_link' // 축제 연계
  | 'hidden_gb' // 한적한 경북

export type TripDuration = 'day' | '1n2d' | '2n3d' | 'custom'

/** 동반자 — 코스 카테고리 가중치 조정에 사용. 'accessible' 은 무장애여행(휠체어·보조견 등). */
export type Companion =
  | 'solo' // 혼자
  | 'friends' // 친구
  | 'couple' // 연인
  | 'kids' // 아이
  | 'parents' // 부모님
  | 'pet' // 반려동물
  | 'accessible' // 무장애 여행

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
  /** 접근성 정보 — 무장애여행 필터에 사용.
   *  - chk* 필드: 일반 detailIntro2 의 Y/N 체크박스 (보조 정보)
   *  - tour: KorWithService2/detailWithTour2 의 자유 텍스트 22개 필드 (정식 무장애 정보) */
  accessibility?: {
    wheelchair?: boolean
    babyStroller?: boolean
    pet?: boolean
    creditCard?: boolean
    /** 한국관광공사 무장애여행정보 — 자유 텍스트, 미등록 시 부재 */
    tour?: AccessibilityTour
  }
  /** 키워드 태그 — 경북 특화 검색 가중치 계산에 사용 */
  tags?: string[]
  /** 응답 언어 */
  lang?: Lang
}

/** KorWithService2/detailWithTour2 응답 필드 — 자유 텍스트 (한국어). 모두 옵셔널. */
export interface AccessibilityTour {
  /** 장애인 주차 */
  parking?: string
  /** 휠체어 이동 경로 */
  route?: string
  /** 대중교통 접근 */
  publictransport?: string
  /** 매표소 접근 */
  ticketoffice?: string
  /** 홍보물 (점자/큰글자 안내자료) */
  promotion?: string
  /** 출입구 */
  exit?: string
  /** 엘리베이터 */
  elevator?: string
  /** 장애인 화장실 */
  restroom?: string
  /** 인적 안내 도우미 */
  guidehuman?: string
  /** 안내 시스템 (앱·키오스크) */
  guidesystem?: string
  /** 시각 장애인용 안내 */
  blindhandicapetc?: string
  /** 지체 장애인용 안내 */
  handicapetc?: string
  /** 음성 안내 */
  audioguide?: string
  /** 영상 안내 */
  videoguide?: string
  /** 점자 블록 */
  braileblock?: string
  /** 보조견 동반 */
  helpdog?: string
  /** 유모차/휠체어 대여 */
  stroller?: string
  /** 수유실 */
  lactationroom?: string
  /** 수어 안내 */
  signguide?: string
  /** 수어 영상 */
  videosignlanguage?: string
  /** 청각 장애인용 안내 */
  hearinghandicapetc?: string
  /** 큰 글자 안내 */
  bigprint?: string
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
  /** 직전 장소로부터의 직선 거리(km). 첫 장소는 거점(baseCenter)으로부터의 거리 */
  distanceFromPrevKm: number
  /** 협업 — 이 장소를 추가한 기여자 id(CollabContributor.id). 여행 릴레이 태그에 사용. */
  addedBy?: string
  /** 협업 — 이 장소에 하트를 누른 기여자 id 목록. 투표/하트 합산에 사용. */
  votes?: string[]
}

/**
 * 협업 기여자 — 로그인 없이 기기별로 생성되는 익명 정체성.
 * id 는 영구 랜덤(localStorage), name 은 사용자 지정 닉네임, color 는 태그/아바타 색.
 */
export interface CollabContributor {
  id: string
  name: string
  color: string
}

export interface Course {
  id: string
  title: string
  /** 사용자가 선택한 거점 sigunguCode 목록 */
  baseSigungus: number[]
  /** 거점 중심 좌표 — 거리 계산 시작점. 편집 후 재계산(recomputeCourse)이 원본과 일치하도록 보존. */
  baseCenter?: LatLng
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
  /** 협업 — 이 코스가 연결된 방 코드(코스 키). 없으면 비공유 로컬 코스. */
  collabCode?: string
  /** 협업 — 이 코스에 참여한 기여자 목록(릴레이 참가자). */
  contributors?: CollabContributor[]
  /** 협업 — 기여자별 동반자 선택. 동반자 프로필 블렌딩(일행 맞춤 재추천)에 사용. */
  companionsByContributor?: Record<string, Companion[]>
  /** 협업 — 마지막 편집 시각(ISO). 실시간 LWW 충돌 표시·정렬에 사용. */
  updatedAt?: string
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
  /** 인구밀도 (명/km²) — Slow Travel Index 한적 지수 계산. 통계청 공개치 기준 근사값. */
  populationDensity: number
  /** 기상청 단기예보 격자 좌표 (시·군청 기준) — nx,ny. 비 오는 날 코스 재조정용. */
  gridX: number
  gridY: number
}
