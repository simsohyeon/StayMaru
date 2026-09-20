import type { CategoryId, Lang, Place } from '../types/domain'

/**
 * TourAPI 응답 항목 → Place 매핑 + 카테고리 추론 — 순수 함수만.
 *
 * api/tour.ts 에서 분리한 이유: 서버(api/course.ts)가 DB 에 적재된 TourAPI 원본 항목을 같은 규칙으로
 * Place 로 바꿔 코스 엔진에 넣어야 한다. api/tour.ts 는 axios·IndexedDB 캐시·import.meta.env 를 쓰는
 * 브라우저 전용 모듈이라 서버 번들에 실을 수 없다. (상대 경로 import 도 같은 이유 — 서버 번들러는 `@/` 를 모른다.)
 */

export interface TourApiItem {
  contentid?: string
  contenttypeid?: string
  title?: string
  addr1?: string
  firstimage?: string
  firstimage2?: string
  mapx?: string
  mapy?: string
  areacode?: string
  sigungucode?: string
  tel?: string
  homepage?: string
  overview?: string
  eventstartdate?: string
  eventenddate?: string
  usetime?: string
  /** 응답에 함께 오는 분류 코드 (글로벌 필터에 사용) */
  cat1?: string
  cat2?: string
  cat3?: string
}

/**
 * 전통문화 여행 취지와 어긋나는 항목을 응답 단계에서 차단한다.
 * 숙박(contentTypeId=32)은 한옥(cat3=B02011600) 외 제외하고, 분류가 잘못된 데이터를 대비해
 * 제목 키워드(글램핑·풀빌라·모텔·카지노 류)로 한 번 더 거른다.
 */
const EXCLUDE_TITLE_RE = /글램|GLAMPING|풀빌라|풀 ?빌라|캠핑|모텔|리조트|카지노/i

export function isAllowedItem(it: TourApiItem): boolean {
  const ct = Number(it.contenttypeid ?? 0)
  if (ct === 32 && it.cat3 !== 'B02011600') return false
  const title = it.title ?? ''
  if (EXCLUDE_TITLE_RE.test(title)) return false
  return true
}

/**
 * overview 류 자유 텍스트의 HTML 정리 — 실 API 는 `<br>`·`&nbsp;`·`<p>` 를 흔히 담아 보낸다.
 * 줄바꿈은 살리고(white-space: pre-line 로 렌더) 나머지 태그·엔티티는 걷어낸다.
 */
export function cleanHtml(s?: string): string | undefined {
  if (!s) return undefined
  const text = s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text || undefined
}

export function mapToPlace(item: TourApiItem, category: CategoryId, lang: Lang): Place {
  const lng = Number(item.mapx ?? 0)
  const lat = Number(item.mapy ?? 0)
  return {
    id: item.contentid ?? `unknown-${Math.random()}`,
    contentTypeId: Number(item.contenttypeid ?? 0),
    category,
    name: item.title ?? '',
    address: item.addr1 ?? '',
    sigunguCode: item.sigungucode ? Number(item.sigungucode) : undefined,
    position: { lat, lng },
    thumbnail: forceHttps(item.firstimage || item.firstimage2 || undefined),
    overview: cleanHtml(item.overview),
    tel: item.tel,
    homepage: extractHomepage(item.homepage),
    openHours: item.usetime,
    lang,
  }
}

/** 이미지 CDN 은 https 를 지원하지만 응답은 http 로 온다 — mixed content 차단을 피해 강제 변환. */
export function forceHttps(url?: string): string | undefined {
  if (!url) return undefined
  return url.replace(/^http:\/\//i, 'https://')
}

export function extractHomepage(raw?: string): string | undefined {
  if (!raw) return undefined
  const m = raw.match(/href="([^"]+)"/i)
  return m?.[1] ?? raw
}

/** cat3(소분류) → 카테고리. TourAPI 분류표 기준 — 이름 규칙보다 먼저 본다. */
const CAT3_CATEGORY: Record<string, CategoryId> = {
  B02011600: 'hanok',      // 숙박 > 한옥
  A02010400: 'hanok',      // 역사관광지 > 고택
  A02010800: 'temple',     // 역사관광지 > 사찰
  A02030200: 'experience', // 체험 > 전통체험
  A02030100: 'experience', // 체험 > 농·산·어촌 체험
  A02030300: 'experience', // 체험 > 산사체험
  A02030400: 'experience', // 체험 > 이색체험(공방 등) — 글램핑류는 isAllowedItem 에서 걸러짐
  A04010100: 'market',     // 쇼핑 > 5일장
  A04010200: 'market',     // 쇼핑 > 상설시장
  A02080100: 'trail',      // 레포츠 > 산림욕장 (둘레길 다수 등록)
  A03020400: 'trail',      // 레포츠 > 자연생태관광지 (탐방로)
}
const TRAIL_RE = /둘레길|탐방로|산책로|숲길|옛길|올레|자전거길|트레킹/
const TEMPLE_RE = /[가-힣][사암](?:\s|\(|$)|사찰/

/**
 * 응답 항목의 카테고리 추론 — contentType(명확한 것) → cat3(분류표) → 이름 규칙 → attraction.
 * 이름 규칙을 앞에 두면 "서악서원 한옥스테이"(숙박 32)가 서원으로 잡히는 식의 오분류가 난다.
 */
export function inferCategory(item: TourApiItem): CategoryId {
  const id = Number(item.contenttypeid ?? 0)
  const title = item.title ?? ''
  const cat3 = item.cat3 ?? ''
  // 1) contentType 이 곧 카테고리인 것
  if (id === 15) return 'festival'
  if (id === 38) return 'market'
  if (id === 39) return 'restaurant'
  if (id === 32) return 'hanok' // 숙박은 한옥(B02011600)만 isAllowedItem 을 통과한다
  // 2) 템플스테이는 사찰 소속 프로그램 — 명시어가 있을 때만 (cat3 는 사찰과 같다)
  if (title.includes('템플스테이')) return 'templestay'
  // 3) cat3 분류표
  const byCat3 = CAT3_CATEGORY[cat3]
  if (byCat3) return byCat3
  if (cat3.startsWith('A0203')) return 'experience' // 그 외 체험 소분류
  if (cat3.startsWith('A0401')) return 'market'
  // 4) 이름 규칙 — 서원(별도 cat3 없음), 사찰 어말, 둘레길류, 한옥·고택
  if (title.includes('서원') || title.includes('향교')) return 'seowon'
  if (id === 12 && TEMPLE_RE.test(title)) return 'temple'
  if (TRAIL_RE.test(title)) return 'trail'
  if (title.includes('한옥') || title.includes('고택') || title.includes('종택')) return 'hanok'
  // 5) 문화시설·레포츠는 체험형으로
  if (id === 14 || id === 28) return 'experience'
  return 'attraction'
}
