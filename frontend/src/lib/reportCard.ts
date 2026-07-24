import { C, FONT, ellipsis, rr, wrapText } from '@/lib/courseCard'
import { CATEGORY_MAP } from '@/constants/categories'
import type { TravelReport } from '@/lib/report'

/**
 * Wrapped 공유 카드 — 1080×1350 (4:5, 인스타 피드 규격).
 * 페르소나 타이틀 + 4스탯 그리드. courseCard 의 캔버스 헬퍼를 재사용한다.
 */
const W = 1080
const H = 1350
const PAD = 84

export interface ReportCardTexts {
  brand: string
  region: string
  /** 페르소나 타이틀 (예: 숨은 경북 탐험가) */
  personaTitle: string
  /** 페르소나 한 줄 설명 */
  personaBody: string
  /** 스탯 라벨 4종 */
  statEntries: string
  statConquered: string
  statGems: string
  statTop: string
  footer: string
}

export async function renderReportCardBlob(
  report: TravelReport,
  tx: ReportCardTexts,
  topCategoryLabel?: string,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const scale = 2
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d unavailable')
  ctx.scale(scale, scale)

  // 배경 — 잉크 다크 (Wrapped 무드), 주황 포인트
  ctx.fillStyle = C.ink
  ctx.fillRect(0, 0, W, H)
  // 상단 브랜드
  let y = PAD + 44
  ctx.fillStyle = '#ffffff'
  ctx.font = FONT(700, 40)
  ctx.fillText(tx.brand, PAD, y)
  const bw = ctx.measureText(tx.brand).width
  ctx.fillStyle = C.primary
  ctx.fillText('·', PAD + bw + 14, y)
  ctx.fillStyle = C.mutedSoft
  ctx.font = FONT(500, 24)
  ctx.fillText(tx.region.toUpperCase(), PAD + bw + 38, y - 4)
  ctx.fillStyle = C.mutedSoft
  ctx.font = FONT(600, 24)
  const yr = 'WRAPPED 2026'
  ctx.fillText(yr, W - PAD - ctx.measureText(yr).width, y - 2)

  // 페르소나 이모지 + 타이틀
  y += 190
  const emoji = report.topCategory ? (CATEGORY_MAP[report.topCategory]?.emoji ?? '🧭') : '🧭'
  ctx.font = FONT(400, 120)
  ctx.fillText(emoji, PAD, y)
  y += 110
  ctx.fillStyle = '#ffffff'
  ctx.font = FONT(800, 76)
  y = wrapText(ctx, tx.personaTitle, PAD, y, W - PAD * 2, 92, 2)
  y += 56
  ctx.fillStyle = C.mutedSoft
  ctx.font = FONT(500, 32)
  wrapText(ctx, tx.personaBody, PAD, y, W - PAD * 2, 46, 3)

  // 스탯 그리드 2×2
  const gy = H - 460
  const cellW = (W - PAD * 2 - 40) / 2
  const cells: { label: string; value: string }[] = [
    { label: tx.statEntries, value: String(report.totalEntries) },
    { label: tx.statConquered, value: `${report.conquered} / ${report.totalSigungu}` },
    { label: tx.statGems, value: `🌿 ${report.gemVisits}` },
    { label: tx.statTop, value: topCategoryLabel ?? '—' },
  ]
  cells.forEach((cell, i) => {
    const cx = PAD + (i % 2) * (cellW + 40)
    const cy = gy + Math.floor(i / 2) * 160
    rr(ctx, cx, cy, cellW, 136, 20)
    ctx.fillStyle = 'rgba(255,255,255,0.07)'
    ctx.fill()
    ctx.fillStyle = C.mutedSoft
    ctx.font = FONT(600, 22)
    ctx.fillText(cell.label.toUpperCase(), cx + 28, cy + 46)
    ctx.fillStyle = i === 2 ? C.primary : '#ffffff'
    ctx.font = FONT(800, 46)
    ctx.fillText(ellipsis(ctx, cell.value, cellW - 56), cx + 28, cy + 104)
  })

  // 하단 출처
  ctx.fillStyle = C.mutedSoft
  ctx.font = FONT(500, 22)
  ctx.fillText(ellipsis(ctx, tx.footer, W - PAD * 2), PAD, H - 64)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  })
}
