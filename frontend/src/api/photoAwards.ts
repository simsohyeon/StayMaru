import axios from 'axios'
import { cachedFetch } from '@/lib/cache'
import { SIGUNGUS } from '@/constants/sigungu'
import type { Lang } from '@/types/domain'

/**
 * 대한민국 관광공모전(사진) 수상작 — 포토코리아(phoko.visitkorea.or.kr) 공개 데이터.
 * 공공데이터포털 15145706 · PhokoAwrdService/phokoAwrdSyncList.
 *
 * 기존 TourAPI 프록시(/api/tour → B551011)를 그대로 재사용한다 — serviceKey 는
 * dev proxy / Vercel edge function 이 주입(B551011 하위 전 서비스 공용).
 * 별도 활용신청 전에는 게이트웨이가 평문/에러코드를 주므로 빈 배열로 graceful 처리.
 *
 * 전국 96건 중 경상북도(법정동 시도코드 47)만 필터해 거점 비주얼로 노출한다.
 * cpyrhtDivCd=Type1(저작권 표시 조건) — 촬영자명 + 출처 표기 필수.
 */

const PROXY_BASE = (import.meta.env.VITE_TOUR_PROXY_BASE as string | undefined) || '/api/tour'
const GB_LDONG = '47'

export interface AwardPhoto {
  id: string
  title: string
  /** 촬영지 */
  place: string
  /** 수상 부문/등급 (예: "드론 부문 [금상]") */
  prize: string
  photographer: string
  thumbnail: string
  image: string
  sigunguCode?: number
}

interface RawAward {
  contentId?: string
  koTitle?: string
  enTitle?: string
  lDongRegnCd?: string
  koFilmst?: string
  enFilmst?: string
  koCmanNm?: string
  enCmanNm?: string
  koWnprzDiz?: string
  enWnprzDiz?: string
  orgImage?: string
  thumbImage?: string
}

interface AwardResponse {
  response?: {
    header?: { resultCode?: string; resultMsg?: string }
    body?: { items?: { item?: RawAward[] | RawAward } | string }
  }
}

const client = axios.create({ timeout: 9000, headers: { Accept: 'application/json' } })

function forceHttps(url?: string): string {
  if (!url) return ''
  return url.replace(/^http:\/\//i, 'https://')
}

/** koFilmst("경상북도 안동시 풍천면, 안동하회마을") → sigungu code. 못 찾으면 undefined. */
function guessSigungu(koFilmst: string): number | undefined {
  const m = koFilmst.match(/경상북도\s+(\S+?[시군])/)
  const key = m?.[1]
  if (!key) return undefined
  return SIGUNGUS.find((s) => s.ko === key)?.code
}

/** 경상북도 수상 사진 — 한 번 호출(전국)에서 47xx 만 필터. 갱신 빈도 낮아 24h 캐시. */
export async function fetchGyeongbukAwardPhotos(lang: Lang, limit = 12): Promise<AwardPhoto[]> {
  return cachedFetch(
    `photo-awards:gb:${lang}:n${limit}`,
    async () => {
      try {
        const url = `${PROXY_BASE}/PhokoAwrdService/phokoAwrdSyncList?MobileOS=ETC&MobileApp=Shimmaru&_type=json&numOfRows=100&pageNo=1`
        const { data } = await client.get<AwardResponse | string>(url, { validateStatus: () => true })
        if (typeof data === 'string') return []
        const code = data?.response?.header?.resultCode
        if (code && code !== '0000') return []
        const raw = data?.response?.body?.items
        if (!raw || typeof raw === 'string') return []
        const itemsRaw = raw.item
        const arr: RawAward[] = Array.isArray(itemsRaw) ? itemsRaw : itemsRaw ? [itemsRaw] : []
        const useEn = lang === 'en'
        return arr
          .filter((r) => r.lDongRegnCd === GB_LDONG)
          .map((r): AwardPhoto => ({
            id: r.contentId ?? '',
            title: (useEn ? r.enTitle : r.koTitle) || r.koTitle || '',
            place: (useEn ? r.enFilmst : r.koFilmst) || r.koFilmst || '',
            prize: (useEn ? r.enWnprzDiz : r.koWnprzDiz) || r.koWnprzDiz || '',
            photographer: (useEn ? r.enCmanNm : r.koCmanNm) || r.koCmanNm || '',
            thumbnail: forceHttps(r.thumbImage || r.orgImage),
            image: forceHttps(r.orgImage || r.thumbImage),
            sigunguCode: guessSigungu(r.koFilmst ?? ''),
          }))
          .filter((p) => p.thumbnail && p.title)
          .slice(0, limit)
      } catch {
        return []
      }
    },
    undefined,
    (r) => r.length > 0,
  )
}
