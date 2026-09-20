/**
 * 서버 코스 생성이 쓰는 데이터 로더 — 후보 장소(DB), 축제(표준데이터), 강수 힌트(기상청).
 *
 * 클라이언트 Home.tsx 의 파이프라인(searchPlaces 팬아웃 → searchFestivals → fetchRainChance)을 서버에서
 * 재현한다. 매핑·정규화 규칙은 frontend/src/lib 의 순수 모듈을 그대로 import 해 한 곳에서 관리한다.
 * (상대 경로·.ts 확장자 import — 서버 번들러는 경로 별칭을 모르고, Node 검증 스크립트는 확장자를 요구한다.)
 *
 * 축제·날씨는 같은 배포의 /api/festival-std, /api/weather 를 self-fetch 한다 — 그 응답이 엣지 캐시
 * (24h / 30분)에 있어 업스트림을 매번 두들기지 않는다.
 */
import { fetchPlacesRaw, type Db } from './places-db.ts'
import { inferCategory, isAllowedItem, mapToPlace, type TourApiItem } from '../../frontend/src/lib/placeMapping.ts'
import { normalizeStdFestivals, pickStdRows, type StdResponse } from '../../frontend/src/lib/festivalStd.ts'
import {
  climatologyHint,
  latestBaseDateTime,
  rainHintFromForecast,
  toKst,
  ymd,
  type VilageResponse,
  type WeatherHint,
} from '../../frontend/src/lib/rainHint.ts'
import { findSigungu } from '../../frontend/src/constants/sigungu.ts'
import { isoToYmd, shiftYmd } from '../../frontend/src/lib/ymd.ts'
import type { DateRange, Festival, Lang, Place } from '../../frontend/src/types/domain.ts'

/** 거점 시군들의 적재 장소 전체 → Place. 클라이언트와 같은 허용 규칙·카테고리 추론을 적용한다. */
export async function loadCandidates(db: Db, lang: Lang, sigungus: number[]): Promise<Place[]> {
  const raw = (await fetchPlacesRaw(db, lang, sigungus)) as TourApiItem[]
  const seen = new Set<string>()
  const out: Place[] = []
  for (const it of raw) {
    if (!it.contentid || seen.has(it.contentid) || !isAllowedItem(it)) continue
    seen.add(it.contentid)
    const p = mapToPlace(it, inferCategory(it), lang)
    // 좌표 없는 항목은 거리 계산·지도 표시가 불가 — 후보에서 제외
    if (!p.position.lat || !p.position.lng) continue
    out.push(p)
  }
  return out
}

const STD_TIMEOUT_MS = 20_000

async function fetchStdPage(origin: string, pageNo: number): Promise<StdResponse> {
  // 업스트림이 동일 요청에도 간헐적으로 500 을 준다 — 클라이언트와 같이 1회 재시도.
  let lastErr: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(`${origin}/api/festival-std?type=json&numOfRows=1000&pageNo=${pageNo}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(STD_TIMEOUT_MS),
      })
      if (!r.ok) throw new Error(`festival-std p${pageNo} HTTP ${r.status}`)
      const data = (await r.json()) as StdResponse
      const header = (data.response ?? data).header
      const code = header?.resultCode
      if (code && code !== '00' && code !== '0000') {
        throw new Error(`festival-std resultCode=${code} (${header?.resultMsg ?? 'unknown'})`)
      }
      return data
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr
}

/**
 * 경북 축제 — 표준데이터 2페이지 합산 → 정규화. 여행 기간이 있으면 ±7일 겹치는 것만.
 * 한 페이지가 실패해도 성공분은 살린다. (클라이언트 searchFestivals 와 동일 규칙)
 */
export async function loadFestivals(origin: string, lang: Lang, range?: DateRange): Promise<Festival[]> {
  const pages = await Promise.allSettled([1, 2].map((p) => fetchStdPage(origin, p)))
  const rows = pages.flatMap((r) => (r.status === 'fulfilled' ? pickStdRows(r.value) : []))
  let fests = normalizeStdFestivals(rows, lang)
  if (range) {
    const startMinus = shiftYmd(isoToYmd(range.start), -7)
    const endPlus = shiftYmd(isoToYmd(range.end), 7)
    fests = fests.filter((f) => !(f.eventEndDate < startMinus || f.eventStartDate > endPlus))
  }
  return fests
}

/**
 * 거점 시군의 강수 힌트 — 기상청 단기예보 POP 최댓값, 실패·범위 밖이면 평년값.
 * 엣지 런타임은 UTC 라 KST 벽시계로 보정해 발표시각·대상일을 계산한다.
 */
export async function loadRainHint(origin: string, sigunguCode: number | undefined, date: Date): Promise<WeatherHint> {
  const kstDate = toKst(date)
  const sg = sigunguCode !== undefined ? findSigungu(sigunguCode) : undefined
  if (!sg) return climatologyHint(kstDate)
  const targetYmd = ymd(kstDate)
  try {
    const { baseDate, baseTime } = latestBaseDateTime(toKst(new Date()))
    const r = await fetch(
      `${origin}/api/weather?base_date=${baseDate}&base_time=${baseTime}&nx=${sg.gridX}&ny=${sg.gridY}&numOfRows=1000&pageNo=1`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(7000) },
    )
    if (!r.ok) return climatologyHint(kstDate)
    const data = (await r.json()) as VilageResponse
    return rainHintFromForecast(data, targetYmd) ?? climatologyHint(kstDate)
  } catch {
    return climatologyHint(kstDate)
  }
}
