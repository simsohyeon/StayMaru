import type { CategoryId, CourseProfile, Lang, TripDuration } from '@/types/domain'

/**
 * 큐레이션 추천 코스 — VisitKorea 의 "추천 여행코스" 대응.
 *
 * 클릭 시 Home 빌더에 sigunguCodes/profile/duration 이 자동 입력되고
 * `#builder` 로 스크롤만 한다. 자동 생성은 하지 않는다 — 사용자가
 * 직접 "코스 만들기" 를 눌러서 확정해야 의도가 명확하다.
 *
 * 이 데이터는 정적이지만 추후 백엔드/CMS 로 이관할 수 있도록 평탄한 구조로 유지.
 */
export interface CuratedCourse {
  id: string
  /** 거점 시군구 sigunguCode (1~3개) */
  sigunguCodes: number[]
  profile: CourseProfile
  duration: TripDuration
  /** 카테고리 힌트 — 카드 좌측 아이콘 줄에 노출 */
  themes: CategoryId[]
  /** 카드 헤더 컬러 strip (테마 톤). */
  accent: string
  /** 카드 하단 표시할 짧은 라벨 (예: "안동 2N3D"). 다국어 미적용 (간결 우선) */
  badge?: string
  i18n: Record<Lang, { title: string; desc: string }>
}

export const CURATED_COURSES: CuratedCourse[] = [
  {
    id: 'andong-hanok-2n3d',
    sigunguCodes: [11],
    profile: 'hanok_emotion',
    duration: '2n3d',
    themes: ['hanok', 'seowon', 'experience'],
    accent: '#8B4513',
    badge: 'ANDONG · 2N3D',
    i18n: {
      ko: {
        title: '안동 한옥에서 머무는 사흘',
        desc: '하회마을·도산서원·종택과 안동찜닭. 600년 시간의 결을 그대로 머무는 코스.',
      },
      en: {
        title: 'Three days inside Andong hanok',
        desc: "Hahoe Village, Dosan Seowon, head houses, jjimdak — Andong's 600-year grain, savored.",
      },
      ja: {
        title: '安東の韓屋に泊まる三日',
        desc: '河回村・陶山書院・宗家とアンドンチムタク。600年の時の流れにそのまま身を置く。',
      },
      zh: {
        title: '安东韩屋三日游',
        desc: '河回村·陶山书院·宗宅与安东炖鸡，沉浸于六百年时光的纹理。',
      },
    },
  },
  {
    id: 'gyeongju-silla-1n2d',
    sigunguCodes: [2],
    profile: 'temple_healing',
    duration: '1n2d',
    themes: ['temple', 'attraction', 'market'],
    accent: '#7C5A3A',
    badge: 'GYEONGJU · 1N2D',
    i18n: {
      ko: {
        title: '경주에서 천 년을 걷다',
        desc: '불국사·석굴암·대릉원과 황리단길. 신라의 시간을 하루 반에 압축한 정석 코스.',
      },
      en: {
        title: 'A thousand years on foot in Gyeongju',
        desc: 'Bulguksa, Seokguram, Daereungwon and Hwangnidan-gil — Silla, condensed into a day and a half.',
      },
      ja: {
        title: '慶州で千年を歩く',
        desc: '仏国寺・石窟庵・大陵苑と皇理団キル。新羅の時を一日半に凝縮した王道。',
      },
      zh: {
        title: '在庆州走过千年',
        desc: '佛国寺·石窟庵·大陵苑与皇理团街，将新罗千年浓缩为一天半的经典之旅。',
      },
    },
  },
  {
    id: 'yeongju-bonghwa-seowon-1n2d',
    sigunguCodes: [14, 8],
    profile: 'hanok_emotion',
    duration: '1n2d',
    themes: ['seowon', 'temple', 'trail'],
    accent: '#5C7048',
    badge: 'YEONGJU + BONGHWA · 1N2D',
    i18n: {
      ko: {
        title: '소수서원과 봉화 산사의 길',
        desc: '한국 최초의 서원 소수서원과 부석사, 그리고 봉화 청량산. 영남 사림의 학풍이 머무는 길.',
      },
      en: {
        title: "Sosu Seowon and Bonghwa's mountain road",
        desc: "Korea's first seowon, Buseoksa, and Cheongnyangsan — the path where the Yeongnam scholarly spirit settled.",
      },
      ja: {
        title: '紹修書院と奉化山寺の道',
        desc: '韓国最古の書院・紹修書院と浮石寺、奉化清涼山。嶺南士林の学風が息づく道。',
      },
      zh: {
        title: '绍修书院与奉化山寺之路',
        desc: '韩国最早的书院绍修书院、浮石寺与奉化清凉山，岭南士林学风栖息之地。',
      },
    },
  },
  {
    id: 'hidden-cheongsong-yeongyang-2n3d',
    sigunguCodes: [21, 13],
    profile: 'hidden_gb',
    duration: '2n3d',
    themes: ['trail', 'attraction', 'hanok'],
    accent: '#2F5749',
    badge: 'CHEONGSONG + YEONGYANG · 2N3D',
    i18n: {
      ko: {
        title: '숨겨진 청송·영양 둘레',
        desc: '주왕산·주산지·두들마을. 사람보다 산세가 많은 경북의 가장 조용한 시간.',
      },
      en: {
        title: 'Hidden loop · Cheongsong and Yeongyang',
        desc: "Juwangsan, Jusanji and Dudeul Village — Gyeongbuk's quietest hours, where the mountains outnumber the people.",
      },
      ja: {
        title: '隠れた青松・英陽の周遊',
        desc: '周王山・注山池・斗の村。人より山が多い、慶北のもっとも静かな時間。',
      },
      zh: {
        title: '隐秘的青松·英阳环线',
        desc: '周王山·注山池·斗村，山势比人多的庆北最静谧之时。',
      },
    },
  },
  {
    id: 'mungyeong-experience-1n2d',
    sigunguCodes: [7],
    profile: 'experience_focus',
    duration: '1n2d',
    themes: ['experience', 'trail', 'market'],
    accent: '#A85B2A',
    badge: 'MUNGYEONG · 1N2D',
    i18n: {
      ko: {
        title: '문경 옛길과 찻사발 빚는 하루',
        desc: '문경새재 3관문·찻사발 도예 체험·약돌한우. 손과 입으로 느끼는 전통의 결.',
      },
      en: {
        title: 'Mungyeong old path and a day shaping tea bowls',
        desc: 'Mungyeongsaejae 3rd gate, tea-bowl ceramics, mineral-stone beef — tradition through hand and tongue.',
      },
      ja: {
        title: '聞慶の旧道と茶碗を作る一日',
        desc: '聞慶セジェ第三関門・茶碗の陶芸体験・薬石韓牛。手と舌で味わう伝統。',
      },
      zh: {
        title: '闻庆古道与茶碗烧造之日',
        desc: '闻庆鸟岭第三关·茶碗陶艺体验·药石韩牛，用手与舌体味传统纹理。',
      },
    },
  },
  {
    id: 'pohang-yeongdeok-coastal-1n2d',
    sigunguCodes: [23, 12],
    profile: 'festival_link',
    duration: '1n2d',
    themes: ['attraction', 'market', 'festival'],
    accent: '#1F5B8A',
    badge: 'POHANG + YEONGDEOK · 1N2D',
    i18n: {
      ko: {
        title: '동해 일출과 영덕 대게',
        desc: '호미곶 해맞이·구룡포 일본인가옥거리·영덕 대게 거리. 바다의 결을 따라가는 1박 2일.',
      },
      en: {
        title: 'East Sea sunrise and Yeongdeok snow crab',
        desc: 'Homigot sunrise, Guryongpo Japanese-house street, Yeongdeok crab street — following the grain of the sea.',
      },
      ja: {
        title: '東海の日の出と盈徳ズワイガニ',
        desc: '虎尾串の日の出・九龍浦日本人家屋通り・盈徳ズワイガニ通り。海の流れに沿う1泊2日。',
      },
      zh: {
        title: '东海日出与盈德雪蟹',
        desc: '虎尾串迎日·九龙浦日式街·盈德雪蟹一条街，沿海的纹理一夜两日。',
      },
    },
  },
]
