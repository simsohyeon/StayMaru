import type { CategoryId, Lang } from '@/types/domain'

/**
 * 경북 컬렉터 패스 — 카테고리별 방문 목표를 모으는 디지털 도장판.
 *
 * Journal 진입 시 진척률 시각화. 완료 시 "Gyeongbuk Pass · Complete" 배지가 부여되며
 * 공유 OG 카드에 노출된다. 1회성 코스앱을 넘어 "다음 시즌 다시 와야 할 이유"를 만든다.
 */
export interface Pass {
  id: string
  category: CategoryId
  goal: number
  emoji: string
  label: Record<Lang, string>
  caption: Record<Lang, string>
}

export const PASSES: Pass[] = [
  {
    id: 'hanok-pass',
    category: 'hanok',
    goal: 10,
    emoji: '🏯',
    label:   { ko: '한옥 컬렉터',     en: 'Hanok Collector',    ja: '韓屋コレクター',     zh: '韩屋收藏家' },
    caption: { ko: '경북 한옥·고택 10곳', en: '10 hanok & old homes', ja: '慶北の韓屋・古宅10ヶ所', zh: '庆北 10 座韩屋古宅' },
  },
  {
    id: 'temple-pass',
    category: 'temple',
    goal: 10,
    emoji: '⛩️',
    label:   { ko: '사찰 컬렉터',     en: 'Temple Collector',   ja: '寺院コレクター',     zh: '寺刹收藏家' },
    caption: { ko: '경북 천년사찰 10곳', en: '10 millennia-old temples', ja: '千年寺院10ヶ所', zh: '10 座千年寺刹' },
  },
  {
    id: 'seowon-pass',
    category: 'seowon',
    goal: 4,
    emoji: '📜',
    label:   { ko: '서원 컬렉터',     en: 'Seowon Collector',   ja: '書院コレクター',     zh: '书院收藏家' },
    caption: { ko: 'UNESCO 4서원 (도산·소수·병산·옥산)', en: 'UNESCO 4 seowons', ja: 'ユネスコ4書院', zh: '4座教科文书院' },
  },
  {
    id: 'market-pass',
    category: 'market',
    goal: 8,
    emoji: '🍲',
    label:   { ko: '향토시장 컬렉터',  en: 'Market Collector',   ja: '郷土市場コレクター',  zh: '乡土市集收藏家' },
    caption: { ko: '경북 향토시장 8곳', en: '8 local markets',    ja: '郷土市場8ヶ所',     zh: '8 个乡土市集' },
  },
  {
    id: 'experience-pass',
    category: 'experience',
    goal: 6,
    emoji: '🎎',
    label:   { ko: '전통체험 패스',   en: 'Tradition Pass',     ja: '伝統体験パス',      zh: '传统体验通行证' },
    caption: { ko: '도자기·차·탈춤 6회', en: '6 hands-on sessions',  ja: '陶芸・茶・タルチュム6回', zh: '陶艺·茶·假面舞6次' },
  },
]
