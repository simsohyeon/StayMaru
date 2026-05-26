import type { Sigungu } from '@/types/domain'

/**
 * 경상북도 시군구 — 관광공사 areaCode = 35.
 * sigunguCode 는 한국관광공사 areaCode2 API 실제 응답값 기준 (areaCode2?areaCode=35).
 *
 * 참고:
 *  - 2023년 7월부터 군위군이 대구광역시로 편입되어 관광공사 데이터에서 제외됨 → 22개 시군구.
 *  - code=5 는 결번 (군위 자리). API 응답에도 누락되어 있다.
 *
 * hiddenBoost: 시군구별 관광지 수가 적을수록 큰 값(0~1).
 *   FR-04 '숨겨진 경북 코스' 모드에서 점수 가중치로 활용.
 *
 * populationDensity (명/km²) — 통계청 2023 기준 근사값.
 *   Slow Travel Index 한적 지수(quietScore) 계산에 사용. 작을수록 한적.
 *
 * gridX/gridY — 기상청 단기예보 격자 좌표. 각 시군 대표지점(주로 시·군청) 기준.
 *   비 오는 날 코스 재조정 (실내 체험 가중치↑) 시 활용.
 */
export const SIGUNGUS: Sigungu[] = [
  { code: 1,  slug: 'gyeongsan',  ko: '경산시',   en: 'Gyeongsan',  ja: '慶山市',   zh: '庆山市',   hiddenBoost: 0.2, populationDensity: 1107, gridX: 91, gridY: 90 },
  { code: 2,  slug: 'gyeongju',   ko: '경주시',   en: 'Gyeongju',   ja: '慶州市',   zh: '庆州市',   hiddenBoost: 0.0, populationDensity: 199,  gridX: 100, gridY: 91 },
  { code: 3,  slug: 'goryeong',   ko: '고령군',   en: 'Goryeong',   ja: '高霊郡',   zh: '高灵郡',   hiddenBoost: 0.7, populationDensity: 49,   gridX: 83, gridY: 87 },
  { code: 4,  slug: 'gumi',       ko: '구미시',   en: 'Gumi',       ja: '亀尾市',   zh: '龟尾市',   hiddenBoost: 0.1, populationDensity: 1170, gridX: 84, gridY: 96 },
  { code: 6,  slug: 'gimcheon',   ko: '김천시',   en: 'Gimcheon',   ja: '金泉市',   zh: '金泉市',   hiddenBoost: 0.4, populationDensity: 99,   gridX: 80, gridY: 96 },
  { code: 7,  slug: 'mungyeong',  ko: '문경시',   en: 'Mungyeong',  ja: '聞慶市',   zh: '闻庆市',   hiddenBoost: 0.5, populationDensity: 63,   gridX: 81, gridY: 106 },
  { code: 8,  slug: 'bonghwa',    ko: '봉화군',   en: 'Bonghwa',    ja: '奉化郡',   zh: '奉化郡',   hiddenBoost: 0.9, populationDensity: 29,   gridX: 90, gridY: 109 },
  { code: 9,  slug: 'sangju',     ko: '상주시',   en: 'Sangju',     ja: '尚州市',   zh: '尚州市',   hiddenBoost: 0.4, populationDensity: 64,   gridX: 81, gridY: 102 },
  { code: 10, slug: 'seongju',    ko: '성주군',   en: 'Seongju',    ja: '星州郡',   zh: '星州郡',   hiddenBoost: 0.7, populationDensity: 70,   gridX: 83, gridY: 91 },
  { code: 11, slug: 'andong',     ko: '안동시',   en: 'Andong',     ja: '安東市',   zh: '安东市',   hiddenBoost: 0.0, populationDensity: 78,   gridX: 91, gridY: 106 },
  { code: 12, slug: 'yeongdeok',  ko: '영덕군',   en: 'Yeongdeok',  ja: '盈徳郡',   zh: '盈德郡',   hiddenBoost: 0.5, populationDensity: 50,   gridX: 102, gridY: 103 },
  { code: 13, slug: 'yeongyang',  ko: '영양군',   en: 'Yeongyang',  ja: '英陽郡',   zh: '英阳郡',   hiddenBoost: 0.9, populationDensity: 19,   gridX: 97, gridY: 108 },
  { code: 14, slug: 'yeongju',    ko: '영주시',   en: 'Yeongju',    ja: '栄州市',   zh: '荣州市',   hiddenBoost: 0.2, populationDensity: 89,   gridX: 89, gridY: 111 },
  { code: 15, slug: 'yeongcheon', ko: '영천시',   en: 'Yeongcheon', ja: '永川市',   zh: '永川市',   hiddenBoost: 0.4, populationDensity: 161,  gridX: 95, gridY: 93 },
  { code: 16, slug: 'yecheon',    ko: '예천군',   en: 'Yecheon',    ja: '醴泉郡',   zh: '醴泉郡',   hiddenBoost: 0.6, populationDensity: 78,   gridX: 86, gridY: 107 },
  { code: 17, slug: 'ulleung',    ko: '울릉군',   en: 'Ulleung',    ja: '鬱陵郡',   zh: '郁陵郡',   hiddenBoost: 0.8, populationDensity: 79,   gridX: 127, gridY: 127 },
  { code: 18, slug: 'uljin',      ko: '울진군',   en: 'Uljin',      ja: '蔚珍郡',   zh: '蔚珍郡',   hiddenBoost: 0.6, populationDensity: 50,   gridX: 102, gridY: 115 },
  { code: 19, slug: 'uiseong',    ko: '의성군',   en: 'Uiseong',    ja: '義城郡',   zh: '义城郡',   hiddenBoost: 0.6, populationDensity: 33,   gridX: 90, gridY: 101 },
  { code: 20, slug: 'cheongdo',   ko: '청도군',   en: 'Cheongdo',   ja: '清道郡',   zh: '清道郡',   hiddenBoost: 0.5, populationDensity: 56,   gridX: 91, gridY: 86 },
  { code: 21, slug: 'cheongsong', ko: '청송군',   en: 'Cheongsong', ja: '青松郡',   zh: '青松郡',   hiddenBoost: 0.8, populationDensity: 27,   gridX: 96, gridY: 103 },
  { code: 22, slug: 'chilgok',    ko: '칠곡군',   en: 'Chilgok',    ja: '漆谷郡',   zh: '漆谷郡',   hiddenBoost: 0.5, populationDensity: 252,  gridX: 85, gridY: 93 },
  { code: 23, slug: 'pohang',     ko: '포항시',   en: 'Pohang',     ja: '浦項市',   zh: '浦项市',   hiddenBoost: 0.0, populationDensity: 870,  gridX: 102, gridY: 94 },
]

export const GB_AREA_CODE = 35

export function findSigungu(code: number) {
  return SIGUNGUS.find((s) => s.code === code)
}
