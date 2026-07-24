// OG 커버(1200×630) 생성기 — 브랜드 SVG 를 PNG 로 굽는다.
// 카카오톡·페이스북 크롤러는 SVG OG 를 신뢰하지 않으므로 래스터 PNG 로 내보낸다.
// 실행: node scripts/gen-og.mjs  →  public/og-cover.png
// 홈 히어로와 같은 모티프(休 낙관 + 오렌지 마침표)로 첫인상 일관성 유지.
import { Resvg } from '@resvg/resvg-js'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const W = 1200
const H = 630

// 브랜드 토큰 (tailwind.config.js 와 동일 출처)
const CANVAS = '#f7f7f4'
const INK = '#26251e'
const BODY = '#5a5852'
const MUTED = '#8a8578'
const ORANGE = '#f54e00'
const HAIRLINE = '#e0ded7'

// CJK+한글은 Windows 기본 Malgun Gothic 으로 렌더(로컬 생성 전용 자산).
const KR = 'Malgun Gothic, AppleGothic, sans-serif'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${CANVAS}"/>

  <!-- 休 낙관 — 우측에서 흘러나오는 저대비 워터마크 (히어로와 동일 시그니처) -->
  <text x="${W - 40}" y="470" text-anchor="end" font-family="${KR}"
        font-size="620" fill="${INK}" fill-opacity="0.05">休</text>

  <!-- 에디토리얼 헤어라인 프레임 -->
  <rect x="48" y="48" width="${W - 96}" height="${H - 96}" fill="none"
        stroke="${HAIRLINE}" stroke-width="1.5"/>

  <!-- 오렌지 낙관 인장 — 좌상단 코너 액센트 -->
  <rect x="90" y="96" width="34" height="34" rx="6" fill="${ORANGE}"/>
  <text x="107" y="121" text-anchor="middle" font-family="${KR}"
        font-size="22" fill="#ffffff">休</text>
  <text x="140" y="120" font-family="${KR}" font-size="21" fill="${INK}">쉼마루</text>
  <text x="215" y="120" font-family="Consolas, monospace" font-size="13"
        letter-spacing="2" fill="${MUTED}">· GYEONGBUK</text>

  <!-- 아이브로우 -->
  <text x="92" y="250" font-family="Consolas, monospace" font-size="17"
        letter-spacing="4" fill="${MUTED}">SLOW TRAVEL · 경상북도 전통문화 여행</text>

  <!-- 헤드라인 — 오렌지 마침표 모티프 -->
  <text x="88" y="352" font-family="${KR}" font-size="96" font-weight="600"
        letter-spacing="-3" fill="${INK}">천천히 머무는, 경북<tspan fill="${ORANGE}">.</tspan></text>

  <!-- 서브라인 -->
  <text x="92" y="430" font-family="${KR}" font-size="30" fill="${BODY}">AI가 한옥·서원·사찰·전통시장을 하나의 흐름으로 설계합니다.</text>

  <!-- 하단 카테고리 스트립 -->
  <g font-family="${KR}" font-size="22" fill="${BODY}">
    <circle cx="98" cy="527" r="5" fill="${ORANGE}"/>
    <text x="114" y="534">한옥</text>
    <circle cx="196" cy="527" r="5" fill="#1f8a65"/>
    <text x="212" y="534">서원</text>
    <circle cx="294" cy="527" r="5" fill="#9fbbe0"/>
    <text x="310" y="534">사찰</text>
    <circle cx="392" cy="527" r="5" fill="#c0a8dd"/>
    <text x="408" y="534">전통시장</text>
    <circle cx="530" cy="527" r="5" fill="#c08532"/>
    <text x="546" y="534">축제</text>
  </g>

  <!-- 우하단 URL -->
  <text x="${W - 90}" y="534" text-anchor="end" font-family="Consolas, monospace"
        font-size="18" fill="${MUTED}">staymaru.vercel.app</text>
</svg>`

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: W },
  font: { loadSystemFonts: true },
  background: CANVAS,
})
const png = resvg.render().asPng()
const out = path.resolve(__dirname, '../public/og-cover.png')
writeFileSync(out, png)
console.log(`og-cover.png written: ${(png.length / 1024).toFixed(0)} KB → ${out}`)
