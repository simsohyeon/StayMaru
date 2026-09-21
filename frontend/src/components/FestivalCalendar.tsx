import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons'
import { SIGUNGUS } from '@/constants/sigungu'
import { useSettings } from '@/stores/settings'
import type { Festival } from '@/types/domain'

/** 폰 셀에 찍는 점의 최대 개수 — 그 이상은 +N 으로 접는다. 40px 셀에 들어가는 한계. */
const MAX_DOTS = 3

/**
 * 월 단위 축제 캘린더.
 *
 * 화면 폭에 따라 셀이 담는 것이 다르다 — 셀은 정사각이라 가로 폭이 곧 높이다.
 *  - 데스크톱(md~): 셀이 100px 를 넘어 축제 이름 2개 + 더 보기 수가 그대로 들어간다.
 *  - 폰: 셀이 40~48px 뿐이라 이름을 넣으면 `포…` 로 잘려 읽을 수 없고 2개째부터는
 *    아예 가려졌다. 그래서 셀에는 점만 찍고, 날짜를 누르면 캘린더 아래에 그 날
 *    축제를 이름·기간·지역까지 온전히 펼친다.
 */
export default function FestivalCalendar({ festivals }: { festivals: Festival[] }) {
  const { t, i18n } = useTranslation()
  const nav = useNavigate()
  const lang = useSettings((s) => s.lang)
  const [view, setView] = useState(() => {
    const now = new Date()
    return { y: now.getFullYear(), m: now.getMonth() + 1 } // m: 1-12
  })
  /** 폰에서 아래 목록에 펼칠 날짜(YYYYMMDD). 달을 넘기면 지운다 — 보고 있는 달의 날짜만 고를 수 있다. */
  const [picked, setPicked] = useState<string | null>(null)

  const cells = useMemo(() => buildCells(view.y, view.m), [view.y, view.m])

  /** 해당 날짜에 걸쳐 있는 축제. (eventStartDate <= ymd <= eventEndDate) */
  function festivalsOnDay(y: number, m: number, d: number): Festival[] {
    const ymd = `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`
    return festivals.filter(
      (f) => f.eventStartDate && f.eventEndDate && f.eventStartDate <= ymd && ymd <= f.eventEndDate,
    )
  }

  function shiftMonth(delta: number) {
    setPicked(null)
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

  /** 아래 목록이 펼칠 날짜 — 고른 게 없으면 오늘. 오늘이 이 달이 아니면 아무것도 펼치지 않는다. */
  const todayInView = Number(todayYmd.slice(0, 4)) === view.y && Number(todayYmd.slice(4, 6)) === view.m
  const pickedYmd = picked ?? (todayInView ? todayYmd : null)
  const pickedFestivals = pickedYmd
    ? festivals.filter(
        (f) => f.eventStartDate && f.eventEndDate && f.eventStartDate <= pickedYmd && pickedYmd <= f.eventEndDate,
      )
    : []

  const dateClass = (dayOfWeek: number, inMonth: boolean) =>
    clsx(
      'fest-calendar__date',
      dayOfWeek === 0 && inMonth && 'fest-calendar__date--sun',
      dayOfWeek === 6 && inMonth && 'fest-calendar__date--sat',
      dayOfWeek !== 0 && dayOfWeek !== 6 && 'fest-calendar__date--day',
    )

  /** "9월 21일 (월)" — 언어별 표기는 Intl 에 맡긴다. */
  const dayLabel = (y: number, m: number, d: number) =>
    new Date(y, m - 1, d).toLocaleDateString(i18n.language, {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    })

  /** "9.21 – 9.29" — 연도는 같은 해면 접는다(셀 폭이 좁다). */
  const range = (f: Festival) => {
    const fmt = (ymd: string) => `${Number(ymd.slice(4, 6))}.${Number(ymd.slice(6, 8))}`
    const sameYear = f.eventStartDate.slice(0, 4) === f.eventEndDate.slice(0, 4)
    const end = sameYear ? fmt(f.eventEndDate) : `${f.eventEndDate.slice(0, 4)}.${fmt(f.eventEndDate)}`
    return f.eventStartDate === f.eventEndDate ? fmt(f.eventStartDate) : `${fmt(f.eventStartDate)} – ${end}`
  }

  const regionOf = (f: Festival) =>
    f.sigunguCode ? (SIGUNGUS.find((s) => s.code === f.sigunguCode)?.[lang] ?? '') : ''

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
          <ChevronLeftIcon width={18} height={18} />
        </button>
        <h3 className="fest-calendar__month">{monthLabel}</h3>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="fest-calendar__nav"
          aria-label={t('calendar.next')}
        >
          <ChevronRightIcon width={18} height={18} />
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
                ymd === pickedYmd && 'fest-calendar__cell--picked',
              )}
            >
              {/* 폰 — 셀 전체가 날짜 선택 버튼(탭 영역 확보). 축제는 점 개수로만 알린다. */}
              <button
                type="button"
                className="fest-calendar__pick"
                aria-pressed={ymd === pickedYmd}
                aria-label={dayLabel(c.y, c.m, c.d)}
                onClick={() => setPicked(ymd)}
              >
                <span className={dateClass(dayOfWeek, c.inMonth)}>{c.d}</span>
                {/* 점과 +N 은 한 줄에 — 줄을 나누면 360px(셀 40px)에서 넘친다. */}
                <span className="fest-calendar__dots" aria-hidden>
                  {Array.from({ length: Math.min(fs.length, MAX_DOTS) }, (_, i) => (
                    <i key={i} className="fest-calendar__dot" />
                  ))}
                  {fs.length > MAX_DOTS && (
                    <span className="fest-calendar__more">+{fs.length - MAX_DOTS}</span>
                  )}
                </span>
              </button>

              {/* 데스크톱 — 셀이 넓어 이름이 그대로 들어간다. 기존 동작 유지. */}
              <div className="fest-calendar__desk">
                <div className={dateClass(dayOfWeek, c.inMonth)}>{c.d}</div>
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
            </div>
          )
        })}
      </div>

      {/* 폰 전용 — 고른 날의 축제를 이름·기간·지역까지 온전히. 셀에서는 점으로만 알렸다. */}
      {pickedYmd && (
        <section className="fest-day">
          <h4 className="fest-day__title">
            {dayLabel(
              Number(pickedYmd.slice(0, 4)),
              Number(pickedYmd.slice(4, 6)),
              Number(pickedYmd.slice(6, 8)),
            )}
          </h4>
          {pickedFestivals.length === 0 ? (
            <p className="fest-day__empty">{t('calendar.dayEmpty')}</p>
          ) : (
            <>
              <p className="fest-day__count">{t('calendar.dayCount', { n: pickedFestivals.length })}</p>
              <ul className="fest-day__list">
                {pickedFestivals.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      className="fest-day__item"
                      onClick={() => nav(`/festivals/${f.id}`, { state: { festival: f } })}
                    >
                      <span className="fest-day__bar" aria-hidden />
                      <span className="fest-day__body">
                        <span className="fest-day__name">{f.name}</span>
                        <span className="fest-day__meta">
                          {range(f)}
                          {regionOf(f) && ` · ${regionOf(f)}`}
                        </span>
                      </span>
                      <ChevronRightIcon width={14} height={14} className="fest-day__chev" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
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
