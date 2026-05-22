import { cachedFetch } from './cache'

/**
 * 행사 homepageUrl 의 og:image 를 서버리스 함수를 거쳐 가져온다.
 * dev: vite plugin 미들웨어, 운영: api/og-image.ts (Vercel Edge).
 *
 * 동일 URL 결과는 IDB 7일 캐시.
 */
const TTL_MS = 7 * 24 * 60 * 60 * 1000

export async function fetchOgImage(homepageUrl: string): Promise<string | null> {
  const trimmed = homepageUrl.trim()
  if (!trimmed) return null
  // 한글 도메인 등 비정상 URL 사전 거름
  try {
    const u = new URL(trimmed)
    if (!['http:', 'https:'].includes(u.protocol)) return null
  } catch {
    return null
  }

  return cachedFetch(
    `og-image:${trimmed}`,
    async () => {
      try {
        const r = await fetch(`/api/og-image?url=${encodeURIComponent(trimmed)}`, {
          signal: AbortSignal.timeout(10000),
        })
        if (!r.ok) return null
        const data = (await r.json()) as { image?: string | null }
        return data.image ?? null
      } catch {
        return null
      }
    },
    TTL_MS,
    (r) => r !== null, // 빈 결과는 캐시 안 함 (사이트가 후일 og 추가할 수 있으니)
  )
}
