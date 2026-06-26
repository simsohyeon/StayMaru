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
    <div className="fest-calendar">
      <div className="fest-calendar__header">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="fest-calendar__nav"
          aria-label={t('calendar.prev')}
        >
          ‹
        </button>
        <h3 className="fest-calendar__month">{monthLabel}</h3>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="fest-calendar__nav"
          aria-label={t('calendar.next')}
        >
          ›
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="fest-calendar__weekdays">
        {weekdayKeys.map((k, i) => (
          <div
            key={k}
            className={clsx(
              'fest-calendar__weekday',
              i === 0 && 'fest-calendar__weekday--sun',
              i === 6 && 'fest-calendar__weekday--sat',
              i !== 0 && i !== 6 && 'fest-calendar__weekday--day',
            )}
          >
            {t(`calendar.weekday.${k}`)}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="fest-calendar__grid">
        {cells.map((c) => {
          const fs = festivalsOnDay(c.y, c.m, c.d)
          const ymd = `${c.y}${String(c.m).padStart(2, '0')}${String(c.d).padStart(2, '0')}`
          const isToday = ymd === todayYmd
          const dayOfWeek = (new Date(c.y, c.m - 1, c.d).getDay()) // 0=Sun
          return (
            <div
              key={`${c.y}-${c.m}-${c.d}`}
              className={clsx(
                'fest-calendar__cell',
                c.inMonth ? 'fest-calendar__cell--in' : 'fest-calendar__cell--out',
                isToday && 'fest-calendar__cell--today',
              )}
            >
              <div
                className={clsx(
                  'fest-calendar__date',
                  dayOfWeek === 0 && c.inMonth && 'fest-calendar__date--sun',
                  dayOfWeek === 6 && c.inMonth && 'fest-calendar__date--sat',
                  dayOfWeek !== 0 && dayOfWeek !== 6 && 'fest-calendar__date--day',
                )}
              >
                {c.d}
              </div>
              <div className="fest-calendar__events">
                {fs.slice(0, 2).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => nav(`/festivals/${f.id}`, { state: { festival: f } })}
                    title={f.name}
                    className="fest-calendar__event"
                  >
                    {f.name}
                  </button>
                ))}
                {fs.length > 2 && (
                  <div className="fest-calendar__more">+{fs.length - 2}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="fest-calendar__hint">
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
