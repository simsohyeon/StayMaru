import type { TFunction } from 'i18next'
import { findSigungu } from '@/constants/sigungu'
import type { Lang, TripDuration } from '@/types/domain'

/**
 * 큐레이션 코스 카드 하단 라벨 — "포항 · 영덕 · 1박 2일".
 *
 * 예전엔 `badge: 'POHANG + YEONGDEOK · 1N2D'` 영문 문자열을 데이터에 직접 박았는데,
 * sigunguCodes/duration 이 이미 있으므로 여기서 파생시켜 4개 언어를 모두 커버한다.
 */

const DURATION_KEY: Record<TripDuration, string> = {
  day: 'duration.day',
  '1n2d': 'duration.n1d2',
  '2n3d': 'duration.n2d3',
  custom: 'duration.custom',
}

/** 시군구 이름에서 행정 접미(시·군 / 市·郡)를 떼어 짧게. 영문은 그대로. */
function shortName(name: string): string {
  return name.replace(/[시군市郡]$/, '')
}

export function curatedRegionLabel(c: { sigunguCodes: number[] }, lang: Lang): string {
  return c.sigunguCodes
    .map((code) => findSigungu(code)?.[lang])
    .filter((n): n is string => !!n)
    .map(shortName)
    .join(' · ')
}

export function curatedDurationLabel(duration: TripDuration, t: TFunction): string {
  return t(DURATION_KEY[duration])
}

export function curatedCourseLabel(
  c: { sigunguCodes: number[]; duration: TripDuration },
  lang: Lang,
  t: TFunction,
): string {
  return [curatedRegionLabel(c, lang), curatedDurationLabel(c.duration, t)]
    .filter(Boolean)
    .join(' · ')
}
