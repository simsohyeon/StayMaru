import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { handle as apiProxy } from '../api/proxy'
import { handle as syncPlaces } from '../api/sync-places'
import { handle as courseGenerate } from '../api/course'
import { handle as savedCourses } from '../api/courses'
import { handle as admin } from '../api/admin'
import { handle as content } from '../api/content'

// 앱 버전 — package.json 단일 출처(Settings 화면 표기용).
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')) as {
  version: string
}

/**
 * dev 환경에서 /api/{tour,tour-batch,festival-std,weather,templestay} 를 처리하는 미들웨어.
 * 운영의 vercel.json rewrites → api/proxy.ts 와 같은 경로 매핑을 적용해 동일한 handle() 을 호출한다.
 * 예전 server.proxy 4개는 키 주입·헤더·강제 쿼리를 운영 함수와 따로 구현해 이중 관리였다.
 * 순서 주의 — '/api/tour-batch' 가 '/api/tour' 보다 앞이어야 한다.
 */
const API_PROXY_ROUTES: Array<{ prefix: string; svc: string; subPath: boolean }> = [
  { prefix: '/api/tour-batch', svc: 'tour', subPath: false },
  { prefix: '/api/tour', svc: 'tour', subPath: true },
  { prefix: '/api/festival-std', svc: 'festival-std', subPath: false },
  { prefix: '/api/weather', svc: 'weather', subPath: false },
  { prefix: '/api/templestay', svc: 'templestay', subPath: true },
]

function apiProxyDevPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'shimmaru-api-proxy-dev',
    configureServer(server) {
      // 프록시를 거치지 않는 독립 함수들 — 운영에서는 api/<name>.ts 가 직접 라우팅된다.
      //   sync-places: 장소 적재(운영은 Vercel Cron, dev 는 브라우저에서 직접 호출해 초기 적재)
      //   course     : 서버 코스 생성 (POST)   courses: 저장 코스 보관 (GET/PUT/DELETE)
      //   admin      : 운영자 로그인·집계 (쿠키 기반 — 아래에서 cookie 헤더를 그대로 넘긴다)
      type DirectHandler = (req: Request, env: Record<string, string>) => Promise<Response>
      const DIRECT: Record<string, DirectHandler | undefined> = {
        '/api/sync-places': syncPlaces,
        '/api/course': courseGenerate,
        '/api/courses': savedCourses,
        '/api/admin': admin,
        '/api/content': content,
      }
      server.middlewares.use(async (req, res, next) => {
        // 실제 호스트(localhost:5173)를 유지해야 함수가 self-fetch(/api/festival-std 등) 할 때 같은 dev 서버로 온다.
        const origin = `http://${req.headers.host ?? 'localhost:5173'}`
        const reqUrl = new URL(req.url ?? '', origin)
        const direct = DIRECT[reqUrl.pathname]
        const route = direct
          ? undefined
          : API_PROXY_ROUTES.find(
              (r) => reqUrl.pathname === r.prefix || (r.subPath && reqUrl.pathname.startsWith(`${r.prefix}/`)),
            )
        if (!direct && !route) return next()
        const target = new URL(direct ? reqUrl.pathname : '/api/proxy', origin)
        if (route) {
          target.searchParams.set('svc', route.svc)
          if (route.subPath) target.searchParams.set('path', reqUrl.pathname.slice(route.prefix.length + 1))
        }
        reqUrl.searchParams.forEach((v, k) => target.searchParams.set(k, v))
        try {
          const method = req.method ?? 'GET'
          let body: Buffer | undefined
          if (method !== 'GET' && method !== 'HEAD') {
            const chunks: Buffer[] = []
            for await (const chunk of req) chunks.push(chunk as Buffer)
            body = Buffer.concat(chunks)
          }
          const request = new Request(target.toString(), {
            method,
            headers: {
              authorization: req.headers.authorization ?? '',
              'content-type': req.headers['content-type'] ?? '',
              cookie: req.headers.cookie ?? '',
            },
            body,
          })
          const out = direct ? await direct(request, env) : await apiProxy(request, env)
          res.statusCode = out.status
          out.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await out.arrayBuffer()))
        } catch (err) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'proxy failed', message: String(err) }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
      react(),
      apiProxyDevPlugin(env),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png'],
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
            // 안드로이드 설치 호환을 위해 192/512 PNG 필수 — SVG 단독은 일부 기기에서 설치 실패.
            { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            // 안드로이드 홈화면(마스크 적용)은 투명 배경이 어색해 틸 배경을 깐 전용 파일을 쓴다.
            { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // 벤더 분할 — 자주 안 바뀌는 대형 라이브러리를 별도 청크로 빼
          // 장기 캐싱(앱 코드만 갱신돼도 벤더 청크는 재다운로드 안 함)과 병렬 로딩을 얻는다.
          // supabase 는 dynamic import 라 여기 없어도 자동으로 별도 청크가 된다.
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
            dnd: ['@dnd-kit/core', '@dnd-kit/sortable'],
          },
        },
      },
    },
    server: {
      // true → 0.0.0.0 바인딩. 같은 네트워크(LAN)의 다른 기기(모바일 등)에서 접속 가능.
      host: true,
      port: 5173,
      // 카카오 콘솔에 등록된 도메인은 localhost:5173 뿐 — 다른 포트로 떠버리면 SDK 인증 실패.
      // 5173 이 점유돼 있으면 즉시 실패하도록 strictPort 사용 → 사용자가 점유 프로세스를 인지할 수 있다.
      strictPort: true,
    },
  }
})
