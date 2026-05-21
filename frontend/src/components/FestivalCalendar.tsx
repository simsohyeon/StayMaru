import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import type { Festival } from '@/types/domain'

/**
 * 월 단위 축제 캘린더.
 * 각 날짜 셀에 그 날 진행 중인 축제 최대 2개 + 더 보기 카운트를 표시한다.
 */
export default function FestivalCalendar({ festivals }: { festivals: Festival[] }) {
  const { t, i18n } = useTranslation()
  const nav = useNavigate()
  const [view, setView] = useState(() => {
    const now = new Date()
    return { y: now.getFullYear(), m: now.getMonth() + 1 } // m: 1-12
  })

  const cells = useMemo(() => buildCells(view.y, view.m), [view.y, view.m])

  /** 해당 날짜에 걸쳐 있는 축제. (eventStartDate <= ymd <= eventEndDate) */
  function festivalsOnDay(y: number, m: number, d: number): Festival[] {
    const ymd = `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`
    return festivals.filter(
      (f) => f.eventStartDate && f.eventEndDate && f.eventStartDate <= ymd && ymd <= f.eventEndDate,
    )
  }

  function shiftMonth(delta: number) {
    setView((v) => {
      let m = v.m + delta
      let y = v.y
      while (m < 1) {
        m += 12
        y -= 1
      }
      while (m > 12) {
        m -= 12
        y += 1
      }
      return { y, m }
    })
  }

  const todayYmd = (() => {
    const d = new Date()
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  })()

  const weekdayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
  const monthLabel = (() => {
    // 한국어/중국어/일본어는 "YYYY년 M월" 형태, 영문은 "Month YYYY"
    const lang = i18n.language
    if (lang.startsWith('en')) {
      return new Date(view.y, view.m - 1).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
      })
    }
    return t('calendar.title', { y: view.y, m: view.m })
  })()

  return (
    <div className="rounded-lg border border-hairline bg-card p-3 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="h-8 w-8 rounded-md border border-hairline-strong bg-card text-ink hover:bg-canvas-soft"
          aria-label={t('calendar.prev')}
        >
          ‹
        </button>
        <h3 className="font-display text-title-md text-ink">{monthLabel}</h3>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="h-8 w-8 rounded-md border border-hairline-strong bg-card text-ink hover:bg-canvas-soft"
          aria-label={t('calendar.next')}
        >
          ›
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="mt-4 grid grid-cols-7 gap-1">
        {weekdayKeys.map((k, i) => (
          <div
            key={k}
            className={clsx(
              'text-center text-caption font-medium',
              i === 0 && 'text-rose-500',
              i === 6 && 'text-sky-600',
              i !== 0 && i !== 6 && 'text-muted',
            )}
          >
            {t(`calendar.weekday.${k}`)}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="mt-2 grid grid-cols-7 gap-1">
        {cells.map((c) => {
          const fs = festivalsOnDay(c.y, c.m, c.d)
          const ymd = `${c.y}${String(c.m).padStart(2, '0')}${String(c.d).padStart(2, '0')}`
          const isToday = ymd === todayYmd
          const dayOfWeek = (new Date(c.y, c.m - 1, c.d).getDay()) // 0=Sun
          return (
            <div
              key={`${c.y}-${c.m}-${c.d}`}
              className={clsx(
                'aspect-square flex flex-col gap-0.5 p-1 rounded text-[10px] border',
                c.inMonth ? 'border-hairline bg-canvas' : 'border-transparent opacity-30',
                isToday && 'ring-2 ring-primary border-primary',
              )}
            >
              <div
                className={clsx(
                  'text-right text-[11px] font-mono',
                  dayOfWeek === 0 && c.inMonth && 'text-rose-500',
                  dayOfWeek === 6 && c.inMonth && 'text-sky-600',
                  dayOfWeek !== 0 && dayOfWeek !== 6 && 'text-body',
                )}
              >
                {c.d}
              </div>
              <div className="flex-1 overflow-hidden space-y-0.5">
                {fs.slice(0, 2).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => nav(`/festivals/${f.id}`, { state: { festival: f } })}
                    title={f.name}
                    className="block w-full truncate rounded bg-primary/15 px-1 py-0.5 text-left text-[9px] text-primary hover:bg-primary/25"
                  >
                    {f.name}
                  </button>
                ))}
                {fs.length > 2 && (
                  <div className="text-[9px] text-muted">+{fs.length - 2}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-3 font-mono text-[10px] text-muted-soft">
        {t('calendar.hint')}
      </p>
    </div>
  )
}

/** 해당 월의 6주 x 7일 = 42개 셀 생성. 이전/다음 달 채우기 포함. */
function buildCells(y: number, m: number): { y: number; m: number; d: number; inMonth: boolean }[] {
  const firstDay = new Date(y, m - 1, 1).getDay() // 0=Sun
  const lastDate = new Date(y, m, 0).getDate()
  const prevLast = new Date(y, m - 1, 0).getDate()

  const cells: { y: number; m: number; d: number; inMonth: boolean }[] = []
  // 이전 달 꼬리
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevLast - i
    const pm = m === 1 ? 12 : m - 1
    const py = m === 1 ? y - 1 : y
    cells.push({ y: py, m: pm, d, inMonth: false })
  }
  // 이번 달
  for (let d = 1; d <= lastDate; d++) cells.push({ y, m, d, inMonth: true })
  // 다음 달 꼬리
  let nextD = 1
  while (cells.length < 42) {
    const nm = m === 12 ? 1 : m + 1
    const ny = m === 12 ? y + 1 : y
    cells.push({ y: ny, m: nm, d: nextD++, inMonth: false })
  }
  return cells
}
