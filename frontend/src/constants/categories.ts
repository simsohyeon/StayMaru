import type { CategoryId, CourseProfile } from '@/types/domain'

export interface CategoryDef {
  id: CategoryId
  /** 관광공사 contentTypeId 후보 (검색 시 OR) */
  contentTypeIds: number[]
  /** 정확한 분류를 위한 cat3 (9자리, 있으면 searchPlaces 에서 cat3 파라미터 우선 사용).
   *  관광공사 분류표 기준 — hanok=B02011600, temple=A02010800, market=A04010200 등. */
  cat3?: string
  /** cat3 가 너무 좁을 때 cat2 (5자리) 로 넓힘. cat3 가 없을 때만 사용. */
  cat2?: string
  /** 카테고리 칩 클릭 시 자동으로 적용할 검색 키워드 (cat3 가 없을 때 fallback).
   *  예: 서원은 별도 cat3 없어 키워드 검색이 정확. */
  forceKeyword?: string
  /** 외부 예약/안내 사이트 (카테고리 단위 보조 CTA). 예: templestay 의 공식 예약 포털. */
  externalBookingUrl?: string
  /** 검색 키워드 — 경북 특화 (단순 참고용) */
  keywords: string[]
  /** 카테고리 배지 색상 (Tailwind class) */
  color: string
  /** 마커 색상 (hex) */
  markerColor: string
  /** 다국어 라벨 */
  label: Record<'ko' | 'en' | 'ja' | 'zh', string>
  /** 아이콘 이모지 (가벼운 시각 단서) */
  emoji: string
}

export const CATEGORIES: CategoryDef[] = [
  {
    id: 'hanok',
    contentTypeIds: [32],
    cat3: 'B02011600', // 한옥 (숙박 > 한옥)
    keywords: ['한옥', '고택', 'hanok'],
    color: 'bg-surface-strong text-ink',
    markerColor: '#a52a2a',
    label: { ko: '한옥·고택', en: 'Hanok', ja: '韓屋・古宅', zh: '韩屋·古宅' },
    emoji: '🏯',
  },
  {
    id: 'templestay',
    // 템플스테이는 사찰에서 운영하는 체험 프로그램이라 관광공사 데이터로는 사찰(A02010800)을 보여주고
    // 실제 체험 예약은 한국불교문화사업단의 공식 포털(templestay.com) 외부 링크로 안내한다.
    contentTypeIds: [12],
    cat3: 'A02010800',
    // 한국불교문화사업단 공식 포털의 경상북도(areaCd=CD00000292) 지역 프로그램 검색 페이지.
    // 사찰 상세에서는 사찰명을 searchKeyword 로 자동 추가해 해당 사찰 프로그램으로 좁힌다 (ContactBlock).
    externalBookingUrl: 'https://www.templestay.com/fe/MI000000000000000062/templestay/prgList.do?pageIndex=1&areaCd=CD00000292&areaSelect=CD00000292',
    keywords: ['템플스테이', 'templestay', '산사', '사찰'],
    color: 'bg-amber-50 text-amber-800',
    markerColor: '#ca8a04',
    label: { ko: '템플스테이', en: 'Templestay', ja: 'テンプルステイ', zh: '寺院寄宿' },
    emoji: '🪷',
  },
  {
    id: 'seowon',
    contentTypeIds: [12],
    forceKeyword: '서원', // 서원은 별도 cat3 없음 — 키워드 검색이 가장 정확 (경북 102건 확인)
    keywords: ['서원'],
    color: 'bg-blue-50 text-blue-800',
    markerColor: '#1e3a8a',
    label: { ko: '서원', en: 'Seowon', ja: '書院', zh: '书院' },
    emoji: '📜',
  },
  {
    id: 'temple',
    contentTypeIds: [12],
    cat3: 'A02010800', // 사찰 (역사관광지 > 사찰)
    // 사찰 상세에서도 templestay.com 의 경북 지역 검색 페이지로 — 사찰명 키워드 자동 적용
    externalBookingUrl: 'https://www.templestay.com/fe/MI000000000000000062/templestay/prgList.do?pageIndex=1&areaCd=CD00000292&areaSelect=CD00000292',
    keywords: ['사찰', '사', '암'],
    color: 'bg-emerald-50 text-emerald-800',
    markerColor: '#166534',
    label: { ko: '사찰', en: 'Temple', ja: '寺院', zh: '寺刹' },
    emoji: '⛩️',
  },
  {
    id: 'experience',
    contentTypeIds: [12],
    // 체험관광지 전체(cat2=A0203, 경북 98건). 좁히면 cat3 A02030200(전통체험 5건)인데
    // 너무 적어 cat2 까지 넓힘. 농산어촌·전통·산사·이색체험을 모두 포함.
    cat2: 'A0203',
    keywords: ['전통체험', '체험', '공방'],
    color: 'bg-purple-100 text-purple-800',
    markerColor: '#7e22ce',
    label: { ko: '전통체험', en: 'Tradition', ja: '伝統体験', zh: '传统体验' },
    emoji: '🎎',
  },
  {
    id: 'market',
    contentTypeIds: [38, 39],
    cat3: 'A04010200', // 상설시장 (쇼핑 > 상설시장). 5일장 A04010100 은 별도.
    keywords: ['전통시장', '시장', '향토', '한식'],
    color: 'bg-orange-100 text-orange-800',
    markerColor: '#ea580c',
    label: { ko: '시장', en: 'Market', ja: '市場', zh: '市场' },
    emoji: '🍲',
  },
  {
    id: 'trail',
    // 걷기 코스는 관광지(12) 와 레포츠(28) 양쪽에 등록될 수 있어 둘 다 검색 대상.
    // cat3 A02080100(걷기) 은 산림욕장 위주라 누락 많음 → 키워드 검색 우선.
    contentTypeIds: [12, 28],
    forceKeyword: '둘레길', // 안동 선비길·경주 신라옛길 등도 어느 정도 잡힘
    keywords: ['둘레길', '옛길', '선비길', '신라옛길', '죽계구곡길', '문경새재'],
    color: 'bg-stone-100 text-stone-800',
    markerColor: '#78716c',
    label: { ko: '둘레길·옛길', en: 'Trail', ja: '巡り道', zh: '环道' },
    emoji: '🥾',
  },
  {
    id: 'attraction',
    contentTypeIds: [12],
    keywords: ['관광지'],
    color: 'bg-sky-100 text-sky-800',
    markerColor: '#0284c7',
    label: { ko: '관광지', en: 'Attraction', ja: '観光地', zh: '景点' },
    emoji: '📍',
  },
  {
    id: 'festival',
    contentTypeIds: [15],
    keywords: ['축제'],
    color: 'bg-rose-100 text-rose-800',
    markerColor: '#e11d48',
    label: { ko: '축제', en: 'Festival', ja: '祭り', zh: '庆典' },
    emoji: '🎏',
  },
]

export const CATEGORY_MAP: Record<CategoryId, CategoryDef> = CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.id]: c }),
  {} as Record<CategoryId, CategoryDef>,
)

/** FR-21 코스 유형별 카테고리 가중치 프로파일.
 *  코스 생성 엔진이 후보 장소 점수에 곱하는 multiplier. */
export interface ProfileWeights {
  hanok: number
  templestay: number
  seowon: number
  temple: number
  experience: number
  market: number
  trail: number
  attraction: number
  festival: number
  hiddenAreaBonus: number
}

export const PROFILE_WEIGHTS: Record<CourseProfile, ProfileWeights> = {
  hanok_emotion: {
    hanok: 2.0, templestay: 0.7, seowon: 1.3, temple: 0.8,
    experience: 1.0, market: 1.0, trail: 1.1, attraction: 0.8, festival: 0.6,
    hiddenAreaBonus: 0.2,
  },
  temple_healing: {
    hanok: 0.7, templestay: 2.0, seowon: 0.9, temple: 1.8,
    experience: 0.9, market: 0.7, trail: 1.4, attraction: 0.7, festival: 0.5,
    hiddenAreaBonus: 0.4,
  },
  experience_focus: {
    hanok: 1.0, templestay: 0.8, seowon: 1.1, temple: 1.0,
    experience: 2.0, market: 1.2, trail: 1.1, attraction: 0.8, festival: 0.9,
    hiddenAreaBonus: 0.3,
  },
  festival_link: {
    hanok: 1.0, templestay: 0.8, seowon: 0.9, temple: 0.8,
    experience: 1.0, market: 1.1, trail: 0.8, attraction: 1.0, festival: 2.2,
    hiddenAreaBonus: 0.2,
  },
  hidden_gb: {
    hanok: 1.0, templestay: 1.0, seowon: 1.0, temple: 1.0,
    experience: 1.1, market: 1.1, trail: 1.5, attraction: 0.9, festival: 0.9,
    hiddenAreaBonus: 1.5,
  },
}

/** 코스 유형 라벨 */
export const PROFILE_LABELS: Record<CourseProfile, Record<'ko' | 'en' | 'ja' | 'zh', string>> = {
  hanok_emotion:    { ko: '한옥 감성',     en: 'Hanok Mood',        ja: '韓屋の趣',       zh: '韩屋情怀' },
  temple_healing:   { ko: '템플스테이 힐링', en: 'Templestay Healing', ja: 'テンプル癒し',   zh: '寺院疗愈' },
  experience_focus: { ko: '전통체험 중심',   en: 'Tradition Focus',    ja: '伝統体験中心',   zh: '传统体验' },
  festival_link:    { ko: '축제 연계',      en: 'Festival Link',      ja: '祭りリンク',     zh: '庆典联动' },
  hidden_gb:        { ko: '숨겨진 경북',     en: 'Hidden Gyeongbuk',   ja: '隠れた慶北',     zh: '隐藏庆北' },
}
