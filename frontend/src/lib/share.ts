import type { Course, CourseItem, Place } from '@/types/domain'
import { isKakaoShareConfigured, shareViaKakao } from './kakaoShare'

/**
 * FR-11 — 코스 공유 링크.
 * 백엔드 없는 MVP 단계에서는 코스 JSON을 base64url 인코딩해 URL 페이로드에 담는다.
 * 2차 단계에서 백엔드가 생기면 short-id 생성 API로 교체한다.
 *
 * URL 크기 최적화: overview/images/accessibility/tags 등 큰 텍스트 필드는
 * 공유 링크에 굳이 포함하지 않는다 — 받는 쪽에서 id 만으로 detail API 재호출 가능.
 */

/** 공유 페이로드에 필수적인 Place 필드만 추린다. URL 크기를 30% 이상 줄인다. */
function slimPlace(p: Place): Place {
  return {
    id: p.id,
    contentTypeId: p.contentTypeId,
    category: p.category,
    name: p.name,
    address: p.address,
    sigunguCode: p.sigunguCode,
    position: p.position,
    thumbnail: p.thumbnail,
    lang: p.lang,
  }
}

function slimItem(it: CourseItem): CourseItem {
  return { place: slimPlace(it.place), order: it.order, distanceFromPrevKm: it.distanceFromPrevKm }
}

export function encodeShare(course: Course): string {
  const slim: Course = { ...course, items: course.items.map(slimItem) }
  const json = JSON.stringify(slim)
  // 한글 등 비-ASCII 안전한 base64url
  const b64 = btoa(unescape(encodeURIComponent(json)))
  return b64.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export function decodeShare(payload: string): Course | null {
  try {
    const b64 = payload.replaceAll('-', '+').replaceAll('_', '/')
    const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const json = decodeURIComponent(escape(atob(pad)))
    return JSON.parse(json) as Course
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
 * 통합 공유 헬퍼 — PlaceDetail/FestivalDetail/CourseResult 공통 사용.
 *
 * 디바이스별 순서 (한국 서비스 가정 — 카카오톡 우선):
 *  - 모바일/태블릿: Web Share API → 카카오 SDK → 클립보드
 *    (모바일 OS 공유 시트에는 카카오톡 항목이 들어있어 사용자 선택폭이 더 넓다)
 *  - 데스크탑: 카카오 SDK → Web Share API → 클립보드
 *    (Windows Chrome 의 navigator.share 는 카카오톡을 제공하지 않아 우선순위를 뒤로 뺀다)
 *
 * 사용자가 다이얼로그/시트를 명시적으로 닫으면 추가 폴백 없이 'cancelled' 반환.
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
