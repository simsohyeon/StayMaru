/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ─── Surface — warm cream canvas (Cursor 시스템) ───────────────
        canvas: '#f7f7f4',              // 페이지 floor — 따뜻한 크림
        'canvas-soft': '#fafaf7',       // IDE-pane 등 한 단계 옅은 면
        // surface-card: 순백. cream canvas 위에서 살짝 들리는 카드.
        card: '#ffffff',
        'surface-strong': '#e6e5e0',    // 배지/태그 pill
        'surface-cream-strong': '#e6e5e0',

        // ─── Hairlines (그림자 없이 깊이감) ─────────────────────────
        hairline: '#e6e5e0',
        'hairline-soft': '#efeee8',
        'hairline-strong': '#cfcdc4',

        // ─── Text ────────────────────────────────────────────────
        ink: '#26251e',                 // 본문/제목 — warm near-black
        body: '#5a5852',
        'body-strong': '#26251e',
        muted: '#807d72',
        'muted-soft': '#a09c92',

        // ─── Brand voltage — Cursor Orange ──────────────────────────
        // 시그니처 voltage. primary CTA / wordmark 에만 희소하게.
        primary: {
          DEFAULT: '#f54e00',
          active: '#d04200',
          disabled: '#e6e5e0',
        },
        'on-primary': '#ffffff',

        // ─── Timeline pastel pills (in-product AI 단계 전용) ────────
        // 시스템 액션 색으로 쓰지 말 것 — agent timeline 시각화 한정.
        timeline: {
          thinking: '#dfa88f',      // peach
          grep: '#9fc9a2',          // mint
          read: '#9fbbe0',          // pastel blue
          edit: '#c0a8dd',          // lavender
          done: '#c08532',          // warm gold
        },

        // ─── Semantic ────────────────────────────────────────────
        success: '#1f8a65',
        error: '#cf2d56',
      },
      fontFamily: {
        // Cursor 시스템은 단일 sans family (CursorGothic) 로 body+display 모두 처리.
        // 라이선스 대체로 Inter 사용. 한글은 Pretendard.
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
        // Display — sans 와 동일 스택 (의미적 토큰만 분리 유지).
        // 사용 규칙: weight 400 고정 + 부정 자간. 절대 bold 로 올리지 말 것.
        display: [
          'Inter',
          'Pretendard Variable',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'sans-serif',
        ],
      },
      fontSize: {
        // Cursor 디스플레이 스케일 — 모두 weight 400, 부정 자간(-3% 내외).
        'display-mega': ['72px', { lineHeight: '1.1',  letterSpacing: '-2.16px',  fontWeight: '400' }],
        'display-xl':   ['72px', { lineHeight: '1.1',  letterSpacing: '-2.16px',  fontWeight: '400' }],
        'display-lg':   ['36px', { lineHeight: '1.2',  letterSpacing: '-0.72px',  fontWeight: '400' }],
        'display-md':   ['26px', { lineHeight: '1.25', letterSpacing: '-0.325px', fontWeight: '400' }],
        'display-sm':   ['22px', { lineHeight: '1.3',  letterSpacing: '-0.11px',  fontWeight: '400' }],
        // Title — 산세리프, weight 600. 컴포넌트 제목/리스트 라벨.
        'title-lg':     ['20px', { lineHeight: '1.4',  fontWeight: '600' }],
        'title-md':     ['18px', { lineHeight: '1.4',  fontWeight: '600' }],
        'title-sm':     ['16px', { lineHeight: '1.4',  fontWeight: '600' }],
        'body-md':      ['16px', { lineHeight: '1.5',  fontWeight: '400' }],
        'body-tracked': ['16px', { lineHeight: '1.5',  letterSpacing: '0.08px', fontWeight: '400' }],
        'body-sm':      ['14px', { lineHeight: '1.5',  fontWeight: '400' }],
        caption:        ['13px', { lineHeight: '1.4',  fontWeight: '400' }],
        // Cursor caption-uppercase — 섹션 라벨, timeline pill 라벨.
        eyebrow:        ['11px', { lineHeight: '1.4',  letterSpacing: '0.88px', fontWeight: '600' }],
        code:           ['13px', { lineHeight: '1.5',  fontWeight: '400' }],
        button:         ['14px', { lineHeight: '1.0',  fontWeight: '500' }],
        'nav-link':     ['14px', { lineHeight: '1.4',  fontWeight: '500' }],
      },
      spacing: {
        xxl: '48px',
        section: '80px',          // Cursor 80px 섹션 리듬
      },
      maxWidth: {
        content: '1200px',
      },
      borderRadius: {
        xs: '4px',     // inline tags
        sm: '6px',     // compact rows
        md: '8px',     // CTA, form inputs
        lg: '12px',    // 카드, IDE panes
        xl: '16px',    // 큰 feature 카드 (드물게)
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
        // Builder 강조 — NL 적용 직후 살짝 펄스 (Cursor Orange)
        highlight: {
          '0%':   { boxShadow: '0 0 0 0 rgba(245, 78, 0, 0.45)' },
          '70%':  { boxShadow: '0 0 0 10px rgba(245, 78, 0, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(245, 78, 0, 0)' },
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
