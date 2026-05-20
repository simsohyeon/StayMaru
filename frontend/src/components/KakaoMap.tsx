import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CATEGORY_MAP } from '@/constants/categories'
import type { Course, LatLng, Place } from '@/types/domain'

/**
 * 카카오맵 마커/폴리라인 컴포넌트.
 *
 * - 카카오 SDK는 lazy 로드. 키가 없거나 로드 실패 시 폴백 SVG 미니맵으로 동작.
 * - SDK 사용 시에도 mock 좌표가 그대로 동작하도록 마커는 절대 좌표를 사용.
 */

interface Props {
  course?: Course
  places?: Place[]
  /** 강조 표시할 장소 id */
  highlightedId?: string
  className?: string
}

declare global {
  interface Window {
    kakao?: any
  }
}

const KAKAO_KEY = import.meta.env.VITE_KAKAO_MAP_KEY as string | undefined

let sdkPromise: Promise<boolean> | null = null
let warnedNoKey = false

function loadKakao(): Promise<boolean> {
  if (!KAKAO_KEY) {
    if (import.meta.env.DEV && !warnedNoKey) {
      warnedNoKey = true
      console.warn(
        '[kakao] VITE_KAKAO_MAP_KEY 가 설정되지 않았습니다. SVG 폴백 지도로 동작합니다. ' +
          'frontend/.env.local 에 키를 넣고 dev 서버를 재시작하세요.',
      )
    }
    return Promise.resolve(false)
  }
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise<boolean>((resolve) => {
    if (window.kakao?.maps) return resolve(true)
    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false`
    script.async = true
    script.onload = () => {
      try {
        window.kakao!.maps.load(() => resolve(true))
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[kakao] SDK init failed:', err)
        }
        resolve(false)
      }
    }
    script.onerror = () => {
      if (import.meta.env.DEV) {
        console.warn(
          '[kakao] SDK 스크립트 로드 실패. (1) 키가 잘못됐거나 (2) 카카오 개발자 콘솔의 ' +
            '플랫폼 > Web > 사이트 도메인에 ' +
            `${location.origin} 가 등록되지 않았을 수 있습니다.`,
        )
      }
      resolve(false)
    }
    document.head.appendChild(script)
  })
  return sdkPromise
}

export default function KakaoMap({ course, places, highlightedId, className }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState<'pending' | 'ok' | 'fallback'>('pending')

  const items: Place[] = course
    ? course.items.map((it) => it.place)
    : places ?? []

  useEffect(() => {
    let cancelled = false
    void loadKakao().then((ok) => {
      if (cancelled) return
      setReady(ok ? 'ok' : 'fallback')
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (ready !== 'ok' || !ref.current || items.length === 0) return
    const kakao = window.kakao!
    const center = items[0].position
    const map = new kakao.maps.Map(ref.current, {
      center: new kakao.maps.LatLng(center.lat, center.lng),
      level: 8,
    })

    const bounds = new kakao.maps.LatLngBounds()
    items.forEach((p, i) => {
      const pos = new kakao.maps.LatLng(p.position.lat, p.position.lng)
      bounds.extend(pos)
      new kakao.maps.Marker({ map, position: pos, title: p.name }) // eslint-disable-line no-new
      if (course) {
        const label = new kakao.maps.CustomOverlay({
          position: pos,
          content: `<div style="background:${CATEGORY_MAP[p.category].markerColor};color:#fff;border-radius:9999px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.25)">${i + 1}</div>`,
          yAnchor: 1.4,
        })
        label.setMap(map)
      }
    })
    if (course && items.length > 1) {
      new kakao.maps.Polyline({ // eslint-disable-line no-new
        map,
        path: items.map((p) => new kakao.maps.LatLng(p.position.lat, p.position.lng)),
        strokeColor: '#26251e',
        strokeOpacity: 0.6,
        strokeWeight: 3,
        strokeStyle: 'shortdash',
      })
    }
    if (items.length > 1) map.setBounds(bounds)
  }, [ready, items, course])

  if (ready === 'fallback') {
    return <FallbackMap items={items} highlightedId={highlightedId} className={className} />
  }
  return (
    <div
      ref={ref}
      className={className ?? 'h-72 w-full rounded-lg bg-canvas-soft border border-hairline'}
      style={{ minHeight: 240 }}
    />
  )
}

function FallbackMap({
  items,
  highlightedId,
  className,
}: {
  items: Place[]
  highlightedId?: string
  className?: string
}) {
  const { t } = useTranslation()
  if (items.length === 0) {
    return (
      <div
        className={`${className ?? 'h-72 w-full'} flex items-center justify-center rounded-lg bg-canvas-soft border border-hairline text-caption text-muted`}
      >
        {t('map.noData')}
      </div>
    )
  }
  // 단순한 SVG 미니맵 (좌표를 박스 내부로 정규화)
  const lats = items.map((p) => p.position.lat)
  const lngs = items.map((p) => p.position.lng)
  const minLat = Math.min(...lats) - 0.05
  const maxLat = Math.max(...lats) + 0.05
  const minLng = Math.min(...lngs) - 0.05
  const maxLng = Math.max(...lngs) + 0.05
  const W = 400
  const H = 300
  const project = (p: LatLng) => ({
    x: ((p.lng - minLng) / (maxLng - minLng)) * W,
    y: H - ((p.lat - minLat) / (maxLat - minLat)) * H,
  })
  const points = items.map((p) => project(p.position))
  const pathD = points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ')

  return (
    <div className={`${className ?? 'h-72 w-full'} relative overflow-hidden rounded-lg border border-hairline bg-canvas-soft`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full">
        <defs>
          <pattern id="paper" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#efeee8" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#paper)" />
        {items.length > 1 && (
          <path d={pathD} fill="none" stroke="#26251e" strokeWidth="2.5" strokeOpacity="0.55" strokeDasharray="6 4" />
        )}
        {points.map((pt, i) => {
          const p = items[i]
          const hl = p.id === highlightedId
          return (
            <g key={p.id}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r={hl ? 14 : 11}
                fill={CATEGORY_MAP[p.category].markerColor}
                stroke="#fff"
                strokeWidth="2"
              />
              <text
                x={pt.x}
                y={pt.y + 4}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill="#fff"
              >
                {i + 1}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="absolute bottom-2 right-2 rounded-pill bg-card/80 px-2 py-0.5 font-mono text-[10px] text-muted">
        {t('map.offlinePreview')}
      </div>
    </div>
  )
}
