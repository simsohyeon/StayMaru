import QRCode from 'qrcode'
import { splitIntoDays } from '@/lib/itinerary'
import { CATEGORY_MAP } from '@/constants/categories'
import type { Course } from '@/types/domain'

/**
 * 코스 티켓 카드 — Canvas 2D 로 그리는 공유용 PNG.
 *
 * 기차표 티켓 메타포: 본권(제목·DAY 일정·Slow Index)과 스텁(QR)을
 * 절취선(perforation) + 사이드 노치로 구분한다. QR 을 스캔하면
 * /course/shared/:payload 로 코스가 그대로 열린다 (기존 공유 포맷 재사용).
 *
 * 외부 의존성은 qrcode 뿐 — html2canvas 류 없이 직접 그려서 가볍고 결정적이다.
 */

const W = 1080
const H = 1620
const PAD = 76

// 브랜드 토큰 (tailwind.config 와 동일 값) — reportCard 등 다른 캔버스 렌더러와 공유.
export const C = {
  canvas: '#f7f7f4',
  card: '#ffffff',
  ink: '#26251e',
  body: '#5a5852',
  muted: '#807d72',
  mutedSoft: '#a09c92',
  hairline: '#e6e5e0',
  primary: '#f54e00',
  primarySoft: '#fde8dd',
  emerald: '#0f8a5f',
  sky: '#2a78d6',
} as const

export const FONT = (weight: number, px: number) =>
  `${weight} ${px}px Pretendard, "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`

export interface CardTexts {
  /** 쉼(休)마루 */
  brand: string
  /** 경상북도 */
  region: string
  /** 코스 유형 라벨 (선택) */
  profileLabel?: string
  /** 곳 / km / 분 단위 */
  placesUnit: string
  km: string
  min: string
  /** 머무름/한적 지수 라벨 + 값 */
  stayLabel: string
  quietLabel: string
  stayScore: number
  quietScore: number
  /** 숨은 보석 라인 (없으면 미표시) — 예: "숨은 보석 · 봉화군" */
  gemsLine?: string
  /** QR 안내 문구 */
  scanHint: string
  /** 하단 출처 */
  footer: string
}

/** 코스 → 티켓 카드 PNG Blob. 실패 시 throw — 호출부에서 토스트 처리. */
export async function renderCourseCardBlob(
  course: Course,
  shareUrl: string,
  tx: CardTexts,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const scale = 2 // 레티나 선명도
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d unavailable')
  ctx.scale(scale, scale)

  // ── 배경 + 카드 면 ──────────────────────────────────────────────
  ctx.fillStyle = C.canvas
  ctx.fillRect(0, 0, W, H)
  rr(ctx, 28, 28, W - 56, H - 56, 36)
  ctx.fillStyle = C.card
  ctx.fill()
  ctx.strokeStyle = C.hairline
  ctx.lineWidth = 2
  ctx.stroke()

  // ── 헤더: 브랜드 + 지역 ────────────────────────────────────────
  let y = PAD + 56
  ctx.fillStyle = C.ink
  ctx.font = FONT(700, 44)
  ctx.fillText(tx.brand, PAD, y)
  const brandW = ctx.measureText(tx.brand).width
  ctx.fillStyle = C.primary
  ctx.font = FONT(700, 44)
  ctx.fillText('·', PAD + brandW + 16, y)
  ctx.fillStyle = C.mutedSoft
  ctx.font = FONT(500, 26)
  ctx.fillText(tx.region.toUpperCase(), PAD + brandW + 42, y - 4)
  if (tx.profileLabel) {
    ctx.font = FONT(600, 24)
    const pw = ctx.measureText(tx.profileLabel).width
    rr(ctx, W - PAD - pw - 36, y - 34, pw + 36, 46, 23)
    ctx.fillStyle = C.primarySoft
    ctx.fill()
    ctx.fillStyle = C.primary
    ctx.fillText(tx.profileLabel, W - PAD - pw - 18, y - 2)
  }

  // ── 제목 (최대 2줄 말줄임) ─────────────────────────────────────
  y += 82
  ctx.fillStyle = C.ink
  ctx.font = FONT(800, 58)
  y = wrapText(ctx, course.title || '—', PAD, y, W - PAD * 2, 74, 2)

  // ── 메타: 기간 · n곳 · km · 분 ────────────────────────────────
  y += 14
  ctx.fillStyle = C.body
  ctx.font = FONT(500, 30)
  const range = course.dateRange
    ? `${course.dateRange.start.replaceAll('-', '.')} – ${course.dateRange.end.replaceAll('-', '.')}`
    : undefined
  const meta = [
    range,
    `${course.items.length}${tx.placesUnit}`,
    `${course.totalDistanceKm}${tx.km}`,
    `${course.estimatedTravelMinutes}${tx.min}`,
  ]
    .filter(Boolean)
    .join('  ·  ')
  ctx.fillText(meta, PAD, y)

  // ── 절취선 1 ───────────────────────────────────────────────────
  y += 44
  perforation(ctx, y)

  // ── DAY 일정 ───────────────────────────────────────────────────
  y += 64
  const days = splitIntoDays(course)
  const multiDay = days.length > 1
  // 행 예산: 스텁 시작 전까지. 넘치면 "+n" 처리.
  const stubTop = H - 396
  const rowH = 56
  const dayHeadH = 60
  let idx = 0
  let truncated = 0
  outer: for (const dp of days) {
    if (multiDay) {
      if (y + dayHeadH > stubTop - 150) {
        truncated = course.items.length - idx
        break
      }
      ctx.fillStyle = C.primary
      ctx.font = FONT(700, 26)
      ctx.fillText(`DAY ${dp.day}`, PAD, y)
      const dw = ctx.measureText(`DAY ${dp.day}`).width
      ctx.fillStyle = C.mutedSoft
      ctx.font = FONT(500, 24)
      ctx.fillText(
        `${dp.items.length}${tx.placesUnit} · ${dp.distanceKm}${tx.km}`,
        PAD + dw + 20,
        y,
      )
      ctx.strokeStyle = C.hairline
      ctx.beginPath()
      ctx.moveTo(PAD + dw + 220, y - 8)
      ctx.lineTo(W - PAD, y - 8)
      ctx.stroke()
      y += 46
    }
    for (const it of dp.items) {
      if (y + rowH > stubTop - 120) {
        truncated = course.items.length - idx
        break outer
      }
      idx++
      ctx.fillStyle = C.mutedSoft
      ctx.font = FONT(600, 26)
      ctx.fillText(String(idx).padStart(2, '0'), PAD, y)
      const emoji = CATEGORY_MAP[it.place.category]?.emoji ?? '📍'
      ctx.font = FONT(400, 30)
      ctx.fillText(emoji, PAD + 56, y)
      ctx.fillStyle = C.ink
      ctx.font = FONT(600, 32)
      ctx.fillText(ellipsis(ctx, it.place.name, W - PAD * 2 - 110), PAD + 110, y)
      y += rowH
    }
    y += multiDay ? 16 : 0
  }
  if (truncated > 0) {
    ctx.fillStyle = C.mutedSoft
    ctx.font = FONT(500, 28)
    ctx.fillText(`+${truncated}`, PAD, y)
  }

  // ── Slow Index 미니 바 + 숨은 보석 ─────────────────────────────
  const sy = stubTop - 108
  if (tx.gemsLine) {
    ctx.fillStyle = C.primary
    ctx.font = FONT(600, 27)
    ctx.fillText(`🌿 ${ellipsis(ctx, tx.gemsLine, W - PAD * 2)}`, PAD, sy + 88)
  }
  miniBar(ctx, PAD, sy, tx.stayLabel, tx.stayScore, C.emerald)
  miniBar(ctx, W / 2 + 20, sy, tx.quietLabel, tx.quietScore, C.sky)

  // ── 절취선 2 + 스텁 (QR) ───────────────────────────────────────
  perforation(ctx, stubTop)
  const qrSize = 232
  const qrY = stubTop + 46
  const qrData = await QRCode.toDataURL(shareUrl, {
    width: qrSize * scale,
    margin: 1,
    color: { dark: C.ink, light: '#ffffff' },
    errorCorrectionLevel: 'M',
  })
  const qrImg = await loadImage(qrData)
  rr(ctx, PAD - 10, qrY - 10, qrSize + 20, qrSize + 20, 16)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.strokeStyle = C.hairline
  ctx.stroke()
  ctx.drawImage(qrImg, PAD, qrY, qrSize, qrSize)

  const txX = PAD + qrSize + 52
  ctx.fillStyle = C.ink
  ctx.font = FONT(700, 34)
  wrapText(ctx, tx.scanHint, txX, qrY + 52, W - PAD - txX, 46, 2)
  ctx.fillStyle = C.mutedSoft
  ctx.font = FONT(500, 24)
  ctx.fillText(ellipsis(ctx, new URL(shareUrl).host, W - PAD - txX), txX, qrY + 150)
  ctx.fillStyle = C.muted
  ctx.font = FONT(500, 22)
  ctx.fillText(ellipsis(ctx, tx.footer, W - PAD - txX), txX, qrY + qrSize - 6)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  })
}

// ─── 그리기 헬퍼 ─────────────────────────────────────────────────

/** roundRect 폴리필 겸용 헬퍼 — path 만 만든다. */
export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** 티켓 절취선 — 대시 라인 + 좌우 노치(배경색 원). */
function perforation(ctx: CanvasRenderingContext2D, y: number) {
  ctx.save()
  ctx.strokeStyle = C.hairline
  ctx.lineWidth = 3
  ctx.setLineDash([12, 10])
  ctx.beginPath()
  ctx.moveTo(56, y)
  ctx.lineTo(W - 56, y)
  ctx.stroke()
  ctx.restore()
  for (const cx of [28, W - 28]) {
    ctx.beginPath()
    ctx.arc(cx, y, 22, 0, Math.PI * 2)
    ctx.fillStyle = C.canvas
    ctx.fill()
    ctx.strokeStyle = C.hairline
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

/** Slow Index 미니 게이지 (0~10). */
function miniBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  score: number,
  color: string,
) {
  const w = W / 2 - PAD - 40
  ctx.fillStyle = C.mutedSoft
  ctx.font = FONT(600, 23)
  ctx.fillText(label.toUpperCase(), x, y)
  ctx.fillStyle = C.ink
  ctx.font = FONT(700, 26)
  const s = `${score.toFixed(1)} / 10`
  ctx.fillText(s, x + w - ctx.measureText(s).width, y)
  rr(ctx, x, y + 14, w, 14, 7)
  ctx.fillStyle = C.hairline
  ctx.fill()
  rr(ctx, x, y + 14, Math.max(10, (w * Math.min(10, score)) / 10), 14, 7)
  ctx.fillStyle = color
  ctx.fill()
}

/** 여러 줄 wrap — maxLines 초과분은 말줄임. 마지막으로 쓴 baseline y 를 반환. */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
  maxLines: number,
): number {
  const chars = [...text]
  let line = ''
  let lines = 0
  let lastY = y
  for (let i = 0; i < chars.length; i++) {
    const test = line + chars[i]
    if (ctx.measureText(test).width > maxW && line !== '') {
      if (lines === maxLines - 1) {
        ctx.fillText(ellipsis(ctx, line + chars.slice(i).join(''), maxW), x, y)
        return y
      }
      ctx.fillText(line, x, y)
      lines++
      lastY = y
      y += lineH
      line = chars[i]
    } else {
      line = test
    }
  }
  if (line) {
    ctx.fillText(line, x, y)
    lastY = y
  }
  return lastY
}

/** 폭 초과 시 "…" 말줄임. */
export function ellipsis(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  const chars = [...text]
  let out = ''
  for (const ch of chars) {
    if (ctx.measureText(out + ch + '…').width > maxW) break
    out += ch
  }
  return out + '…'
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
