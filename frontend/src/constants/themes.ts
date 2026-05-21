import type { CategoryId, Lang } from '@/types/domain'

/**
 * 테마 큐레이션 — 시즌/감성/동행/활동 단위로 묶은 큐레이션 셋.
 * 카테고리(영구 분류)와 달리 일시적이고 컨텍스트 의존적인 묶음이다.
 *
 * Explore 페이지에서 ?theme=<id> 로 진입하면 keyword/category 가 자동 적용된다.
 */
export interface Theme {
  id: string
  emoji: string
  /** Tailwind background tone (카드 hover 강조용) */
  tone: string
  /** 시즌 (있으면 해당 월에 자동 강조) */
  season?: 'spring' | 'summer' | 'autumn' | 'winter'
  /** 이 테마에 우선 노출할 카테고리들 — Explore 진입 시 첫 번째가 자동 선택 */
  categories?: CategoryId[]
  /** 관광공사 키워드 (단일) — 있으면 keyword 우선 적용 */
  keyword?: string
  /** 우선 시군 코드 — Explore 진입 시 자동 적용 */
  preferredSigungus?: number[]
  label: Record<Lang, string>
  caption: Record<Lang, string>
}

export const THEMES: Theme[] = [
  // ─── 시즌 ───
  {
    id: 'cherry',
    emoji: '🌸',
    tone: 'bg-pink-50',
    season: 'spring',
    keyword: '벚꽃',
    label: { ko: '벚꽃 명소', en: 'Cherry blossoms', ja: '桜の名所', zh: '樱花胜地' },
    caption: {
      ko: '경주 보문 · 경산 반곡지 · 구미 동락공원',
      en: 'Bomun Gyeongju · Bangokji · Dongnak Park',
      ja: '慶州普門・慶山盤谷池・亀尾東洛公園',
      zh: '庆州普门·庆山盘谷池·龟尾东洛公园',
    },
  },
  {
    id: 'autumn',
    emoji: '🍁',
    tone: 'bg-amber-50',
    season: 'autumn',
    keyword: '단풍',
    label: { ko: '단풍 명소', en: 'Autumn foliage', ja: '紅葉の名所', zh: '枫叶胜地' },
    caption: {
      ko: '문경 주왕산 · 영주 부석사 · 청송 주산지',
      en: 'Juwangsan · Buseoksa · Jusanji',
      ja: '周王山・浮石寺・注山池',
      zh: '周王山·浮石寺·注山池',
    },
  },
  {
    id: 'snow',
    emoji: '❄️',
    tone: 'bg-sky-50',
    season: 'winter',
    keyword: '설경',
    label: { ko: '겨울 풍경', en: 'Snow scenes', ja: '雪景色', zh: '雪景' },
    caption: {
      ko: '봉화 청량산 · 영주 부석사 · 안동 도산서원',
      en: 'Cheongnyangsan · Buseoksa · Dosan Seowon',
      ja: '清涼山・浮石寺・陶山書院',
      zh: '清凉山·浮石寺·陶山书院',
    },
  },

  // ─── 감성 ───
  {
    id: 'night',
    emoji: '🌙',
    tone: 'bg-indigo-50',
    keyword: '야경',
    label: { ko: '야경', en: 'Night views', ja: '夜景', zh: '夜景' },
    caption: {
      ko: '안동 월영교 · 경주 동궁과 월지 · 포항 영일대',
      en: 'Woryeonggyo · Donggung & Wolji · Yeongildae',
      ja: '月映橋・東宮と月池・迎日台',
      zh: '月映桥·东宫与月池·迎日台',
    },
  },
  {
    id: 'sunrise',
    emoji: '🌅',
    tone: 'bg-orange-50',
    preferredSigungus: [23, 12, 18], // 포항, 영덕, 울진
    keyword: '일출',
    label: { ko: '일출 명소', en: 'Sunrise', ja: '日の出', zh: '日出胜地' },
    caption: {
      ko: '호미곶 · 강구항 · 후포항',
      en: 'Homigot · Ganggu · Hupo',
      ja: '虎尾串・江口港・厚浦港',
      zh: '虎尾串·江口港·厚浦港',
    },
  },

  // ─── 동행 ───
  {
    id: 'family',
    emoji: '🧒',
    tone: 'bg-emerald-50',
    categories: ['experience', 'market', 'attraction'],
    label: { ko: '아이와 함께', en: 'With kids', ja: '子どもと', zh: '亲子游' },
    caption: {
      ko: '체험·박물관·전통시장 위주',
      en: 'Hands-on experiences, museums, markets',
      ja: '体験・博物館・市場',
      zh: '体验·博物馆·市场',
    },
  },
  {
    id: 'parents',
    emoji: '🧓',
    tone: 'bg-rose-50',
    categories: ['hanok', 'seowon', 'temple', 'market'],
    label: { ko: '부모님과', en: 'With parents', ja: '両親と', zh: '与父母同游' },
    caption: {
      ko: '한옥·서원·사찰·향토시장',
      en: 'Hanok, Seowon, temples, traditional markets',
      ja: '韓屋・書院・寺院・市場',
      zh: '韩屋·书院·寺院·市场',
    },
  },
  {
    id: 'solo',
    emoji: '🚶',
    tone: 'bg-stone-50',
    categories: ['temple', 'templestay', 'trail', 'seowon'],
    label: { ko: '혼자 가기 좋은', en: 'Solo travel', ja: 'ひとり旅', zh: '独行' },
    caption: {
      ko: '사찰·둘레길·서원의 고요',
      en: 'Quiet temples, trails, and seowon',
      ja: '寺院・巡り道・書院の静けさ',
      zh: '寺院·步道·书院的静谧',
    },
  },

  // ─── 활동 ───
  {
    id: 'healing',
    emoji: '🧘',
    tone: 'bg-teal-50',
    categories: ['templestay', 'temple', 'trail'],
    label: { ko: '명상·힐링', en: 'Meditation', ja: '癒し', zh: '冥想疗愈' },
    caption: {
      ko: '템플스테이·산사 산책',
      en: 'Templestays and mountain temples',
      ja: 'テンプルステイ・山寺散策',
      zh: '寺院寄宿·山寺漫步',
    },
  },
  {
    id: 'food',
    emoji: '🍲',
    tone: 'bg-orange-50',
    categories: ['market'],
    label: { ko: '미식 여행', en: 'Food trip', ja: 'グルメ', zh: '美食之旅' },
    caption: {
      ko: '안동찜닭 · 포항물회 · 영덕대게 · 봉화송이',
      en: 'Andong jjimdak, Pohang mulhoe, Yeongdeok crab, Bonghwa pine mushroom',
      ja: '安東チムタク・浦項ムルフェ・盈徳ガニ',
      zh: '安东辣炖鸡·浦项凉拌生鱼·盈德雪蟹',
    },
  },
]

export const THEME_MAP: Record<string, Theme> = THEMES.reduce(
  (acc, t) => ({ ...acc, [t.id]: t }),
  {},
)

/** 현재 월 기준으로 시즌이 맞는 테마를 앞으로. */
export function getCurrentSeason(date = new Date()): 'spring' | 'summer' | 'autumn' | 'winter' {
  const m = date.getMonth() + 1
  if (m >= 3 && m <= 5) return 'spring'
  if (m >= 6 && m <= 8) return 'summer'
  if (m >= 9 && m <= 11) return 'autumn'
  return 'winter'
}

/** 시즌 우선 + 나머지 순으로 정렬한 테마 목록. */
export function sortedThemes(date = new Date()): Theme[] {
  const cur = getCurrentSeason(date)
  return [...THEMES].sort((a, b) => {
    const aIs = a.season === cur ? 0 : 1
    const bIs = b.season === cur ? 0 : 1
    return aIs - bIs
  })
}
