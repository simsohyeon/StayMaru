import type { Course, CourseItem, Place } from '@/types/domain'
import { isKakaoShareConfigured, shareViaKakao } from './kakaoShare'

/**
 * FR-11 — 코스 공유 링크. 백엔드가 없어 코스 JSON 을 base64url 로 URL 에 담는다.
 * overview/images/tags 같은 큰 필드는 빼도 받는 쪽이 id 로 detail 을 다시 부를 수 있어 제외한다.
 */

/** TourAPI 이미지 CDN 접두 — 장소마다 반복되는 ~45자를 토큰으로 접어 URL 길이를 줄인다. */
const THUMB_PREFIXES = [
  'https://tong.visitkorea.or.kr/cms/resource/',
  'http://tong.visitkorea.or.kr/cms/resource/',
]
const THUMB_TOKEN = '~t/'
function packThumb(u?: string): string | undefined {
  if (!u) return undefined
  for (const pre of THUMB_PREFIXES) if (u.startsWith(pre)) return THUMB_TOKEN + u.slice(pre.length)
  return u
}
function unpackThumb(u?: string): string | undefined {
  return u && u.startsWith(THUMB_TOKEN) ? THUMB_PREFIXES[0] + u.slice(THUMB_TOKEN.length) : u
}
const round5 = (n: number) => Math.round(n * 1e5) / 1e5

/**
 * 공유 페이로드에 필수적인 Place 필드만 추린다 — 좌표 5자리, 썸네일 접두 토큰화, lang 제외.
 * (카카오톡·SMS 는 긴 URL 을 잘라내므로 3천 자 → 2천 자 안쪽을 목표로 한다.)
 */
function slimPlace(p: Place): Place {
  return {
    id: p.id,
    contentTypeId: p.contentTypeId,
    category: p.category,
    name: p.name,
    address: p.address,
    sigunguCode: p.sigunguCode,
    position: { lat: round5(p.position.lat), lng: round5(p.position.lng) },
    thumbnail: packThumb(p.thumbnail),
  }
}

function slimItem(it: CourseItem): CourseItem {
  return { place: slimPlace(it.place), order: it.order, distanceFromPrevKm: it.distanceFromPrevKm }
}

/* base64url ↔ bytes */
function toB64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}
function fromB64Url(s: string): Uint8Array {
  const b64 = s.replaceAll('-', '+').replaceAll('_', '/')
  const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const bin = atob(pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** gzip — CompressionStream 미지원 환경(구형 WebView)이면 null 을 돌려 평문 인코딩으로 폴백. */
async function gzip(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null
  try {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    return null
  }
}
async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/**
 * 페이로드 포맷 — `g.<base64url(gzip json)>` 또는 `p.<base64url(json)>`.
 * 접두 없는 구형 링크(base64url(json), 'ey' 로 시작)는 그대로 읽는다.
 * 한글 JSON 은 gzip 으로 절반 가까이 줄어 3천 자 링크가 1.5천 자 안쪽이 된다.
 */
export async function encodeShare(course: Course): Promise<string> {
  const slim: Course = {
    ...course,
    items: course.items.map(slimItem),
    baseCenter: course.baseCenter
      ? { lat: round5(course.baseCenter.lat), lng: round5(course.baseCenter.lng) }
      : undefined,
  }
  const bytes = new TextEncoder().encode(JSON.stringify(slim))
  const zipped = await gzip(bytes)
  return zipped ? `g.${toB64Url(zipped)}` : `p.${toB64Url(bytes)}`
}

export async function decodeShare(payload: string): Promise<Course | null> {
  try {
    let json: string
    if (payload.startsWith('g.')) {
      json = new TextDecoder().decode(await gunzip(fromB64Url(payload.slice(2))))
    } else if (payload.startsWith('p.')) {
      json = new TextDecoder().decode(fromB64Url(payload.slice(2)))
    } else {
      // 구형(접두 없음) — btoa(unescape(encodeURIComponent(json))) 의 역변환
      json = new TextDecoder().decode(fromB64Url(payload))
    }
    const obj: unknown = JSON.parse(json)
    // 변조/구버전 페이로드 방어 — 최소 구조 검증 후에만 Course 로 신뢰.
    if (
      !obj ||
      typeof obj !== 'object' ||
      !Array.isArray((obj as { items?: unknown }).items) ||
      typeof (obj as { id?: unknown }).id !== 'string'
    ) {
      return null
    }
    const course = obj as Course
    // 썸네일 접두 토큰 복원 (+ lang 은 받는 쪽 설정을 따른다)
    return {
      ...course,
      items: course.items.map((it) => ({
        ...it,
        place: { ...it.place, thumbnail: unpackThumb(it.place.thumbnail) },
      })),
    }
  } catch {
    return null
  }
}

export interface ShareArgs {
  title?: string
  text?: string
  url: string
  /** 카카오 Feed 템플릿용 대표 이미지 (https 필수). 없으면 OG 이미지로 폴백. */
  imageUrl?: string
}

export type ShareResult = 'shared' | 'kakao' | 'copied' | 'cancelled' | 'error'

/**
 * 통합 공유 헬퍼 — 모바일은 Web Share → 카카오 → 클립보드, 데스크탑은 카카오 → Web Share → 클립보드.
 * 모바일 OS 공유 시트에는 카카오톡이 들어있지만 Windows Chrome 의 navigator.share 에는 없어
 * 순서를 뒤집는다. 사용자가 시트를 직접 닫으면 폴백 없이 'cancelled'.
 */
export async function shareOrCopy(args: ShareArgs): Promise<ShareResult> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined
  if (!nav) return 'error'

  const navWithShare = nav as Navigator & { share?: (d: ShareData) => Promise<void> }
  const hasWebShare = typeof navWithShare.share === 'function'
  const hasKakao = isKakaoShareConfigured()

  // 모바일 ↔ 데스크탑 구분 — pointer:coarse 가 신뢰성 높음. 미지원 브라우저는 desktop 으로 간주.
  const isCoarse =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches

  const tryWebShare = async (): Promise<ShareResult | undefined> => {
    if (!hasWebShare) return undefined
    try {
      await navWithShare.share!({ title: args.title, text: args.text, url: args.url })
      return 'shared'
    } catch (e) {
      // AbortError 면 사용자 취소 — 다른 채널로 자동 폴백하지 않는다 (의도가 명확).
      const name = (e as { name?: string } | null)?.name
      if (name === 'AbortError') return 'cancelled'
      return undefined // 다른 에러는 폴백 가능
    }
  }

  const tryKakao = async (): Promise<ShareResult | undefined> => {
    if (!hasKakao) return undefined
    const ok = await shareViaKakao({
      title: args.title ?? args.url,
      description: args.text,
      imageUrl: args.imageUrl,
      url: args.url,
    })
    return ok ? 'kakao' : undefined
  }

  const chain = isCoarse ? [tryWebShare, tryKakao] : [tryKakao, tryWebShare]
  for (const step of chain) {
    const r = await step()
    if (r) return r
  }

  // 최종 폴백 — 클립보드.
  try {
    await nav.clipboard.writeText(args.url)
    return 'copied'
  } catch {
    return 'error'
  }
}

/**
 * shareOrCopy 결과를 i18n 토스트로 알린다. PlaceDetail/FestivalDetail/CourseResult 공통 사용.
 * `cancelled` 는 사용자 의도이므로 토스트 표시하지 않는다.
 */
export function toastForShareResult(
  result: ShareResult,
  t: (key: string) => string,
  pushToast: (
    msg: string,
    opts?: { type?: 'info' | 'success' | 'error' },
  ) => void,
): void {
  switch (result) {
    case 'kakao':
      pushToast(t('share.kakaoOk'), { type: 'success' })
      return
    case 'shared':
      pushToast(t('share.shareOk'), { type: 'success' })
      return
    case 'copied':
      pushToast(t('place.linkCopied'), { type: 'success' })
      return
    case 'error':
      pushToast(t('share.failed'), { type: 'error' })
      return
    case 'cancelled':
      return // 의도된 취소 — 알림 없음
  }
}
