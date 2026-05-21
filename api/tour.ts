/**
 * Vercel Serverless Function — 한국관광공사 TourAPI 프록시.
 *
 * 호출 흐름:
 *   클라이언트 /api/tour/KorService2/areaBasedList2?...
 *     → vercel.json rewrites → /api/tour?path=KorService2/areaBasedList2&...
 *     → 이 함수가 path 를 꺼내 apis.data.go.kr/B551011/<path>?... 로 포워딩
 *     → TOUR_API_KEY 환경변수를 serviceKey 로 자동 주입
 *
 * 환경변수 (Vercel Dashboard → Settings → Environment Variables):
 *   TOUR_API_KEY = (공공데이터포털 일반 인증키 Decoding)
 */
export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const path = url.searchParams.get('path') ?? ''
  url.searchParams.delete('path')

  const target = new URL(`https://apis.data.go.kr/B551011/${path}`)
  url.searchParams.forEach((v, k) => target.searchParams.set(k, v))

  const key = process.env.TOUR_API_KEY
  if (key) target.searchParams.set('serviceKey', key)

  try {
    const upstream = await fetch(target.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
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
