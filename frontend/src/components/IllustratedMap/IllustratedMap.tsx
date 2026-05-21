import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { CATEGORY_MAP } from '@/constants/categories'
import type { Place } from '@/types/domain'
import GyeongbukSvg, { GyeongbukDefs } from './GyeongbukSvg'
import UlleungInset from './UlleungInset'
import { MAINLAND_VIEWBOX } from './sigunguGeo'
import { projectMainland, isInUlleung, isInMainland } from './mapProjection'

const W = MAINLAND_VIEWBOX.width
const H = MAINLAND_VIEWBOX.height
const MIN_SCALE_RATIO = 0.6 // 초기 fit 의 60% 까지만 축소
const MAX_SCALE_RATIO = 6.0 // 초기 fit 의 6x 까지 확대

interface PixelPlace extends Place {
  px: number
  py: number
}

interface Props {
  places?: Place[]
  className?: string
  /** 핀 클릭 동작 override. 미지정 시 /place/:id 이동. */
  onPlaceClick?: (place: Place) => void
}

/**
 * 모던 동양화 톤의 일러스트 지도 (경상북도).
 *
 * - 드래그 팬 + 휠/핀치 줌 (SVG viewBox 가 아니라 CSS transform 으로).
 * - 핀은 위경도 → 일러스트 픽셀로 절대 위치, 줌 시 inverse-scale 로 크기 유지.
 * - 울릉/독도는 본토와 따로 inset 박스에 고정.
 *
 * AI 일러스트 PNG/SVG 가 준비되면 GyeongbukSvg.tsx 내용만 교체하면 된다.
 */
export default function IllustratedMap({ places = [], className, onPlaceClick }: Props) {
  const nav = useNavigate()
  const frameRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState({ w: 0, h: 0 })
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)

  const viewRef = useRef(view)
  viewRef.current = view

  // 본토 / 울릉 핀 분류
  const { mainlandPins, ulleungPins } = useMemo(() => {
    const m: PixelPlace[] = []
    const u: Place[] = []
    for (const p of places) {
      if (!p.position?.lat || !p.position?.lng) continue
      if (isInUlleung(p.position)) {
        u.push(p)
      } else if (isInMainland(p.position)) {
        const { x, y } = projectMainland(p.position)
        m.push({ ...p, px: x, py: y })
      }
    }
    return { mainlandPins: m, ulleungPins: u }
  }, [places])

  // Frame 크기 추적
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect
      setFrame({ w: cr.width, h: cr.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 초기 fit — frame 이 처음 측정되거나 0→양수 로 바뀔 때만
  const didFitRef = useRef(false)
  useEffect(() => {
    if (didFitRef.current) return
    if (frame.w === 0 || frame.h === 0) return
    const fitScale = Math.min(frame.w / W, frame.h / H)
    setView({
      scale: fitScale,
      x: (frame.w - W * fitScale) / 2,
      y: (frame.h - H * fitScale) / 2,
    })
    didFitRef.current = true
  }, [frame.w, frame.h])

  const fitScale = useMemo(
    () => (frame.w && frame.h ? Math.min(frame.w / W, frame.h / H) : 1),
    [frame.w, frame.h],
  )
  const minScale = fitScale * MIN_SCALE_RATIO
  const maxScale = fitScale * MAX_SCALE_RATIO

  /** 특정 화면 좌표를 중심으로 줌 (앵커 유지). */
  const zoomAt = (px: number, py: number, factor: number) => {
    setView((v) => {
      const next = clamp(v.scale * factor, minScale, maxScale)
      const realFactor = next / v.scale
      return {
        scale: next,
        x: px - (px - v.x) * realFactor,
        y: py - (py - v.y) * realFactor,
      }
    })
  }

  // 휠 줌 — passive: false 로 native 등록 (스크롤 방지)
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18
      const v = viewRef.current
      const next = clamp(v.scale * factor, minScale, maxScale)
      const realFactor = next / v.scale
      setView({
        scale: next,
        x: px - (px - v.x) * realFactor,
        y: py - (py - v.y) * realFactor,
      })
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [minScale, maxScale])

  // 마우스 드래그
  const dragRef = useRef<{
    startX: number
    startY: number
    panX: number
    panY: number
    moved: number
  } | null>(null)

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: view.x,
      panY: view.y,
      moved: 0,
    }
    setDragging(true)
  }
  const onMouseMove = (e: React.MouseEvent) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    d.moved = Math.max(d.moved, Math.hypot(dx, dy))
    setView((v) => ({ ...v, x: d.panX + dx, y: d.panY + dy }))
  }
  const onMouseUp = () => {
    dragRef.current = null
    setDragging(false)
  }

  // 터치 — 1손가락 pan, 2손가락 핀치
  const pinchRef = useRef<{
    d: number
    cx: number
    cy: number
    scale: number
    x: number
    y: number
  } | null>(null)

  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const onTouchStart = (e: TouchEvent) => {
      const rect = el.getBoundingClientRect()
      if (e.touches.length === 2) {
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        const d = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
        const cx = (t1.clientX + t2.clientX) / 2 - rect.left
        const cy = (t1.clientY + t2.clientY) / 2 - rect.top
        const v = viewRef.current
        pinchRef.current = { d, cx, cy, scale: v.scale, x: v.x, y: v.y }
        dragRef.current = null
      } else if (e.touches.length === 1) {
        const v = viewRef.current
        dragRef.current = {
          startX: e.touches[0].clientX,
          startY: e.touches[0].clientY,
          panX: v.x,
          panY: v.y,
          moved: 0,
        }
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault()
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        const d = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
        const factor = d / pinchRef.current.d
        const next = clamp(pinchRef.current.scale * factor, minScale, maxScale)
        const realFactor = next / pinchRef.current.scale
        setView({
          scale: next,
          x: pinchRef.current.cx - (pinchRef.current.cx - pinchRef.current.x) * realFactor,
          y: pinchRef.current.cy - (pinchRef.current.cy - pinchRef.current.y) * realFactor,
        })
      } else if (e.touches.length === 1 && dragRef.current) {
        e.preventDefault()
        const d = dragRef.current
        const dx = e.touches[0].clientX - d.startX
        const dy = e.touches[0].clientY - d.startY
        d.moved = Math.max(d.moved, Math.hypot(dx, dy))
        setView((v) => ({ ...v, x: d.panX + dx, y: d.panY + dy }))
      }
    }
    const onTouchEnd = () => {
      dragRef.current = null
      pinchRef.current = null
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [minScale, maxScale])

  const reset = () => {
    setView({
      scale: fitScale,
      x: (frame.w - W * fitScale) / 2,
      y: (frame.h - H * fitScale) / 2,
    })
  }

  const handlePlaceClick = (p: Place) => {
    if (onPlaceClick) onPlaceClick(p)
    else nav(`/place/${p.id}`, { state: { place: p } })
  }

  return (
    <div
      ref={frameRef}
      className={clsx(
        'relative overflow-hidden bg-[#f4ecd8] select-none touch-none',
        className,
      )}
      style={{ cursor: dragging ? 'grabbing' : 'grab' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* World — 줌/팬이 적용되는 컨테이너 */}
      <div
        style={{
          position: 'absolute',
          width: W,
          height: H,
          transformOrigin: '0 0',
          transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
          willChange: 'transform',
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block' }}>
          <defs>
            <GyeongbukDefs />
          </defs>
          <GyeongbukSvg />
        </svg>

        {/* 핀들 — 일러스트 위에 absolute. inverse-scale 로 크기 유지. */}
        {mainlandPins.map((p) => {
          const def = CATEGORY_MAP[p.category]
          if (!def) return null
          return (
            <button
              key={p.id}
              type="button"
              title={p.name}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                // 드래그 중이었으면 클릭 무시
                if (dragRef.current && dragRef.current.moved > 4) return
                handlePlaceClick(p)
              }}
              style={{
                position: 'absolute',
                left: p.px,
                top: p.py,
                transform: `translate(-50%, -100%) scale(${1 / view.scale})`,
                transformOrigin: '50% 100%',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                zIndex: 5,
              }}
            >
              <PinIcon color={def.markerColor} emoji={def.emoji} />
            </button>
          )
        })}
      </div>

      {/* 울릉/독도 inset — 줌/팬과 분리, 우상단 고정 */}
      <div onMouseDown={(e) => e.stopPropagation()}>
        <UlleungInset places={ulleungPins} onPlaceClick={handlePlaceClick} />
      </div>

      {/* 줌 컨트롤 */}
      <div
        className="absolute bottom-3 right-3 flex flex-col gap-1 rounded-md border border-[#3a2d1e]/30 bg-[#f4ecd8]/90 p-1 shadow-sm backdrop-blur-sm"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="줌인"
          className="h-7 w-7 rounded text-[#3a2d1e] hover:bg-[#3a2d1e]/10"
          onClick={() => zoomAt(frame.w / 2, frame.h / 2, 1.3)}
        >
          +
        </button>
        <button
          type="button"
          aria-label="줌아웃"
          className="h-7 w-7 rounded text-[#3a2d1e] hover:bg-[#3a2d1e]/10"
          onClick={() => zoomAt(frame.w / 2, frame.h / 2, 1 / 1.3)}
        >
          −
        </button>
        <button
          type="button"
          aria-label="리셋"
          className="h-7 w-7 rounded text-[14px] text-[#3a2d1e] hover:bg-[#3a2d1e]/10"
          onClick={reset}
        >
          ⟲
        </button>
      </div>

      {/* 핀 카운트 / 줌 표시 */}
      <div className="absolute bottom-3 left-3 rounded-pill bg-[#f4ecd8]/85 px-3 py-1 font-mono text-[10px] text-[#3a2d1e]/70 backdrop-blur-sm">
        {mainlandPins.length + ulleungPins.length} pins · {(view.scale / fitScale).toFixed(1)}x
      </div>
    </div>
  )
}

function PinIcon({ color, emoji }: { color: string; emoji: string }) {
  return (
    <div
      style={{
        width: 28,
        height: 36,
        position: 'relative',
        filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.25))',
      }}
    >
      <svg viewBox="0 0 28 36" width="28" height="36" style={{ display: 'block' }}>
        <path
          d="M 14 0 C 6.5 0 1 5.2 1 12 C 1 21 14 34 14 34 C 14 34 27 21 27 12 C 27 5.2 21.5 0 14 0 Z"
          fill={color}
          stroke="#fff"
          strokeWidth="2"
        />
      </svg>
      <span
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 5,
          textAlign: 'center',
          fontSize: 13,
          lineHeight: 1,
          pointerEvents: 'none',
        }}
      >
        {emoji}
      </span>
    </div>
  )
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}
