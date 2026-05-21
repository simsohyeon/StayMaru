import { SIGUNGUS } from '@/constants/sigungu'
import { SIGUNGU_GEO, MAINLAND_VIEWBOX } from './sigunguGeo'
import { projectMainland } from './mapProjection'

/**
 * 경상북도 본토 일러스트 (mock).
 *
 * 모던 동양화 톤 — 한지 배경 + 가는 먹선 외곽 + 시·군별 옅은 색 패치 +
 * 소나무 실루엣 + 산봉우리 + 동해 그라데이션.
 *
 * 정확한 행정경계가 아닌 분위기용. 시·군 위치는 실제 위경도 → 픽셀 변환
 * 이라 핀이 맞는 자리에 떨어진다.
 *
 * AI 일러스트(PNG/SVG)가 준비되면 이 컴포넌트의 본문만 들어내고
 * <image href="/illustration/gyeongbuk.png" .../> 또는 <use> 로 교체하면 된다.
 * bbox 가 같으므로 핀 좌표는 그대로 동작.
 */

const W = MAINLAND_VIEWBOX.width
const H = MAINLAND_VIEWBOX.height

/** 시·군별 지역 톤 — 5개 그룹(북부 산악 / 중부 / 남서부 / 남동부 / 동해안). */
const REGION_TONE: Record<number, string> = {
  // 북부 산악 — 옅은 올리브
  8: '#cfc8a3', 13: '#cfc8a3', 14: '#cfc8a3', 7: '#cfc8a3', 16: '#cfc8a3', 9: '#cfc8a3',
  // 중부 평야 — 베이지
  11: '#e0c9a0', 19: '#e0c9a0', 21: '#cfc4a0',
  // 남서부 — 분홍-베이지
  6: '#dcb59a', 4: '#dcb59a', 22: '#dcb59a', 10: '#dcb59a', 3: '#dcb59a',
  // 남동부 — 살구
  1: '#e6b896', 15: '#e6b896', 2: '#e6b896', 20: '#e6b896',
  // 동해안 — 청록
  18: '#a8c4c0', 12: '#a8c4c0', 23: '#a8c4c0',
}

export default function GyeongbukSvg() {
  return (
    <g>
      {/* 배경 한지 */}
      <rect width={W} height={H} fill="#f4ecd8" />
      <rect width={W} height={H} fill="url(#hanji-noise)" opacity="0.55" />

      {/* 동해 — 우측 그라데이션 (외곽 뒤에 깔림) */}
      <rect x={W * 0.78} y={0} width={W * 0.22} height={H} fill="url(#sea)" />
      {/* 옅은 물결선 */}
      <g stroke="#7da9b0" strokeWidth="0.6" fill="none" opacity="0.4">
        <path d={`M ${W * 0.83} 180 Q ${W * 0.88} 165, ${W * 0.93} 180 T ${W * 0.99} 178`} />
        <path d={`M ${W * 0.82} 360 Q ${W * 0.87} 345, ${W * 0.92} 360 T ${W * 0.98} 358`} />
        <path d={`M 730 540 Q 760 525, 790 540 T ${W * 0.99} 542`} />
        <path d={`M 720 720 Q 750 705, 780 720 T ${W * 0.99} 720`} />
        <path d={`M 720 880 Q 750 865, 780 880 T ${W * 0.99} 880`} />
      </g>

      {/* 경상북도 외곽 — 부드러운 곡선 한 덩어리 */}
      <path
        d={MAINLAND_OUTLINE}
        fill="#ecdfc4"
        stroke="#2c2418"
        strokeWidth="1.6"
        strokeLinejoin="round"
        opacity="0.95"
      />

      {/* 시·군별 옅은 색 패치 — 중심점 주변 원형, 외곽 안에서만 보이도록 clip */}
      <g clipPath="url(#mainland-clip)">
        {SIGUNGUS.filter((s) => s.code !== 17).map((s) => {
          const geo = SIGUNGU_GEO.find((g) => g.code === s.code)
          if (!geo) return null
          const { x, y } = projectMainland(geo.center)
          const tone = REGION_TONE[s.code] ?? '#dcd0b0'
          return (
            <circle
              key={`patch-${s.code}`}
              cx={x}
              cy={y}
              r={56}
              fill={tone}
              opacity="0.6"
            />
          )
        })}
      </g>

      {/* 외곽선 한 번 더 (위에 덮은 패치 가장자리 깔끔하게) */}
      <path
        d={MAINLAND_OUTLINE}
        fill="none"
        stroke="#2c2418"
        strokeWidth="1.6"
        strokeLinejoin="round"
        opacity="0.85"
      />

      {/* 북부 산봉우리 — 가는 먹선 */}
      <g fill="none" stroke="#3a2d1e" strokeWidth="1.2" strokeLinejoin="round" opacity="0.45">
        <path d="M 170 250 L 220 215 L 270 250 L 320 220 L 370 255" />
        <path d="M 410 175 L 450 145 L 495 175 L 540 150 L 580 180" />
        <path d="M 560 290 L 605 260 L 650 290 L 700 265" />
      </g>

      {/* 소나무 실루엣 — 봉화/영양/영주 일대 */}
      <Pine x={320} y={195} />
      <Pine x={395} y={160} scale={1.15} />
      <Pine x={510} y={235} />
      <Pine x={605} y={195} scale={0.9} />
      <Pine x={230} y={290} scale={1.05} />

      {/* 안동 한옥 실루엣 */}
      <Hanok x={376} y={320} />
      {/* 경주 석탑 실루엣 */}
      <Pagoda x={632} y={760} />

      {/* 시·군 중심점 + 라벨 */}
      {SIGUNGUS.filter((s) => s.code !== 17).map((s) => {
        const geo = SIGUNGU_GEO.find((g) => g.code === s.code)
        if (!geo) return null
        const { x, y } = projectMainland(geo.center)
        return (
          <g key={`label-${s.code}`} pointerEvents="none">
            <circle cx={x} cy={y} r={2.5} fill="#3a2d1e" opacity="0.6" />
            <text
              x={x}
              y={y + 16}
              fontSize="13"
              textAnchor="middle"
              fill="#3a2d1e"
              opacity="0.75"
              fontWeight="500"
              style={{ fontFamily: 'var(--font-display, "Noto Serif KR", serif)' }}
            >
              {s.ko}
            </text>
          </g>
        )
      })}

      {/* 동해 라벨 */}
      <text
        x={W * 0.91}
        y={H * 0.5}
        fontSize="22"
        textAnchor="middle"
        fill="#4a6c70"
        opacity="0.55"
        letterSpacing="8"
        style={{ fontFamily: 'var(--font-display, "Noto Serif KR", serif)' }}
      >
        東 海
      </text>
    </g>
  )
}

/** 단순 소나무 실루엣 (둥근 잎 + 가는 줄기). */
function Pine({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity="0.55">
      <path d="M 0 -2 L -10 12 L 10 12 Z" fill="#3d4f33" />
      <path d="M 0 6 L -13 22 L 13 22 Z" fill="#3d4f33" />
      <path d="M 0 16 L -16 34 L 16 34 Z" fill="#3d4f33" />
      <line x1="0" y1="32" x2="0" y2="44" stroke="#4a3520" strokeWidth="1.4" />
    </g>
  )
}

/** 안동 한옥 단순 실루엣 — 기와 곡선 지붕. */
function Hanok({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity="0.5">
      <path d="M -22 -6 Q 0 -16, 22 -6 L 18 0 L -18 0 Z" fill="#3a2d1e" />
      <rect x="-16" y="0" width="32" height="10" fill="#d8c498" stroke="#3a2d1e" strokeWidth="0.8" />
    </g>
  )
}

/** 경주 석탑 단순 실루엣. */
function Pagoda({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity="0.5">
      <rect x="-10" y="-2" width="20" height="3" fill="#3a2d1e" />
      <rect x="-8" y="-8" width="16" height="6" fill="#d8c498" stroke="#3a2d1e" strokeWidth="0.6" />
      <rect x="-7" y="-12" width="14" height="2" fill="#3a2d1e" />
      <rect x="-6" y="-18" width="12" height="6" fill="#d8c498" stroke="#3a2d1e" strokeWidth="0.6" />
      <rect x="-5" y="-22" width="10" height="2" fill="#3a2d1e" />
      <polygon points="0,-30 -5,-22 5,-22" fill="#3a2d1e" />
    </g>
  )
}

/**
 * 경상북도 외곽 path (단순화 — 14개 베지어 anchor).
 * 정확한 행정경계가 아니라 분위기용. AI 일러스트 교체 시 의미 없어짐.
 */
const MAINLAND_OUTLINE = `
M 380 110
Q 320 85, 270 120
Q 200 135, 150 185
Q 95 235, 70 325
Q 45 455, 55 580
Q 75 705, 135 800
Q 185 880, 245 920
Q 325 970, 400 980
Q 480 970, 540 935
Q 620 895, 680 825
Q 738 740, 758 640
Q 770 530, 770 420
Q 770 280, 755 180
Q 740 115, 695 95
Q 620 85, 550 100
Q 470 120, 380 110
Z
`.trim()

/**
 * 본토 SVG 의 <defs> (clip path / 그라데이션 / 패턴).
 * IllustratedMap 의 최상위 <defs> 안에 한 번만 등록되도록 export.
 */
export function GyeongbukDefs() {
  return (
    <>
      <pattern id="hanji-noise" width="8" height="8" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="0.3" fill="#a89977" />
        <circle cx="6" cy="5" r="0.25" fill="#a89977" />
        <circle cx="4" cy="7" r="0.2" fill="#bba98a" />
      </pattern>
      <linearGradient id="sea" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#cbe0e0" stopOpacity="0" />
        <stop offset="40%" stopColor="#bbd3d4" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#9bbcc0" stopOpacity="0.85" />
      </linearGradient>
      <clipPath id="mainland-clip">
        <path d={MAINLAND_OUTLINE} />
      </clipPath>
    </>
  )
}
