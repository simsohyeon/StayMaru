/**
 * Vercel Serverless Function — templestay.com 프록시.
 * dev proxy 와 동일한 /api/templestay/* 경로. User-Agent 가 없으면 403 차단되므로 브라우저 UA 로 위장.
 * 응답은 HTML 이며, 클라이언트(api/templestay.ts)가 select#templeId option 을 파싱한다.
 */
export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/api\/templestay/, '')
  const target = 'https://www.templestay.com' + path + url.search

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        Referer: 'https://www.templestay.com/',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    const body = await upstream.text()
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'upstream failed', message: String(err) }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
