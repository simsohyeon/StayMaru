import type { Festival } from '@/types/domain'

/**
 * 축제를 iCalendar(.ics) 종일 일정으로 변환·다운로드.
 * "캘린더에 추가" 재방문 훅 — 사용자가 축제 일정을 자기 캘린더에 담아 다시 찾게 한다.
 * 외부 의존성 없이 표준 VEVENT 만 생성한다.
 */

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** YYYYMMDD 종료일은 ICS DTEND 가 exclusive 라 +1일 해야 마지막 날까지 포함된다. */
function addDay(ymd: string): string {
  if (ymd.length !== 8) return ymd
  const d = new Date(Number(ymd.slice(0, 4)), Number(ymd.slice(4, 6)) - 1, Number(ymd.slice(6, 8)))
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

export function festivalToIcs(f: Festival): string {
  const start = f.eventStartDate?.length === 8 ? f.eventStartDate : ''
  const end = addDay(f.eventEndDate || f.eventStartDate)
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Shimmaru//Gyeongbuk Festivals//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:shimmaru-${f.id}@shimmaru.app`,
    `DTSTAMP:${stamp}`,
    start ? `DTSTART;VALUE=DATE:${start}` : '',
    end ? `DTEND;VALUE=DATE:${end}` : '',
    `SUMMARY:${esc(f.name)}`,
    f.address ? `LOCATION:${esc(f.address)}` : '',
    f.homepage ? `URL:${esc(f.homepage)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)
  return lines.join('\r\n')
}

export function downloadFestivalIcs(f: Festival): void {
  const blob = new Blob([festivalToIcs(f)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${f.name.replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 40) || 'festival'}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
