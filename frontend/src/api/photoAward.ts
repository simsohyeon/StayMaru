import { cachedFetch } from '@/lib/cache'

/**
 * 한국관광공사_관광공모전(사진) 수상작 — PhokoAwrdService.
 *
 * 엔드포인트: {PROXY_BASE}/PhokoAwrdService/phokoAwrdList
 *   dev  : vite.config.ts 프록시가 serviceKey 주입
 *   운영 : api/tour.ts (Vercel Edge) 가 동일하게 주입
 *
 * 전체 95건(2024 공모전) 중 경상북도는 `lDongRegnCd === '47'` 15건.
 * 시도 코드가 있어 촬영지 문자열 파싱 없이 정확히 걸러진다.
 *
 * 이미지: orgImage 가로 940px(세로형은 693×940), thumbImage 300px.
 *   - HEAD 요청은 405 로 막혀 있어 사전 검증 불가 → <img> 로 바로 쓴다.
 *   - 940px 라 데스크톱 히어로(1440)에서는 업스케일된다. 어두운 오버레이로 완화.
 *
 * 저작권: 전 건 `cpyrhtDivCd: 'Type1'`(공공누리 제1유형) — 상업적 이용·변형 가능하되
 *   **출처 표시 의무**가 있다. 화면에 촬영자명과 공모전명을 반드시 노출할 것.
 */

const PROXY_BASE = (import.meta.env.VITE_TOUR_PROXY_BASE as string | undefined) || '/api/tour'

/** 경상북도 법정동 시도 코드. */
const GYEONGBUK_REGION_CODE = '47'

/** 하루 1회면 충분 — 공모전 수상작은 연 단위로만 갱신된다. */
const TTL_MS = 24 * 60 * 60 * 1000

/** API 원본 아이템 (필요한 필드만). */
interface RawAwardPhoto {
  contentId?: string
  koTitle?: string
  lDongRegnCd?: string | number
  koFilmst?: string
  filmDay?: string
  koCmanNm?: string
  koWnprzDiz?: string
  orgImage?: string
  thumbImage?: string
  cpyrhtDivCd?: string
}

export interface AwardPhoto {
  id: string
  /** 작품명 */
  title: string
  /** 촬영지 원문 (예: "경상북도 안동시 풍천면, 안동하회마을") */
  location: string
  /** 촬영지에서 뽑은 시군명 (예: "안동시"). 매칭 실패 시 빈 문자열. */
  sigungu: string
  /** 촬영자 — 공공누리 1유형 출처 표시에 필수 */
  photographer: string
  /** 수상 부문 (예: "드론 부문 [금상]") */
  award: string
  /** 금상/대상 등 상위 수상작이면 true — 히어로 우선 배치에 사용 */
  isTop: boolean
  /** 940px 원본 */
  image: string
  /** 300px 썸네일 */
  thumb: string
}

/** "ⓒ 촬영자 · 2024 대한민국 관광공모전" — 공공누리 1유형 출처 표시 문구. */
export function attribution(p: AwardPhoto): string {
  return `ⓒ ${p.photographer} · 2024 대한민국 관광공모전(사진)`
}

function toSigungu(koFilmst: string): string {
  // "경상북도 안동시 풍천면, 안동하회마을" → "안동시"
  const m = koFilmst.replace(/^경상북도\s*/, '').match(/^([가-힣]+[시군구])/)
  return m?.[1] ?? ''
}

function normalize(raw: RawAwardPhoto): AwardPhoto | null {
  const image = raw.orgImage?.trim()
  if (!image || !raw.contentId) return null
  const award = raw.koWnprzDiz?.trim() ?? ''
  return {
    id: String(raw.contentId),
    title: raw.koTitle?.trim() ?? '',
    location: raw.koFilmst?.trim() ?? '',
    sigungu: toSigungu(raw.koFilmst?.trim() ?? ''),
    photographer: raw.koCmanNm?.trim() ?? '',
    award,
    isTop: /대상|금상/.test(award),
    image,
    thumb: raw.thumbImage?.trim() || image,
  }
}

/**
 * 경상북도 수상작 사진 목록. 실패하면 빈 배열 — 호출부는 그라데이션 폴백을 유지한다.
 * 총 95건뿐이라 페이지네이션 없이 한 번에 받는다.
 */
export async function fetchGyeongbukAwardPhotos(): Promise<AwardPhoto[]> {
  return cachedFetch<AwardPhoto[]>(
    'photo-award:gb:v1',
    async () => {
      const url = new URL(`${PROXY_BASE}/PhokoAwrdService/phokoAwrdList`, window.location.origin)
      url.searchParams.set('MobileOS', 'ETC')
      url.searchParams.set('MobileApp', 'Shimmaru')
      url.searchParams.set('_type', 'json')
      url.searchParams.set('numOfRows', '200')
      url.searchParams.set('pageNo', '1')

      const res = await fetch(url.toString().replace(window.location.origin, ''))
      if (!res.ok) return []
      const json: unknown = await res.json()

      const items = (json as {
        response?: { body?: { items?: { item?: RawAwardPhoto[] } } }
      })?.response?.body?.items?.item
      if (!Array.isArray(items)) return []

      return items
        .filter((i) => String(i.lDongRegnCd) === GYEONGBUK_REGION_CODE)
        .map(normalize)
        .filter((p): p is AwardPhoto => p !== null)
    },
    TTL_MS,
    // 빈 배열(장애/미승인)은 캐시하지 않아 다음 방문에 다시 시도한다.
    (v) => v.length > 0,
  )
}

/** 시군명으로 한 장 고른다. 없으면 undefined. */
export function pickBySigungu(
  photos: AwardPhoto[],
  sigunguName: string,
  used: Set<string> = new Set(),
): AwardPhoto | undefined {
  return photos.find((p) => p.sigungu === sigunguName && !used.has(p.id))
}
