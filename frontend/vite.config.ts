import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico'],
        manifest: {
          name: '쉼(休)마루',
          short_name: '쉼마루',
          description: '경상북도 전통문화 여행 코스 추천 서비스',
          theme_color: '#7c2d12',
          background_color: '#fefce8',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
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
