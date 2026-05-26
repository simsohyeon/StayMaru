import type { Lang, LatLng } from '@/types/domain'

/**
 * 경상북도 KTX/SRT 정차역 — 외국인 관광객의 실제 입구.
 *
 * 서울/수서에서 출발할 때 가장 먼저 부딪히는 결정이 "어느 역으로 가야 하나?" 이다.
 * 거점 시군구 칩만 보여주는 다른 코스앱과 달리, 쉼마루는 이 결정을 도와준다 —
 * 역을 누르면 인근 30분 이내 시군구가 거점으로 자동 채워진다.
 *
 * fromSeoulMinutes 는 최단 운행시간 근사값(예매 사이트 평균).
 */
export interface KtxStation {
  slug: string
  label: Record<Lang, string>
  /** 서울/수서 출발 최단 소요시간(분) */
  fromSeoulMinutes: number
  /** 이 역에서 30~40분 내 자가용/시외버스로 도달 가능한 시군구 코드 */
  nearby: number[]
  position: LatLng
  /** SRT 운행 여부 (KTX 만 있는 역은 false) */
  hasSrt: boolean
  /** KTX 이음 (강릉선 기반) 운행 — 영주·안동 */
  isEum: boolean
}

export const KTX_STATIONS: KtxStation[] = [
  {
    slug: 'dongdaegu',
    label: { ko: '동대구', en: 'Dongdaegu', ja: '東大邱', zh: '东大邱' },
    fromSeoulMinutes: 105,
    nearby: [1, 15, 20, 22], // 경산·영천·청도·칠곡
    position: { lat: 35.8797, lng: 128.6285 },
    hasSrt: true, isEum: false,
  },
  {
    slug: 'singyeongju',
    label: { ko: '신경주', en: 'Singyeongju', ja: '新慶州', zh: '新庆州' },
    fromSeoulMinutes: 130,
    nearby: [2, 15], // 경주·영천
    position: { lat: 35.7993, lng: 129.1369 },
    hasSrt: true, isEum: false,
  },
  {
    slug: 'gimcheon-gumi',
    label: { ko: '김천(구미)', en: 'Gimcheon-Gumi', ja: '金泉(亀尾)', zh: '金泉(龟尾)' },
    fromSeoulMinutes: 90,
    nearby: [6, 4, 22, 10], // 김천·구미·칠곡·성주
    position: { lat: 36.1107, lng: 128.1166 },
    hasSrt: true, isEum: false,
  },
  {
    slug: 'pohang',
    label: { ko: '포항', en: 'Pohang', ja: '浦項', zh: '浦项' },
    fromSeoulMinutes: 130,
    nearby: [23, 12], // 포항·영덕
    position: { lat: 36.0411, lng: 129.3641 },
    hasSrt: false, isEum: false,
  },
  {
    slug: 'andong',
    label: { ko: '안동(이음)', en: 'Andong (Eum)', ja: '安東(KTX-イウム)', zh: '安东(KTX-Eum)' },
    fromSeoulMinutes: 110,
    nearby: [11, 19, 16, 13], // 안동·의성·예천·영양
    position: { lat: 36.5750, lng: 128.7239 },
    hasSrt: false, isEum: true,
  },
  {
    slug: 'yeongju',
    label: { ko: '영주(이음)', en: 'Yeongju (Eum)', ja: '栄州(KTX-イウム)', zh: '荣州(KTX-Eum)' },
    fromSeoulMinutes: 130,
    nearby: [14, 8, 16], // 영주·봉화·예천
    position: { lat: 36.8095, lng: 128.6240 },
    hasSrt: false, isEum: true,
  },
]
