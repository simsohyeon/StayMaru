/**
 * Vercel Serverless Function — 한국관광공사 TourAPI 프록시.
 *
 * dev 서버의 vite.config.ts proxy 와 동일한 경로(/api/tour/*) 를 처리한다.
 * Vercel 환경변수 TOUR_API_KEY 를 serviceKey 로 자동 주입해 클라이언트 번들에 키가 노출되지 않게 한다.
 *
 * 운영 설정:
 *   Vercel Dashboard → Project → Settings → Environment Variables:
 *     TOUR_API_KEY = (공공데이터포털 발급 일반 인증키 Decoding)
 */
export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  // /api/tour/KorService2/areaBasedList2?... → /B551011/KorService2/areaBasedList2?...
  const path = url.pathname.replace(/^\/api\/tour/, '/B551011')
  const target = new URL('https://apis.data.go.kr' + path + url.search)

  const key = process.env.TOUR_API_KEY
  if (key) target.searchParams.set('serviceKey', key)

  try {
    const upstream = await fetch(target.toString(), {
      method: req.method,
      headers: { Accept: 'application/json' },
    })
    // 응답을 그대로 스트리밍. content-type 만 정리.
    const body = await upstream.text()
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'upstream failed', message: String(err) }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
