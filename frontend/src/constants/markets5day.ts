import type { Lang } from '@/types/domain'

/**
 * 경상북도 주요 5일장 (전통시장진흥재단 / 시·군청 공개 자료 기준).
 *
 * 5일장은 끝자리(날짜 % 10) 두 개 — 예: "2·7 일장" 은 2,7,12,17,22,27일에 선다.
 * Place / Festival 데이터에는 5일장 일정이 없어, 거점 시군구로 매칭하여
 * "내일 풍기장 → 코스에 자동 삽입" 같은 안내에 사용한다.
 */
export interface Market5Day {
  sigunguCode: number
  /** 끝자리 두 개 (날짜 % 10) — 5,0 은 5일과 10·20·30일을 의미 */
  digits: [number, number]
  /** 장이 서는 위치(주소 텍스트) */
  location: string
  label: Record<Lang, string>
  /** 대표 품목 — 카드 카피용 */
  items: Record<Lang, string>
}

export const MARKETS_5DAY: Market5Day[] = [
  { sigunguCode: 11, digits: [2, 7], location: '안동시 중앙동',
    label: { ko: '안동장', en: 'Andong 5-day', ja: '安東市場', zh: '安东5日集' },
    items: { ko: '안동찜닭·간고등어·한지', en: 'Jjimdak, salted mackerel, hanji', ja: 'チムタク・塩鯖・韓紙', zh: '炖鸡·咸鲭·韩纸' } },
  { sigunguCode: 11, digits: [1, 6], location: '안동시 풍산읍',
    label: { ko: '풍산장', en: 'Pungsan 5-day', ja: '豊山市場', zh: '丰山5日集' },
    items: { ko: '하회마을 인근 장날', en: 'Near Hahoe Village', ja: '河回村近郊', zh: '河回村附近' } },
  { sigunguCode: 14, digits: [3, 8], location: '영주시 풍기읍',
    label: { ko: '풍기장', en: 'Punggi 5-day', ja: '豊基市場', zh: '丰基5日集' },
    items: { ko: '인삼·사과·인견', en: 'Ginseng, apples, hemp cloth', ja: '高麗人参・りんご・人絹', zh: '人参·苹果·人造丝' } },
  { sigunguCode: 14, digits: [5, 0], location: '영주시 영주동',
    label: { ko: '영주장', en: 'Yeongju 5-day', ja: '栄州市場', zh: '荣州5日集' },
    items: { ko: '소수서원 인근 장날', en: 'Near Sosu Seowon', ja: '紹修書院近郊', zh: '紹修书院附近' } },
  { sigunguCode: 15, digits: [2, 7], location: '영천시 완산동',
    label: { ko: '영천장', en: 'Yeongcheon 5-day', ja: '永川市場', zh: '永川5日集' },
    items: { ko: '한약재·복숭아·과메기', en: 'Herbs, peaches, dried fish', ja: '生薬・桃・干物', zh: '中药·桃·风干鱼' } },
  { sigunguCode: 19, digits: [2, 7], location: '의성군 의성읍',
    label: { ko: '의성장', en: 'Uiseong 5-day', ja: '義城市場', zh: '义城5日集' },
    items: { ko: '마늘·자두·산나물', en: 'Garlic, plums, wild herbs', ja: 'ニンニク・スモモ・山菜', zh: '大蒜·李子·山菜' } },
  { sigunguCode: 21, digits: [4, 9], location: '청송군 청송읍',
    label: { ko: '청송장', en: 'Cheongsong 5-day', ja: '青松市場', zh: '青松5日集' },
    items: { ko: '청송사과·약수닭백숙', en: 'Cheongsong apples, herbal chicken', ja: '青松リンゴ・薬水鶏', zh: '青松苹果·药水鸡汤' } },
  { sigunguCode: 8, digits: [3, 8], location: '봉화군 봉화읍',
    label: { ko: '봉화장', en: 'Bonghwa 5-day', ja: '奉化市場', zh: '奉化5日集' },
    items: { ko: '송이·산나물·한우', en: 'Pine mushroom, herbs, beef', ja: 'マツタケ・山菜・韓牛', zh: '松茸·山菜·韩牛' } },
  { sigunguCode: 12, digits: [4, 9], location: '영덕군 영덕읍',
    label: { ko: '영덕장', en: 'Yeongdeok 5-day', ja: '盈徳市場', zh: '盈德5日集' },
    items: { ko: '영덕대게·복숭아', en: 'Snow crab, peaches', ja: '盈徳ズワイガニ・桃', zh: '盈德雪蟹·桃' } },
  { sigunguCode: 23, digits: [2, 7], location: '포항시 북구 흥해읍',
    label: { ko: '흥해장', en: 'Heunghae 5-day', ja: '興海市場', zh: '兴海5日集' },
    items: { ko: '동해 해산물·한우', en: 'East Sea seafood, beef', ja: '東海海産物・韓牛', zh: '东海海鲜·韩牛' } },
  { sigunguCode: 7, digits: [4, 9], location: '문경시 점촌동',
    label: { ko: '점촌장', en: 'Jeomchon 5-day', ja: '店村市場', zh: '店村5日集' },
    items: { ko: '오미자·약초·도자기', en: 'Omija, herbs, pottery', ja: '五味子・薬草・陶磁器', zh: '五味子·药草·陶瓷' } },
  { sigunguCode: 1, digits: [5, 0], location: '경산시 중방동',
    label: { ko: '경산장', en: 'Gyeongsan 5-day', ja: '慶山市場', zh: '庆山5日集' },
    items: { ko: '대추·포도', en: 'Jujubes, grapes', ja: 'ナツメ・ブドウ', zh: '红枣·葡萄' } },
  { sigunguCode: 13, digits: [4, 9], location: '영양군 영양읍',
    label: { ko: '영양장', en: 'Yeongyang 5-day', ja: '英陽市場', zh: '英阳5日集' },
    items: { ko: '고추·산나물·자작나무', en: 'Red pepper, wild herbs', ja: '唐辛子・山菜', zh: '辣椒·山菜' } },
  { sigunguCode: 6, digits: [4, 9], location: '김천시 황금동',
    label: { ko: '김천장', en: 'Gimcheon 5-day', ja: '金泉市場', zh: '金泉5日集' },
    items: { ko: '포도·자두·직지사 길목', en: 'Grapes, plums', ja: 'ブドウ・スモモ', zh: '葡萄·李子' } },
  { sigunguCode: 9, digits: [2, 7], location: '상주시 무양동',
    label: { ko: '상주장', en: 'Sangju 5-day', ja: '尚州市場', zh: '尚州5日集' },
    items: { ko: '곶감·쌀·자전거', en: 'Dried persimmon, rice', ja: '干し柿・米', zh: '柿饼·大米' } },
  { sigunguCode: 18, digits: [3, 8], location: '울진군 후포면',
    label: { ko: '후포장', en: 'Hupo 5-day', ja: '厚浦市場', zh: '厚浦5日集' },
    items: { ko: '대게·곰치국·해녀', en: 'Crab, fish soup', ja: 'カニ・魚汁', zh: '螃蟹·鱼汤' } },
  { sigunguCode: 22, digits: [3, 8], location: '칠곡군 왜관읍',
    label: { ko: '왜관장', en: 'Waegwan 5-day', ja: '倭館市場', zh: '倭馆5日集' },
    items: { ko: '낙동강변 장날', en: 'Nakdong River market', ja: '洛東江市場', zh: '洛东江市集' } },
  { sigunguCode: 20, digits: [4, 9], location: '청도군 청도읍',
    label: { ko: '청도장', en: 'Cheongdo 5-day', ja: '清道市場', zh: '清道5日集' },
    items: { ko: '청도반시·미나리', en: 'Bansi persimmon, dropwort', ja: '半枾柿・セリ', zh: '半枾柿·水芹' } },
]

export interface MarketHit {
  market: Market5Day
  date: Date
  /** 오늘로부터 며칠 후 (0 = 오늘) */
  daysAhead: number
}

/** 주어진 날짜에 장이 서는 5일장 모두 반환. */
export function marketsOnDate(date: Date): Market5Day[] {
  const day = date.getDate() % 10
  return MARKETS_5DAY.filter((m) => m.digits.includes(day))
}

/**
 * 거점 시군구 + 향후 N일 내 가장 가까운 장날.
 * "안동을 거점으로 잡았는데 내일이 안동장" 같은 상황을 잡아낸다.
 */
export function nextMarketIn(
  sigunguCode: number,
  fromDate: Date = new Date(),
  withinDays = 5,
): MarketHit | undefined {
  const candidates = MARKETS_5DAY.filter((m) => m.sigunguCode === sigunguCode)
  if (candidates.length === 0) return undefined
  for (let i = 0; i < withinDays; i++) {
    const d = new Date(fromDate)
    d.setDate(d.getDate() + i)
    const day = d.getDate() % 10
    const hit = candidates.find((m) => m.digits.includes(day))
    if (hit) return { market: hit, date: d, daysAhead: i }
  }
  return undefined
}

/** 거점들 중 가장 임박한 5일장 1개 반환. */
export function bestMarketForBases(
  sigunguCodes: number[],
  fromDate: Date = new Date(),
): MarketHit | undefined {
  let best: MarketHit | undefined
  for (const code of sigunguCodes) {
    const hit = nextMarketIn(code, fromDate, 5)
    if (hit && (!best || hit.daysAhead < best.daysAhead)) best = hit
  }
  return best
}
