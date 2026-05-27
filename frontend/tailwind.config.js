/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ─── Surface — cream canvas (디자인 시스템) ────────────────
        canvas: '#faf9f5',              // 따뜻한 크림 페이지 플로어
        'canvas-soft': '#f5f0e8',       // 섹션 디바이더, 아주 옅은 밴드
        // card 토큰 의미 전환: 흰색 카드 → 한 단계 어두운 크림(#efe9de).
        // 가이드의 surface-card 와 동일. 페이지 floor 위에서 살짝 들리는 느낌.
        card: '#efe9de',
        'surface-strong': '#e8e0d2',    // 선택된 탭, 강조 밴드
        'surface-cream-strong': '#e8e0d2',

        // ─── Hairlines (그림자 없이 깊이감) ─────────────────────────
        hairline: '#e6dfd8',
        'hairline-soft': '#ebe6df',
        'hairline-strong': '#d6cdbc',

        // ─── Text ────────────────────────────────────────────────
        ink: '#141413',                 // 본문/제목 — 따뜻한 near-black
        body: '#3d3d3a',
        'body-strong': '#252523',
        muted: '#6c6a64',
        'muted-soft': '#8e8b82',

        // ─── Brand voltage — Coral (시그니처) ─────────────
        primary: {
          DEFAULT: '#cc785c',
          active: '#a9583e',
          disabled: '#e6dfd8',
        },
        'on-primary': '#ffffff',

        // ─── Accent — 보조 색상 (희소하게만) ────────────────────────
        'accent-teal': '#5db8a6',
        'accent-amber': '#e8a55a',

        // ─── Timeline pastel pills (in-product AI 단계 전용) ────────
        // 브랜드 외 in-product UX 큐 — 기존 톤 유지.
        timeline: {
          thinking: '#dfa88f',
          grep: '#9fc9a2',
          read: '#9fbbe0',
          edit: '#c0a8dd',
          done: '#cc785c',          // coral 로 정렬 (done = 브랜드 voltage)
        },

        // ─── Semantic ────────────────────────────────────────────
        success: '#5db872',
        warning: '#d4a017',
        error: '#c64545',
      },
      fontFamily: {
        // Body — Inter(라틴) + Pretendard(한글) 의 휴머니스트 산세리프.
        sans: [
          'Inter',
          'Pretendard Variable',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        // Display — Copernicus 대체. 라틴은 Cormorant Garamond, 한글은 Noto Serif KR.
        // 편집(editorial) 무드의 슬랩 세리프. weight 400, 부정 자간 필수.
        display: [
          'Cormorant Garamond',
          'Noto Serif KR',
          'EB Garamond',
          'Tiempos Headline',
          'Garamond',
          '"Times New Roman"',
          'serif',
        ],
      },
      fontSize: {
        // 디스플레이 스케일 — 모두 weight 400, 부정 자간.
        'display-mega': ['64px', { lineHeight: '1.05', letterSpacing: '-1.5px', fontWeight: '400' }],
        'display-xl':   ['64px', { lineHeight: '1.05', letterSpacing: '-1.5px', fontWeight: '400' }],
        'display-lg':   ['48px', { lineHeight: '1.1',  letterSpacing: '-1px',   fontWeight: '400' }],
        'display-md':   ['36px', { lineHeight: '1.15', letterSpacing: '-0.5px', fontWeight: '400' }],
        'display-sm':   ['28px', { lineHeight: '1.2',  letterSpacing: '-0.3px', fontWeight: '400' }],
        // Title — 산세리프 (StyreneB / Inter), 라벨·캡션 톤.
        'title-lg':     ['22px', { lineHeight: '1.3',  fontWeight: '500' }],
        'title-md':     ['18px', { lineHeight: '1.4',  fontWeight: '500' }],
        'title-sm':     ['16px', { lineHeight: '1.4',  fontWeight: '500' }],
        'body-md':      ['16px', { lineHeight: '1.55', fontWeight: '400' }],
        'body-sm':      ['14px', { lineHeight: '1.55', fontWeight: '400' }],
        caption:        ['13px', { lineHeight: '1.4',  fontWeight: '500' }],
        // Eyebrow / 카테고리 태그 — 1.5px 자간 uppercase.
        eyebrow:        ['12px', { lineHeight: '1.4',  letterSpacing: '1.5px', fontWeight: '500' }],
        code:           ['14px', { lineHeight: '1.6',  fontWeight: '400' }],
        button:         ['14px', { lineHeight: '1.0',  fontWeight: '500' }],
        'nav-link':     ['14px', { lineHeight: '1.4',  fontWeight: '500' }],
      },
      spacing: {
        xxl: '48px',
        section: '96px',          // modern-SaaS 리듬
      },
      maxWidth: {
        content: '1200px',
      },
      borderRadius: {
        sm: '6px',
        md: '8px',     // CTA, form inputs
        lg: '12px',    // 카드, 모달
        xl: '16px',    // hero 일러스트레이션
        pill: '9999px',
      },
      keyframes: {
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pill-pop': {
          '0%':   { opacity: '0', transform: 'scale(0.85)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        // Skeleton shimmer — 1.5s 주기로 좌→우 광택 슬라이드
        skeleton: {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        // OnboardingTour — 코치마크 카드 진입
        'fade-scale': {
          '0%':   { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        // Builder 강조 — NL 적용 직후 살짝 펄스 (coral)
        highlight: {
          '0%':   { boxShadow: '0 0 0 0 rgba(204, 120, 92, 0.45)' },
          '70%':  { boxShadow: '0 0 0 10px rgba(204, 120, 92, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(204, 120, 92, 0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out',
        'pill-pop': 'pill-pop 0.3s ease-out',
        skeleton: 'skeleton 1.5s ease-in-out infinite',
        'fade-scale': 'fade-scale 0.25s ease-out',
        highlight: 'highlight 1.4s ease-out',
      },
    },
  },
  plugins: [],
}
