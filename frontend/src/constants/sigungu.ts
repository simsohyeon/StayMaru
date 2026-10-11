import type { Sigungu } from '../types/domain.js'

/**
 * 경상북도 시군구 — areaCode = 35.
 * sigunguCode 는 areaCode2 API 실제 응답값 기준.
 *
 * 참고:
 *  - 2023년 7월 군위군이 대구광역시로 편입돼 제외됨 → 22개 시군구.
 *  - code=5 는 결번 (군위 자리). API 응답에도 누락되어 있다.
 *
 * 여기 있는 값은 전부 "조회에 쓰는 식별자"다 — 추정치는 두지 않는다.
 *   ldong        : 법정동 시군구 코드. 데이터랩 방문자·연관 추천 조회 키.
 *   gridX/gridY  : 기상청 단기예보 격자 좌표. 각 시군 대표지점(주로 시·군청) 기준.
 *
 * 한적함·방문 규모 같은 판단값은 상수로 두지 않고 관광 데이터랩 실방문자 통계에서 얻는다
 * (api/sync-visits.ts 적재 → /api/visits → lib/visitorIndex.ts).
 */
export const SIGUNGUS: Sigungu[] = [
  { code: 1,  slug: 'gyeongsan',  ko: '경산시',   en: 'Gyeongsan',  ja: '慶山市',   zh: '庆山市',   ldong: ['47290'], gridX: 91, gridY: 90 },
  { code: 2,  slug: 'gyeongju',   ko: '경주시',   en: 'Gyeongju',   ja: '慶州市',   zh: '庆州市',   ldong: ['47130'], gridX: 100, gridY: 91 },
  { code: 3,  slug: 'goryeong',   ko: '고령군',   en: 'Goryeong',   ja: '高霊郡',   zh: '高灵郡',   ldong: ['47830'], gridX: 83, gridY: 87 },
  { code: 4,  slug: 'gumi',       ko: '구미시',   en: 'Gumi',       ja: '亀尾市',   zh: '龟尾市',   ldong: ['47190'], gridX: 84, gridY: 96 },
  { code: 6,  slug: 'gimcheon',   ko: '김천시',   en: 'Gimcheon',   ja: '金泉市',   zh: '金泉市',   ldong: ['47150'], gridX: 80, gridY: 96 },
  { code: 7,  slug: 'mungyeong',  ko: '문경시',   en: 'Mungyeong',  ja: '聞慶市',   zh: '闻庆市',   ldong: ['47280'], gridX: 81, gridY: 106 },
  { code: 8,  slug: 'bonghwa',    ko: '봉화군',   en: 'Bonghwa',    ja: '奉化郡',   zh: '奉化郡',   ldong: ['47920'], gridX: 90, gridY: 109 },
  { code: 9,  slug: 'sangju',     ko: '상주시',   en: 'Sangju',     ja: '尚州市',   zh: '尚州市',   ldong: ['47250'], gridX: 81, gridY: 102 },
  { code: 10, slug: 'seongju',    ko: '성주군',   en: 'Seongju',    ja: '星州郡',   zh: '星州郡',   ldong: ['47840'], gridX: 83, gridY: 91 },
  { code: 11, slug: 'andong',     ko: '안동시',   en: 'Andong',     ja: '安東市',   zh: '安东市',   ldong: ['47170'], gridX: 91, gridY: 106 },
  { code: 12, slug: 'yeongdeok',  ko: '영덕군',   en: 'Yeongdeok',  ja: '盈徳郡',   zh: '盈德郡',   ldong: ['47770'], gridX: 102, gridY: 103 },
  { code: 13, slug: 'yeongyang',  ko: '영양군',   en: 'Yeongyang',  ja: '英陽郡',   zh: '英阳郡',   ldong: ['47760'], gridX: 97, gridY: 108 },
  { code: 14, slug: 'yeongju',    ko: '영주시',   en: 'Yeongju',    ja: '栄州市',   zh: '荣州市',   ldong: ['47210'], gridX: 89, gridY: 111 },
  { code: 15, slug: 'yeongcheon', ko: '영천시',   en: 'Yeongcheon', ja: '永川市',   zh: '永川市',   ldong: ['47230'], gridX: 95, gridY: 93 },
  { code: 16, slug: 'yecheon',    ko: '예천군',   en: 'Yecheon',    ja: '醴泉郡',   zh: '醴泉郡',   ldong: ['47900'], gridX: 86, gridY: 107 },
  { code: 17, slug: 'ulleung',    ko: '울릉군',   en: 'Ulleung',    ja: '鬱陵郡',   zh: '郁陵郡',   ldong: ['47940'], gridX: 127, gridY: 127 },
  { code: 18, slug: 'uljin',      ko: '울진군',   en: 'Uljin',      ja: '蔚珍郡',   zh: '蔚珍郡',   ldong: ['47930'], gridX: 102, gridY: 115 },
  { code: 19, slug: 'uiseong',    ko: '의성군',   en: 'Uiseong',    ja: '義城郡',   zh: '义城郡',   ldong: ['47730'], gridX: 90, gridY: 101 },
  { code: 20, slug: 'cheongdo',   ko: '청도군',   en: 'Cheongdo',   ja: '清道郡',   zh: '清道郡',   ldong: ['47820'], gridX: 91, gridY: 86 },
  { code: 21, slug: 'cheongsong', ko: '청송군',   en: 'Cheongsong', ja: '青松郡',   zh: '青松郡',   ldong: ['47750'], gridX: 96, gridY: 103 },
  { code: 22, slug: 'chilgok',    ko: '칠곡군',   en: 'Chilgok',    ja: '漆谷郡',   zh: '漆谷郡',   ldong: ['47850'], gridX: 85, gridY: 93 },
  { code: 23, slug: 'pohang',     ko: '포항시',   en: 'Pohang',     ja: '浦項市',   zh: '浦项市',   ldong: ['47111', '47113'], gridX: 102, gridY: 94 },
]

export const GB_AREA_CODE = 35

/** 경상북도 법정동 시도 코드 — 빅데이터 서비스의 areaCd. */
export const GB_LDONG_AREA_CD = '47'

/** 법정동 시군구 코드 → sigunguCode 역매핑. 포항 47111/47113 → 23. */
export const LDONG_TO_SIGUNGU: Record<string, number> = Object.fromEntries(
  SIGUNGUS.flatMap((sg) => sg.ldong.map((l) => [l, sg.code] as const)),
)

/** 경상북도 대략 경계(울릉·독도 포함, 접경 여유 0.1°). 내 주변 검색이 의미 있는 위치인지 판별용. */
export const GB_BOUNDS = { minLat: 35.45, maxLat: 37.65, minLng: 127.65, maxLng: 131.95 } as const
export function isInGyeongbuk(p: { lat: number; lng: number }): boolean {
  return p.lat >= GB_BOUNDS.minLat && p.lat <= GB_BOUNDS.maxLat && p.lng >= GB_BOUNDS.minLng && p.lng <= GB_BOUNDS.maxLng
}

export function findSigungu(code: number) {
  return SIGUNGUS.find((s) => s.code === code)
}
