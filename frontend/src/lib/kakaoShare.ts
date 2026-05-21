/**
 * 카카오 JavaScript SDK 기반 카카오톡 공유.
 *
 * - 키: 우선순위 `VITE_KAKAO_JS_KEY` → `VITE_KAKAO_MAP_KEY`.
 *   카카오는 앱 단위 JavaScript 키 하나로 지도/공유 모두 동작하므로
 *   기존 맵 키를 그대로 재사용할 수 있다.
 * - SDK는 lazy 로드 (첫 공유 시점에만). 키 미설정 또는 로드 실패 시
 *   `isKakaoShareReady()` 가 false 를 반환하여 share.ts 가 Web Share / 클립보드로 폴백.
 * - 보안: 키는 브라우저에 노출되지만, 카카오 콘솔의 "플랫폼 > Web 사이트 도메인"
 *   화이트리스트가 사용처를 막아준다. (https://shimmaru.vercel.app + localhost 등록 필요)
 */

const KAKAO_JS_KEY =
  (import.meta.env.VITE_KAKAO_JS_KEY as string | undefined) ||
  (import.meta.env.VITE_KAKAO_MAP_KEY as string | undefined)

declare global {
  interface Window {
    Kakao?: {
      isInitialized: () => boolean
      init: (key: string) => void
      Share: {
        sendDefault: (opts: Record<string, unknown>) => void
        sendScrap: (opts: Record<string, unknown>) => void
      }
    }
  }
}

let sdkPromise: Promise<boolean> | null = null
let warnedNoKey = false

/**
 * 카카오 JS SDK (Share 모듈) 를 lazy 로드한 뒤 init. 성공 시 true.
 * 호출 시점이나 키 누락 시 false 로 짧게 떨어지며, share.ts 가 폴백을 탄다.
 */
export function loadKakaoShare(): Promise<boolean> {
  if (!KAKAO_JS_KEY) {
    if (import.meta.env.DEV && !warnedNoKey) {
      warnedNoKey = true
      console.warn(
        '[kakaoShare] VITE_KAKAO_JS_KEY 또는 VITE_KAKAO_MAP_KEY 가 없어 카카오톡 공유 비활성화. ' +
          'frontend/.env.local 의 키를 확인하고 dev 서버를 재시작하세요.',
      )
    }
    return Promise.resolve(false)
  }
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise<boolean>((resolve) => {
    const finish = (ok: boolean) => resolve(ok)

    if (typeof window === 'undefined') return finish(false)

    if (window.Kakao?.isInitialized?.()) return finish(true)

    const start = () => {
      try {
        if (!window.Kakao) return finish(false)
        if (!window.Kakao.isInitialized()) window.Kakao.init(KAKAO_JS_KEY)
        return finish(window.Kakao.isInitialized())
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[kakaoShare] init failed', err)
        return finish(false)
      }
    }

    // 같은 페이지에 이미 스크립트가 깔려 있을 수 있다 (개발 시 중복 방지).
    const existing = document.querySelector<HTMLScriptElement>('script[data-shimmaru-kakao]')
    if (existing) {
      if (window.Kakao) return start()
      existing.addEventListener('load', start, { once: true })
      existing.addEventListener('error', () => finish(false), { once: true })
      return
    }

    const script = document.createElement('script')
    script.dataset.shimmaruKakao = '1'
    // integrity/crossorigin 없는 단순 로드 (카카오 가이드 기본). HTTPS 강제.
    script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js'
    script.async = true
    script.onload = start
    script.onerror = () => {
      if (import.meta.env.DEV) {
        console.warn(
          '[kakaoShare] SDK 스크립트 로드 실패. (1) 네트워크 (2) CSP (3) 카카오 콘솔의 ' +
            '플랫폼 > Web > 사이트 도메인에 ' +
            `${location.origin} 가 등록되지 않았을 수 있습니다.`,
        )
      }
      finish(false)
    }
    document.head.appendChild(script)
  })
  return sdkPromise
}

export interface KakaoFeedArgs {
  title: string
  description?: string
  imageUrl?: string
  url: string
  /** 버튼 라벨 (기본: "자세히 보기") */
  buttonLabel?: string
}

/**
 * Feed 템플릿(기본 템플릿) 으로 카카오톡 공유 다이얼로그를 띄운다.
 * imageUrl 이 없거나 https 가 아닌 경우 OG 이미지로 폴백되도록 빈 문자열로 전달한다.
 * @returns 다이얼로그 호출에 성공했으면 true, SDK 준비 실패 등으로 호출 자체를 못 했으면 false.
 */
export async function shareViaKakao(args: KakaoFeedArgs): Promise<boolean> {
  const ok = await loadKakaoShare()
  if (!ok || !window.Kakao?.Share) return false
  try {
    const safeImage = args.imageUrl && /^https:\/\//.test(args.imageUrl) ? args.imageUrl : ''
    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: args.title,
        description: args.description ?? '',
        imageUrl: safeImage,
        link: { mobileWebUrl: args.url, webUrl: args.url },
      },
      buttons: [
        {
          title: args.buttonLabel ?? '자세히 보기',
          link: { mobileWebUrl: args.url, webUrl: args.url },
        },
      ],
    })
    return true
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[kakaoShare] sendDefault failed', err)
    return false
  }
}

export function isKakaoShareConfigured(): boolean {
  return !!KAKAO_JS_KEY
}
