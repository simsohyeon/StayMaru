/**
 * Vercel Edge Function — og:image 스크래핑 프록시.
 *
 * 호출: GET /api/og-image?url=<encoded_url>
 * 반환: { image: string | null }
 *
 * 사용 시나리오: 행정안전부 표준데이터의 행사들은 응답에 이미지 필드가 없지만
 * homepageUrl 이 있다. 그 페이지의 HTML 에서 og:image / twitter:image 메타 태그를
 * 추출해 사진을 보강한다.
 *
 * 보안:
 *   - http/https 만 허용
 *   - localhost / RFC1918 사설 IP / link-local 차단 (SSRF 방어)
 *   - 8s 타임아웃 (느린 지자체 사이트 대비)
 *   - 응답 캐시 24h (CDN 레벨)
 */
export const config = { runtime: 'edge' }

const BLOCKED_HOSTS = /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|::1$|fc[0-9a-f]{2}:|fe80:)/i

export default async function handler(req: Request): Promise<Response> {
  const reqUrl = new URL(req.url)
  const raw = reqUrl.searchParams.get('url')
  if (!raw) return json({ image: null }, 400)

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return json({ image: null }, 400)
  }
  if (!['http:', 'https:'].includes(target.protocol)) return json({ image: null }, 400)
  if (BLOCKED_HOSTS.test(target.hostname)) return json({ image: null }, 400)

  const tryFetch = async (u: URL) =>
    fetch(u.toString(), {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; ShimmaruOgFetcher/1.0; +https://shimmaru.vercel.app)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    })

  try {
    let upstream: Response
    try {
      upstream = await tryFetch(target)
    } catch (e) {
      // https 실패 시 http 폴백 (일부 지자체 사이트가 https 인증서 미배포)
      if (target.protocol === 'https:') {
        const httpUrl = new URL(target.toString())
        httpUrl.protocol = 'http:'
        upstream = await tryFetch(httpUrl)
      } else {
        throw e
      }
    }
    if (!upstream.ok) return json({ image: null }, 200)

    // 상위 128KB 까지 읽음. og:image 가 폴백(svg/logo) 이면 본문 첫 <img> 까지 봐야 하므로
    // <head> 끝나도 끊지 않는다.
    const reader = upstream.body?.getReader()
    if (!reader) return json({ image: null }, 200)
    const decoder = new TextDecoder('utf-8', { fatal: false })
    let html = ''
    let total = 0
    const LIMIT = 128 * 1024
    while (total < LIMIT) {
      const { value, done } = await reader.read()
      if (done) break
      total += value.byteLength
      html += decoder.decode(value, { stream: true })
    }
    try { await reader.cancel() } catch { /* ignore */ }

    const img = pickOgImage(html, target)
    return json({ image: img }, 200, {
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    })
  } catch {
    return json({ image: null }, 200)
  }
}

function pickOgImage(html: string, base: URL): string | null {
  // 1차: og:image / twitter:image / link rel=image_src
  const metaPatterns: RegExp[] = [
    /<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
  ]
  for (const re of metaPatterns) {
    const m = html.match(re)
    if (!m) continue
    const normalized = normalizeImageUrl(m[1], base)
    if (normalized) return normalized
  }
  // 2차: 본문 첫 의미있는 <img> — 지자체 메인이 og 없을 때 종종 행사 배너가 잡힌다
  const imgRe = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  let m: RegExpExecArray | null
  let scanned = 0
  while ((m = imgRe.exec(html)) !== null && scanned < 30) {
    scanned++
    const normalized = normalizeImageUrl(m[1], base)
    if (normalized) return normalized
  }
  return null
}

/** placeholder / 로고 / 아이콘 류 거르고, 상대→절대 + http→https 정규화. */
function normalizeImageUrl(raw: string, base: URL): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  // 무의미한 placeholder / 에러 / 로고·아이콘 류 거름
  if (/(no[_-]?image|placeholder|default[_-]?img|blank|spacer|^data:)/i.test(trimmed)) return null
  if (/(fatal_error|error[_-]?msg|warning[_-]?img|404|expired|maintenance)/i.test(trimmed)) return null
  if (/(\/logo[._-]|\/logo\/|\/icon[._-]|\/icon\/|\/favicon|\/header|\/footer|\/banner_top)/i.test(trimmed)) return null
  if (/\.(svg)(\?|$)/i.test(trimmed)) return null // svg 는 보통 로고/아이콘
  let url: string
  if (/^https?:\/\//i.test(trimmed)) {
    url = trimmed
  } else if (/^\/\//.test(trimmed)) {
    url = `https:${trimmed}`
  } else {
    try {
      url = new URL(trimmed, base.toString()).toString()
    } catch {
      return null
    }
  }
  return url.replace(/^http:\/\//i, 'https://')
}

function json(body: unknown, status: number, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  })
}
