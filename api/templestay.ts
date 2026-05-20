/**
 * Vercel Serverless Function — templestay.com 프록시.
 * 호출: /api/templestay/fe/MI00.../prgList.do?... → /api/templestay?path=fe/MI00.../prgList.do&...
 * User-Agent 가 없으면 templestay.com 이 403 차단하므로 브라우저 UA 위장.
 * 응답은 HTML — 클라이언트(api/templestay.ts)가 select#templeId option 파싱.
 */
export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const path = url.searchParams.get('path') ?? ''
  url.searchParams.delete('path')

  const qs = url.searchParams.toString()
  const target = `https://www.templestay.com/${path}${qs ? `?${qs}` : ''}`

  try {
    const upstream = await fetch(target, {
      method: 'GET',
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
