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
        'title-md':     ['18px', { lineHeight: '1.4', fontWeight: '600' }],
        'title-sm':     ['16px', { lineHeight: '1.4', fontWeight: '600' }],
        'body-md':      ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        'body-sm':      ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        caption:        ['13px', { lineHeight: '1.4', fontWeight: '400' }],
        eyebrow:        ['11px', { lineHeight: '1.4', letterSpacing: '0.88px', fontWeight: '600' }],
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
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out',
        'pill-pop': 'pill-pop 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
