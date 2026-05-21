import { CATEGORY_MAP } from '@/constants/categories'
import type { Place } from '@/types/domain'
import { ULLEUNG_VIEWBOX } from './sigunguGeo'
import { projectUlleung } from './mapProjection'

const W = ULLEUNG_VIEWBOX.width
const H = ULLEUNG_VIEWBOX.height

interface Props {
  places: Place[]
  onPlaceClick: (place: Place) => void
}

/**
 * 울릉/독도 inset — 본토 지도 우상단에 고정 표시.
 * 본토 줌/팬과 무관하게 항상 같은 위치/크기.
 */
export default function UlleungInset({ places, onPlaceClick }: Props) {
  return (
    <div
      className="absolute right-3 top-3 rounded-lg border border-[#3a2d1e]/40 bg-[#f4ecd8]/95 shadow-sm backdrop-blur-sm"
      style={{ width: 110 }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%' }}>
        {/* 한지 배경 */}
        <rect width={W} height={H} fill="#f4ecd8" />

        {/* 바다 — 옅은 청록 */}
        <rect width={W} height={H} fill="#c8dcdc" opacity="0.4" />

        {/* 울릉도 — 부드러운 비정형 원 */}
        <path
          d="M 78 50 Q 92 45, 100 58 Q 105 72, 95 82 Q 80 88, 68 80 Q 58 70, 64 58 Q 70 48, 78 50 Z"
          fill="#cfc8a3"
          stroke="#2c2418"
          strokeWidth="0.9"
          opacity="0.95"
        />
        <text x="82" y="68" fontSize="8" textAnchor="middle" fill="#3a2d1e" opacity="0.75">
          울릉
        </text>

        {/* 독도 — 작은 두 점 */}
        <circle cx="138" cy="92" r="2.5" fill="#3a2d1e" />
        <circle cx="143" cy="94" r="1.8" fill="#3a2d1e" />
        <text x="140" y="108" fontSize="7" textAnchor="middle" fill="#3a2d1e" opacity="0.7">
          독도
        </text>

        {/* 핀 */}
        {places.map((p) => {
          const { x, y } = projectUlleung(p.position)
          const def = CATEGORY_MAP[p.category]
          return (
            <g
              key={p.id}
              transform={`translate(${x} ${y})`}
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation()
                onPlaceClick(p)
              }}
            >
              <circle r="4" fill={def?.markerColor ?? '#3a2d1e'} stroke="#fff" strokeWidth="1" />
            </g>
          )
        })}

        {/* 라벨 */}
      </svg>
      <div className="px-2 pb-1 text-[10px] font-medium text-[#3a2d1e]/70">
        울릉·독도
      </div>
    </div>
  )
}
