import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

/**
 * dev 환경에서 /api/og-image 를 처리하는 미들웨어.
 * 운영은 api/og-image.ts (Vercel Edge function) 가 동일 인터페이스로 응답.
 * 클라이언트 fetch 코드는 dev/운영 차이를 모름.
 */
const BLOCKED_HOSTS =
  /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|::1$|fc[0-9a-f]{2}:|fe80:)/i

function ogImageDevPlugin(): Plugin {
  return {
    name: 'shimmaru-og-image-dev',
    configureServer(server) {
      server.middlewares.use('/api/og-image', async (req, res) => {
        const reqUrl = new URL(req.url ?? '', 'http://x')
        const raw = reqUrl.searchParams.get('url')
        const send = (body: unknown, status = 200, headers: Record<string, string> = {}) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
          res.end(JSON.stringify(body))
        }
        if (!raw) return send({ image: null }, 400)
        let target: URL
        try { target = new URL(raw) } catch { return send({ image: null }, 400) }
        if (!['http:', 'https:'].includes(target.protocol)) return send({ image: null }, 400)
        if (BLOCKED_HOSTS.test(target.hostname)) return send({ image: null }, 400)

        const tryFetch = (u: URL) =>
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
            // https 실패 시 http 폴백
            if (target.protocol === 'https:') {
              const httpUrl = new URL(target.toString())
              httpUrl.protocol = 'http:'
              upstream = await tryFetch(httpUrl)
            } else {
              throw e
            }
          }
          if (!upstream.ok) return send({ image: null })
          // 상위 128KB 까지 읽기 (og 폴백이 svg/logo 면 본문 <img> 폴백 필요)
          const reader = upstream.body?.getReader()
          if (!reader) return send({ image: null })
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
          return send({ image: img })
        } catch {
          return send({ image: null })
        }
      })
    },
  }
}

function pickOgImage(html: string, base: URL): string | null {
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
  // 본문 첫 의미있는 <img>
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

function normalizeImageUrl(raw: string, base: URL): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/(no[_-]?image|placeholder|default[_-]?img|blank|spacer|^data:)/i.test(trimmed)) return null
  if (/(fatal_error|error[_-]?msg|warning[_-]?img|404|expired|maintenance)/i.test(trimmed)) return null
  if (/(\/logo[._-]|\/logo\/|\/icon[._-]|\/icon\/|\/favicon|\/header|\/footer|\/banner_top)/i.test(trimmed)) return null
  if (/\.(svg)(\?|$)/i.test(trimmed)) return null
  let url: string
  if (/^https?:\/\//i.test(trimmed)) {
    url = trimmed
  } else if (/^\/\//.test(trimmed)) {
    url = `https:${trimmed}`
  } else {
    try { url = new URL(trimmed, base.toString()).toString() } catch { return null }
  }
  return url.replace(/^http:\/\//i, 'https://')
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      ogImageDevPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: '쉼(休)마루',
          short_name: '쉼마루',
          description: '경상북도 전통문화 여행 코스 추천 서비스',
          // index.html 의 theme-color 와 동일 — 상단 바 일관화
          theme_color: '#f7f7f4',
          background_color: '#f7f7f4',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            // SVG 1장으로 모든 크기 대응 — png 자산 미생성 상태 회피
            { src: 'favicon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      // 카카오 콘솔에 등록된 도메인은 localhost:5173 뿐 — 다른 포트로 떠버리면 SDK 인증 실패.
      // 5173 이 점유돼 있으면 즉시 실패하도록 strictPort 사용 → 사용자가 점유 프로세스를 인지할 수 있다.
      strictPort: true,
      proxy: {
        // 한국관광공사 OpenAPI 프록시 — API 키는 .env(.local)에서 주입, 프론트 번들에 노출 금지
        '/api/tour': {
          target: 'http://apis.data.go.kr',
          changeOrigin: true,
          rewrite: (p) => {
            // /api/tour/KorService1/areaBasedList1?... 형태 → /B551011/KorService1/areaBasedList1?...
            const stripped = p.replace(/^\/api\/tour/, '/B551011')
            const url = new URL('http://x' + stripped)
            if (env.TOUR_API_KEY) {
              url.searchParams.set('serviceKey', env.TOUR_API_KEY)
            }
            return url.pathname + url.search
          },
        },
        // 전국문화축제표준데이터 (행정안전부 표준데이터, 분기 갱신).
        // TourAPI 보다 지자체 직접 입력 비중이 높아 2026년 행사 노출 가능성 ↑.
        // 응답 필드: fstvlNm, fstvlStartDate, fstvlEndDate, opar, rdnmadr, latitude, longitude 등
        '/api/festival-std': {
          target: 'https://api.data.go.kr',
          changeOrigin: true,
          secure: true,
          rewrite: (p) => {
            const stripped = p.replace(/^\/api\/festival-std/, '/openapi/tn_pubr_public_cltur_fstvl_api')
            const url = new URL('http://x' + stripped)
            if (env.FESTIVAL_STD_API_KEY) {
              url.searchParams.set('serviceKey', env.FESTIVAL_STD_API_KEY)
            }
            return url.pathname + url.search
          },
        },
        // templestay.com (한국불교문화사업단) — 공식 OpenAPI 가 없어 브라우저용 HTML 페이지를 프록시.
        // User-Agent 가 없거나 curl 류면 차단하므로 브라우저 UA 로 위장한다.
        '/api/templestay': {
          target: 'https://www.templestay.com',
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/api\/templestay/, ''),
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
            Referer: 'https://www.templestay.com/',
          },
        },
      },
    },
  }
})
