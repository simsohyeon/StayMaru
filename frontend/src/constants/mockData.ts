import type { Festival, Place } from '@/types/domain'

/**
 * Mock 데이터 — 의도적으로 비어있음.
 *
 * 모든 장소·축제·사찰 데이터는 런타임 API 호출로만 가져온다:
 *  - 한국관광공사 OpenAPI(V2) — areaBasedList2, searchFestival2, detailCommon2, detailIntro2
 *  - 한국불교문화사업단 templestay.com — prgList.do HTML 파싱 (사찰 목록)
 *
 * 폴백 데이터는 두지 않는다. 키 누락/네트워크 실패 시 빈 화면 + 콘솔 경고로 알린다.
 * (이전 버전에는 안동 하회마을 등 mock 장소가 있었지만 모두 제거됨.)
 */
export const MOCK_PLACES: Place[] = []
export const MOCK_FESTIVALS: Festival[] = []

/** 위치를 모를 때 사용할 기본 좌표(안동시청 부근) — 지도 초기 센터 용도 */
export const DEFAULT_CENTER = { lat: 36.5685, lng: 128.7282 }
