/**
 * 이동·체류 시간 표기 — 분이 커지면 "시간 + 분"으로 끊어 읽힌다.
 *
 * 326분·727분처럼 큰 값을 분 단위로만 두면 얼마나 긴 이동인지 읽히지 않는다.
 * 60분 미만은 기존처럼 분으로 두고, 그 이상만 시간을 앞세운다.
 */

/** 분을 시/분으로 쪼갠다. 음수·NaN 은 0 으로 본다. */
export function splitMinutes(total: number): { h: number; m: number } {
  const safe = Number.isFinite(total) && total > 0 ? Math.round(total) : 0
  return { h: Math.floor(safe / 60), m: safe % 60 }
}

/** i18n 의 t 중 이 모듈이 쓰는 부분만. (react-i18next 전체 타입을 끌어오지 않는다) */
type Translate = (key: string, opts?: Record<string, unknown>) => string

/**
 * "5시간 26분" / "12시간" / "45분" — 단위까지 포함한 완성 문구.
 * 값과 단위를 나눠 쓰는 자리(Stat 카드)는 `formatDurationParts` 를 쓴다.
 */
export function formatDuration(total: number, t: Translate): string {
  const { h, m } = splitMinutes(total)
  if (h === 0) return `${m}${t('course.min')}`
  return m === 0 ? t('course.hourOnly', { h }) : t('course.hourMin', { h, m })
}

/**
 * 값/단위가 분리된 자리용. 60분 미만이면 기존처럼 숫자와 '분' 을 나눠 주고,
 * 그 이상이면 완성 문구를 value 에 담고 unit 은 비운다(숫자만 키우면 오히려 안 읽힌다).
 */
export function formatDurationParts(total: number, t: Translate): { value: string; unit: string } {
  const { h } = splitMinutes(total)
  if (h === 0) return { value: `${splitMinutes(total).m}`, unit: t('course.min') }
  return { value: formatDuration(total, t), unit: '' }
}
