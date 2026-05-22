/**
 * Vercel Edge Function — 전국문화축제표준데이터 프록시.
 *
 * 호출: GET /api/festival-std?type=json&numOfRows=1000&pageNo=1
 * 반환: 행정안전부 표준데이터 응답 원본
 *
 * 환경변수: FESTIVAL_STD_API_KEY (공공데이터포털 일반 인증키 Decoding)
 * Endpoint: https://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api
 */
export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const target = new URL('https://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api')
  url.searchParams.forEach((v, k) => target.searchParams.set(k, v))

  const key = process.env.FESTIVAL_STD_API_KEY
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
        // 분기 갱신이라 24h s-maxage + 7일 stale-while-revalidate
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'upstream failed', message: String(err) }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
