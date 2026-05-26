/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ─── Surface ─────────────────────────────────────────────
        canvas: '#f7f7f4',            // 따뜻한 크림 페이지 플로어
        'canvas-soft': '#fafaf7',     // IDE pane 내부 배경
        card: '#ffffff',              // 카드 표면 — cream 위 슬쩍 대비
        'surface-strong': '#e6e5e0',  // 배지·태그

        // ─── Hairlines (그림자 없이 깊이감) ─────────────────────────
        hairline: '#e6e5e0',
        'hairline-soft': '#efeee8',
        'hairline-strong': '#cfcdc4',

        // ─── Text ────────────────────────────────────────────────
        ink: '#26251e',         // 본문/제목 — 따뜻한 near-black
        body: '#5a5852',
        'body-strong': '#26251e',
        muted: '#807d72',
        'muted-soft': '#a09c92',

        // ─── Brand voltage (희소하게만) ─────────────────────────────
        primary: {
          DEFAULT: '#f54e00',         // Cursor Orange
          active: '#d04200',
        },
        'on-primary': '#ffffff',

        // ─── Timeline pastel pills (in-product AI 단계 전용) ────────
        timeline: {
          thinking: '#dfa88f',
          grep: '#9fc9a2',
          read: '#9fbbe0',
          edit: '#c0a8dd',
          done: '#c08532',
        },

        // ─── Semantic ────────────────────────────────────────────
        success: '#1f8a65',
        error: '#cf2d56',
      },
      fontFamily: {
        // CursorGothic 대체 = Inter (한글은 Pretendard fallback)
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
        display: [
          'Inter',
          'Pretendard Variable',
          'Pretendard',
          '-apple-system',
          'system-ui',
          'sans-serif',
        ],
      },
      fontSize: {
        // Cursor 타이포 스케일
        'display-mega': ['72px', { lineHeight: '1.1', letterSpacing: '-2.16px', fontWeight: '400' }],
        'display-lg':   ['36px', { lineHeight: '1.2', letterSpacing: '-0.72px', fontWeight: '400' }],
        'display-md':   ['26px', { lineHeight: '1.25', letterSpacing: '-0.325px', fontWeight: '400' }],
        'display-sm':   ['22px', { lineHeight: '1.3', letterSpacing: '-0.11px', fontWeight: '400' }],
        // 한글 가독성 위해 title 1단계 업, 줄간격 살짝 키움.
        'title-md':     ['19px', { lineHeight: '1.45', fontWeight: '600' }],
        'title-sm':     ['17px', { lineHeight: '1.45', fontWeight: '600' }],
        'body-md':      ['16px', { lineHeight: '1.55', fontWeight: '400' }],
        'body-sm':      ['14px', { lineHeight: '1.55', fontWeight: '400' }],
        caption:        ['13px', { lineHeight: '1.45', fontWeight: '400' }],
        // 한글에서 11px + 0.88px 자간은 가독성 떨어짐. 12px + 0.6px 로 완화.
        eyebrow:        ['12px', { lineHeight: '1.4', letterSpacing: '0.6px', fontWeight: '600' }],
        code:           ['13px', { lineHeight: '1.5', fontWeight: '400' }],
      },
      spacing: {
        section: '80px',
      },
      maxWidth: {
        content: '1200px',
      },
      borderRadius: {
        sm: '6px',
        md: '8px',     // CTA, form inputs
        lg: '12px',    // 카드, IDE pane
        xl: '16px',
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
        // Builder 강조 — NL 적용 직후 살짝 펄스
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
