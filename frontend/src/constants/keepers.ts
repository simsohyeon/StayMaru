import type { Lang } from '@/types/domain'

/**
 * "장소가 아니라 사람을 만나는 여행." — Keepers 큐레이션.
 *
 * 사찰의 주지·한옥의 종손/종부·무형문화재 보유자 등 "공간을 지키는 사람"을
 * 익명/역할 중심으로 카드화한다. 실명 공개는 공식 무형문화재 보유자 등 공개된
 * 경우에 한정. 다른 코스앱이 장소를 카탈로그하는 동안 쉼마루는 "이 자리를 지키는 사람"을 보여준다.
 *
 * 매칭: place.name 에 match 의 모든 키워드가 포함되면 매칭(AND).
 */
export interface Keeper {
  match: string[]
  role: Record<Lang, string>
  bio: Record<Lang, string>
  /** 만남/체험 가능 형식 — "차담 가능", "영문 가이드", "1박 종부 안내" 등 */
  meeting?: Record<Lang, string>
  emoji: string
}

export const KEEPERS: Keeper[] = [
  {
    match: ['봉정사'],
    role: { ko: '주지 스님', en: 'Head monk', ja: '住職', zh: '住持' },
    bio: {
      ko: '현존 한국 최고(最古) 목조건축 극락전을 지키는 자리. 사찰 운영과 템플스테이를 함께 안내합니다.',
      en: 'The keeper of Korea\'s oldest surviving wooden building. Oversees the temple and its templestay program.',
      ja: '現存韓国最古の木造建築・極楽殿を守る方。寺院運営とテンプルステイを共に案内します。',
      zh: '守护现存韩国最古老木造建筑极乐殿的住持,同时引导寺院与寺院寄宿活动。',
    },
    meeting: {
      ko: '예약 시 차담 가능 · 영문 안내 보조',
      en: 'Tea-talk on request · English support available',
      ja: '予約時に茶談可・英語サポート',
      zh: '预约可茶谈·提供英文协助',
    },
    emoji: '🧘',
  },
  {
    match: ['부석사'],
    role: { ko: '관리 종무소', en: 'Temple office', ja: '寺務所', zh: '寺务所' },
    bio: {
      ko: '국보 무량수전·조사당·소조여래좌상 셋이 한자리에 있는 천년 사찰의 살림을 맡습니다.',
      en: 'Stewards of a millennium-old temple holding three National Treasures together.',
      ja: '国宝・無量寿殿、祖師堂、塑造如来坐像が一堂に揃う千年寺院の運営を担います。',
      zh: '掌管同时拥有三件国宝的千年古刹的运营。',
    },
    meeting: {
      ko: '단체 예약 시 영문 가이드 가능',
      en: 'English guide for group bookings',
      ja: '団体予約で英語ガイド対応',
      zh: '团体预约可提供英文导览',
    },
    emoji: '🪷',
  },
  {
    match: ['도산서원'],
    role: { ko: '관리사무소 / 도산서원 운영위원회', en: 'Dosan Seowon committee', ja: '陶山書院運営委員会', zh: '陶山书院运营委员会' },
    bio: {
      ko: '퇴계 이황(1501-1570)이 후학을 가르치던 자리. 후손과 지역 학자들이 학문의 결을 잇습니다.',
      en: 'Where Yi Hwang (1501–1570) taught his students. Descendants and local scholars continue his line.',
      ja: '退渓・李滉(1501-1570)が後学を教えた場所。後孫と地域の学者が学風を継いでいます。',
      zh: '退溪李滉(1501-1570)讲学之地,后裔与地方学者承其学脉。',
    },
    meeting: {
      ko: '주말 한문 강독회 일부 공개',
      en: 'Some classical Korean readings open weekends',
      ja: '週末の漢文講読会の一部公開',
      zh: '部分周末汉文讲读会公开',
    },
    emoji: '📜',
  },
  {
    match: ['병산서원'],
    role: { ko: '풍산 류씨 종가 · 만대루지기', en: 'Pungsan Ryu head house · Mandaeru keeper', ja: '豊山柳氏宗家・晩対楼の守り', zh: '丰山柳氏宗家·晚对楼守护' },
    bio: {
      ko: '서애 류성룡 선생의 학풍을 잇는 풍산 류씨 종가. 만대루에 앉으면 강물과 산이 한 폭으로 보입니다.',
      en: 'The Pungsan Ryu lineage continuing the scholarship of Ryu Seong-ryong. From Mandaeru, river and mountain become one frame.',
      ja: '西厓・柳成龍の学風を継ぐ豊山柳氏宗家。晩対楼に座ると川と山が一幅の絵になります。',
      zh: '承袭西厓柳成龙学风的丰山柳氏宗家。坐在晚对楼,江山尽收一幅画中。',
    },
    emoji: '🏞️',
  },
  {
    match: ['하회마을'],
    role: { ko: '풍산 류씨 종부', en: 'Pungsan Ryu head matriarch', ja: '豊山柳氏宗婦', zh: '丰山柳氏宗妇' },
    bio: {
      ko: '550년 종가의 살림을 잇는 종부. 종갓집 한식상과 차 한 잔으로 마을의 시간을 이야기합니다.',
      en: '550 years of household stewardship. Through the family table and a cup of tea, she tells the village\'s time.',
      ja: '550年宗家の家計を継ぐ宗婦。宗家の食卓と一杯の茶で村の時間を語ります。',
      zh: '承续550年宗家家务的宗妇,以家宴与一盏茶讲述村落岁月。',
    },
    meeting: {
      ko: '한식 체험은 사전 예약',
      en: 'Hanjeongsik experience by prior booking',
      ja: '韓定食体験は事前予約',
      zh: '韩定食体验需提前预约',
    },
    emoji: '🍵',
  },
  {
    match: ['임청각'],
    role: { ko: '독립운동가 종손가', en: 'Independence activist lineage', ja: '独立運動家の宗孫家', zh: '独立运动家宗孙家' },
    bio: {
      ko: '석주 이상룡 선생을 비롯해 9명의 독립유공자를 배출한 99칸 고택. 종손이 직접 안내하기도 합니다.',
      en: 'A 99-bay hanok that produced nine independence patriots, including Yi Sang-ryong. The current head sometimes guides in person.',
      ja: '石洲・李相竜先生をはじめ9名の独立有功者を輩出した99間古宅。宗孫が直接案内することもあります。',
      zh: '诞生9位独立有功者(含石洲李相龙)的99间古宅,现任宗孙偶尔亲自导览。',
    },
    emoji: '🇰🇷',
  },
  {
    match: ['송소고택'],
    role: { ko: '청송 심씨 9대 종손', en: 'Cheongsong Sim 9th-gen heir', ja: '青松沈氏9代宗孫', zh: '青松沈氏9代宗孙' },
    bio: {
      ko: '99칸 부유한 영남 종택의 9대 종손이 한옥 1박 체험을 직접 운영합니다. 야간 마당의 별이 깊어요.',
      en: 'The 9th-generation heir personally runs hanok-stay in this 99-bay Yeongnam manor. The night sky in the courtyard is unforgettable.',
      ja: '99間の裕福な嶺南宗宅の9代宗孫が韓屋一泊体験を自ら運営します。庭から見上げる夜空は格別。',
      zh: '99间富裕岭南宗宅的第9代宗孙亲自经营韩屋住宿,庭院夜空格外深邃。',
    },
    meeting: {
      ko: '1박 체험 시 종손 차담',
      en: 'Tea with the heir during overnight stay',
      ja: '一泊滞在で宗孫との茶談',
      zh: '入住可与宗孙茶谈',
    },
    emoji: '🌌',
  },
  {
    match: ['무섬마을'],
    role: { ko: '반남 박씨 / 선성 김씨 종가', en: 'Bannam Park · Seonseong Kim houses', ja: '潘南朴氏・宣城金氏宗家', zh: '潘南朴氏·宣城金氏宗家' },
    bio: {
      ko: '내성천 외나무다리로 알려진 영주 무섬마을. 두 종가가 350년 마을을 함께 지킵니다.',
      en: 'Yeongju\'s Museom Village, famous for its single-log bridge over Naeseongcheon. Two head houses have kept the village together for 350 years.',
      ja: '内城川の一本橋で知られる栄州・茂湿村。二つの宗家が350年の村を共に守っています。',
      zh: '以内城川独木桥闻名的荣州茂湿村,两座宗家共同守护350年的村落。',
    },
    emoji: '🌉',
  },
  {
    match: ['문경', '도자기'],
    role: { ko: '중요무형문화재 사기장 전수자', en: 'Master potter — Intangible Heritage holder', ja: '重要無形文化財・陶磁器伝承者', zh: '重要无形文化遗产·陶艺传承者' },
    bio: {
      ko: '문경 망댕이가마. 흙·물·불·시간 — 네 요소를 다루는 사기장의 5대 가업.',
      en: 'Mungyeong\'s mangdaengi kiln. Five generations working with earth, water, fire, and time.',
      ja: '聞慶のマンデンイ窯。土・水・火・時間 — 五代にわたる陶工の家業。',
      zh: '闻庆望灯窑,土·水·火·时间——传承五代的陶艺家业。',
    },
    meeting: {
      ko: '체험 예약 시 가마 견학 + 차 한 잔',
      en: 'Kiln tour and tea included with workshop booking',
      ja: '体験予約で窯見学と茶',
      zh: '预约体验含窑场参观与茶',
    },
    emoji: '🏺',
  },
  {
    match: ['하회별신굿'],
    role: { ko: '국가무형문화재 하회별신굿탈놀이 보존회', en: 'Hahoe Mask Dance Preservation Society', ja: '河回別神クッ仮面踊保存会', zh: '河回别神巫面舞保存会' },
    bio: {
      ko: '국가무형문화재 제69호. 600년 마을굿 전통을 잇는 보존회가 정기 공연을 운영합니다.',
      en: 'Intangible Heritage #69. The preservation society stages regular performances of a 600-year village ritual.',
      ja: '国家無形文化財第69号。600年の村クッ伝統を継ぐ保存会が定期公演を運営。',
      zh: '国家无形文化遗产第69号,保存会承袭600年村巫传统,定期公演。',
    },
    emoji: '🎭',
  },
]

export function findKeeper(placeName: string): Keeper | undefined {
  if (!placeName) return undefined
  return KEEPERS.find((k) => k.match.every((m) => placeName.includes(m)))
}
