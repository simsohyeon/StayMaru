/**
 * 날짜 문자열 유틸 — 순수 함수만. 코스 엔진(서버에서도 실행)이 쓰므로 api/ 모듈에 두지 않는다.
 * 기존 import 경로(@/api/tour 의 isoToYmd) 는 re-export 로 그대로 동작한다.
 */

/** "2026-10-02" → "20261002" */
export function isoToYmd(iso: string): string {
  return iso.replaceAll('-', '')
}

/** YYYYMMDD 에 일수를 더한다. 형식이 아니면 그대로 반환. */
export function shiftYmd(ymd: string, deltaDays: number): string {
  if (ymd.length !== 8) return ymd
  const d = new Date(Number(ymd.slice(0, 4)), Number(ymd.slice(4, 6)) - 1, Number(ymd.slice(6, 8)))
  d.setDate(d.getDate() + deltaDays)
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}
