/**
 * 국보·보물·세계유산 등급 큐레이션.
 *
 * 한국관광공사 API 응답에는 문화재 등급이 명시되어 있지 않다.
 * 문화재청 국가유산포털 (heritage.go.kr) 공개 자료를 기반으로 경상북도의 대표 유산만 수동 매핑한다.
 *
 * 매칭 방식: place.name 에 `match` 의 모든 키워드가 포함되면 매칭(AND).
 * "부석사 무량수전" 같이 사찰 전체가 아니라 특정 전각에만 등급이 매겨진 경우를 정확히 잡기 위함.
 */
export type HeritageGrade =
  | 'unesco'           // 유네스코 세계유산
  | 'national-treasure'// 국보
  | 'treasure'         // 보물
  | 'historic'         // 사적
  | 'intangible'       // 무형문화재

export interface HeritageEntry {
  match: string[]
  grade: HeritageGrade
  /** 지정 번호 (있을 때) */
  no?: string
  note: Record<'ko' | 'en' | 'ja' | 'zh', string>
}

export const HERITAGES: HeritageEntry[] = [
  // ── 유네스코 세계유산 ────────────────────────────────
  { match: ['하회마을'], grade: 'unesco',
    note: { ko: '유네스코 세계유산 · 한국의 역사마을', en: 'UNESCO World Heritage · Historic Village', ja: 'ユネスコ世界遺産・歴史村', zh: '联合国教科文世界遗产·历史村落' } },
  { match: ['양동마을'], grade: 'unesco',
    note: { ko: '유네스코 세계유산 · 한국의 역사마을', en: 'UNESCO World Heritage · Historic Village', ja: 'ユネスコ世界遺産・歴史村', zh: '联合国教科文世界遗产·历史村落' } },
  { match: ['불국사'], grade: 'unesco',
    note: { ko: '유네스코 세계유산 · 석굴암과 불국사', en: 'UNESCO World Heritage · Bulguksa', ja: 'ユネスコ世界遺産・仏国寺', zh: '联合国教科文世界遗产·佛国寺' } },
  { match: ['석굴암'], grade: 'unesco',
    note: { ko: '유네스코 세계유산 · 석굴암과 불국사', en: 'UNESCO World Heritage · Seokguram', ja: 'ユネスコ世界遺産・石窟庵', zh: '联合国教科文世界遗产·石窟庵' } },
  { match: ['도산서원'], grade: 'unesco',
    note: { ko: '유네스코 한국의 서원 (퇴계 이황)', en: 'UNESCO Seowon · Yi Hwang', ja: 'ユネスコ書院・李滉', zh: '联合国教科文书院·李滉' } },
  { match: ['소수서원'], grade: 'unesco',
    note: { ko: '유네스코 한국의 서원 (한국 최초)', en: 'UNESCO Seowon · Korea\'s first', ja: 'ユネスコ書院・最古', zh: '联合国教科文书院·最早' } },
  { match: ['병산서원'], grade: 'unesco',
    note: { ko: '유네스코 한국의 서원 (만대루)', en: 'UNESCO Seowon · Mandaeru', ja: 'ユネスコ書院・晩対楼', zh: '联合国教科文书院·晚对楼' } },
  { match: ['옥산서원'], grade: 'unesco',
    note: { ko: '유네스코 한국의 서원 (회재 이언적)', en: 'UNESCO Seowon · Yi Eonjeok', ja: 'ユネスコ書院・李彦迪', zh: '联合国教科文书院·李彦迪' } },
  { match: ['봉정사'], grade: 'unesco',
    note: { ko: '유네스코 산사, 한국의 산지승원', en: 'UNESCO Sansa · Mountain Monastery', ja: 'ユネスコ山寺', zh: '联合国教科文山寺' } },

  // ── 국보 (대표 전각·유물) ────────────────────────────
  { match: ['부석사', '무량수전'], grade: 'national-treasure', no: '국보 제18호',
    note: { ko: '부석사 무량수전 · 국보 제18호', en: 'Muryangsujeon Hall · National Treasure #18', ja: '無量寿殿・国宝第18号', zh: '无量寿殿·国宝第18号' } },
  { match: ['봉정사', '극락전'], grade: 'national-treasure', no: '국보 제15호',
    note: { ko: '봉정사 극락전 · 현존 최고 목조건물', en: 'Geungnakjeon · Oldest wooden building', ja: '極楽殿・現存最古の木造', zh: '极乐殿·现存最古木造' } },
  { match: ['부석사', '조사당'], grade: 'national-treasure', no: '국보 제19호',
    note: { ko: '부석사 조사당 · 국보 제19호', en: 'Josadang Shrine · National Treasure #19', ja: '祖師堂・国宝', zh: '祖师堂·国宝' } },

  // ── 보물 / 사적 ────────────────────────────────────
  { match: ['해인사'], grade: 'unesco',
    note: { ko: '유네스코 세계유산 · 합천 (경계 인근)', en: 'UNESCO · near Gyeongbuk', ja: 'ユネスコ・慶北隣接', zh: '联合国教科文·邻接' } },
  { match: ['직지사'], grade: 'historic', no: '사적',
    note: { ko: '신라 천년고찰 · 김천', en: 'Silla-era temple · Gimcheon', ja: '新羅千年古刹', zh: '新罗千年古刹' } },
  { match: ['고운사'], grade: 'historic',
    note: { ko: '조계종 16교구 본사 · 의성', en: 'Jogye Order head temple · Uiseong', ja: '曹渓宗本山', zh: '曹溪宗本山' } },
  { match: ['은해사'], grade: 'historic',
    note: { ko: '팔공산 자락 천년사찰 · 영천', en: 'Millennia-old temple · Yeongcheon', ja: '八公山千年寺', zh: '八公山千年寺' } },

  // ── 사적 · 한옥/고택 ────────────────────────────────
  { match: ['종택'], grade: 'historic',
    note: { ko: '국가/도 지정 종택', en: 'Designated head house', ja: '指定宗家', zh: '指定宗家' } },
  { match: ['고택'], grade: 'historic',
    note: { ko: '문화재 지정 고택', en: 'Heritage hanok', ja: '文化財古宅', zh: '文化遗产古宅' } },

  // ── 무형문화재 (체험 카테고리) ──────────────────────
  { match: ['하회별신굿'], grade: 'intangible', no: '국가무형문화재 제69호',
    note: { ko: '국가무형문화재 · 하회별신굿탈놀이', en: 'Intangible Heritage · Hahoe mask dance', ja: '国家無形文化財・河回別神クッ', zh: '国家无形文化遗产·河回别神巫' } },
  { match: ['탈춤'], grade: 'intangible',
    note: { ko: '국가무형문화재 · 탈춤', en: 'Intangible Heritage · Mask dance', ja: '無形文化財・タルチュム', zh: '无形文化遗产·假面舞' } },
  { match: ['한지'], grade: 'intangible',
    note: { ko: '전통 한지 제작', en: 'Traditional Hanji paper', ja: '伝統韓紙', zh: '传统韩纸' } },
  { match: ['도자기', '문경'], grade: 'intangible',
    note: { ko: '문경 전통 사기장', en: 'Mungyeong traditional potter', ja: '聞慶伝統陶芸', zh: '闻庆传统陶艺' } },
]

export function findHeritage(placeName: string): HeritageEntry | undefined {
  if (!placeName) return undefined
  return HERITAGES.find((h) => h.match.every((m) => placeName.includes(m)))
}

/** 등급별 색상 토큰 (Tailwind classes) */
export const HERITAGE_TONE: Record<HeritageGrade, { badge: string; dot: string; label: Record<'ko' | 'en' | 'ja' | 'zh', string> }> = {
  unesco: {
    badge: 'bg-violet-50 text-violet-800 border-violet-200',
    dot: 'bg-violet-500',
    label: { ko: '세계유산', en: 'UNESCO', ja: '世界遺産', zh: '世界遗产' },
  },
  'national-treasure': {
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    label: { ko: '국보', en: 'Nat. Treasure', ja: '国宝', zh: '国宝' },
  },
  treasure: {
    badge: 'bg-orange-50 text-orange-800 border-orange-200',
    dot: 'bg-orange-500',
    label: { ko: '보물', en: 'Treasure', ja: '宝物', zh: '宝物' },
  },
  historic: {
    badge: 'bg-stone-100 text-stone-800 border-stone-300',
    dot: 'bg-stone-500',
    label: { ko: '사적', en: 'Historic', ja: '史跡', zh: '史迹' },
  },
  intangible: {
    badge: 'bg-rose-50 text-rose-800 border-rose-200',
    dot: 'bg-rose-500',
    label: { ko: '무형문화재', en: 'Intangible', ja: '無形文化財', zh: '无形文化遗产' },
  },
}
