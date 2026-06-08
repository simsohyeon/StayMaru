/**
 * Vercel Serverless Function — 기상청 단기예보(VilageFcstInfoService_2.0) 프록시.
 *
 * 호출: 클라이언트 /api/weather?base_date=..&base_time=..&nx=..&ny=..&numOfRows=..
 *   → 이 함수가 apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst 로 포워딩
 *   → serviceKey(WEATHER_API_KEY ?? TOUR_API_KEY) + dataType=JSON 자동 주입
 *
 * 환경변수: WEATHER_API_KEY (없으면 TOUR_API_KEY 재사용).
 *   ※ data.go.kr 에서 "기상청_단기예보 조회서비스" 활용신청이 되어 있어야 한다.
 *      미신청 시 클라이언트(weather.ts)가 평년값으로 graceful 폴백한다.
 */
export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const target = new URL(
    'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst',
  )
  url.searchParams.forEach((v, k) => target.searchParams.set(k, v))
  target.searchParams.set('dataType', 'JSON')

  const key = process.env.WEATHER_API_KEY || process.env.TOUR_API_KEY
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
        // 단기예보는 자주 바뀌므로 30분 캐시 + SWR
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
      },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'upstream failed', message: String(err) }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
