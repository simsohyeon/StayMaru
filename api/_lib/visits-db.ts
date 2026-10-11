/**
 * 시군별 방문자 통계 DB 계층 — 한국관광 데이터랩(DataLabService) 수치를 Supabase 에 보관한다.
 *
 * 두 소비자:
 *  - api/sync-visits.ts : 데이터랩 → region_visits 적재 (하루 1회 크론)
 *  - api/visits.ts      : 적재된 값을 브라우저에 제공 (수 KB)
 *  - api/course.ts      : 서버 코스 엔진의 한적 가중치 (loadRegionVisits)
 *
 * 왜 서버에 두는가: locgoRegnVisitrDDList 는 지역 필터가 없어 전국 일자별 전체(약 1MB·7~9초)를
 * 돌려준다. 방문자마다 받게 두면 첫 로드가 느리고 공공 API 호출량이 사용자 수만큼 늘어난다.
 * 또 한 번 받아 두면 업스트림이 잠깐 실패해도 마지막 실제 수치를 쓸 수 있어, 화면을
 * 추정 상수로 대체할 이유가 없어진다.
 *
 * 스키마: supabase/migrations/20261011_region_visits.sql
 */
import { pgrest, type Db } from './places-db.js'
import { GB_LDONG_AREA_CD, LDONG_TO_SIGUNGU } from '../../frontend/src/constants/sigungu.js'

export interface RegionVisitRow {
  sigungu_code: number
  visitors: number
  base_ym: string
  synced_at: string
}

export interface VisitsSnapshot {
  items: { sigunguCode: number; visitors: number }[]
  /** 데이터가 실제로 잡힌 기준 연월 YYYYMM */
  baseYm?: string
  /** 마지막 적재 시각 ISO */
  syncedAt?: string
}

/* ─────────────────────────────── 읽기·쓰기 ─────────────────────────────── */

/** 적재된 방문자 통계 전체. 비어 있으면 items: []. */
export async function loadRegionVisits(db: Db): Promise<VisitsSnapshot> {
  const res = await pgrest(db, 'GET', 'region_visits?select=*&order=visitors.desc')
  const rows = (await res.json()) as RegionVisitRow[]
  if (rows.length === 0) return { items: [] }
  return {
    items: rows.map((r) => ({ sigunguCode: r.sigungu_code, visitors: Number(r.visitors) })),
    baseYm: rows[0].base_ym,
    // 행마다 같은 시각이지만, 부분 실패를 감추지 않도록 가장 오래된 것을 쓴다.
    syncedAt: rows.reduce((a, r) => (r.synced_at < a ? r.synced_at : a), rows[0].synced_at),
  }
}

/** 통째로 교체 — 시군 목록이 바뀌어도 옛 행이 남지 않게 upsert 후 이번 적재분 밖을 지운다. */
export async function replaceRegionVisits(
  db: Db,
  items: { sigunguCode: number; visitors: number }[],
  baseYm: string,
  at: string,
): Promise<void> {
  if (items.length === 0) return
  const rows: RegionVisitRow[] = items.map((v) => ({
    sigungu_code: v.sigunguCode,
    visitors: Math.round(v.visitors),
    base_ym: baseYm,
    synced_at: at,
  }))
  await pgrest(db, 'POST', 'region_visits', {
    body: rows,
    prefer: 'resolution=merge-duplicates,return=minimal',
  })
  await pgrest(db, 'DELETE', `region_visits?synced_at=lt.${encodeURIComponent(at)}`)
}

/* ────────────────────────────── 데이터랩 조회 ────────────────────────────── */

const DATALAB_URL = 'https://apis.data.go.kr/B551011/DataLabService/locgoRegnVisitrDDList'
const UPSTREAM_TIMEOUT_MS = 25_000

export type FetchStatus = 'ok' | 'empty' | 'not-subscribed' | 'error'

interface RawResponse {
  response?: {
    header?: { resultCode?: string; resultMsg?: string }
    body?: { items?: { item?: Record<string, string>[] | Record<string, string> } | string }
  }
}

/**
 * 빅데이터 통계는 2~4개월 지연 공개된다. 최신 가용 baseYm 을 모르므로
 * (오늘 - lagMonths) 부터 과거로 한 달씩 내려가며 데이터가 잡히는 첫 달을 쓴다.
 */
function recentBaseYms(count = 8, lagMonths = 2): string[] {
  const out: string[] = []
  const d = new Date()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() - lagMonths)
  for (let i = 0; i < count; i++) {
    out.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
    d.setUTCMonth(d.getUTCMonth() - 1)
  }
  return out
}

function pickItems(res: RawResponse): Record<string, string>[] {
  const items = res?.response?.body?.items
  if (!items || typeof items === 'string') return []
  const v = items.item
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

/** 한 달치 호출. 게이트웨이가 평문으로 거부하는 경우(활용신청 누락)까지 분류한다. */
async function callDataLab(
  apiKey: string,
  baseYm: string,
): Promise<{ items: Record<string, string>[]; status: FetchStatus }> {
  const q = new URLSearchParams({
    serviceKey: apiKey,
    MobileOS: 'ETC',
    MobileApp: 'Shimmaru',
    _type: 'json',
    // 월 2주차(08~14) 한 주 — 월초·월말 경계와 주말 편중을 줄인 대표 주간.
    startYmd: `${baseYm}08`,
    endYmd: `${baseYm}14`,
    numOfRows: '10000',
    pageNo: '1',
  })
  let res: Response
  try {
    res = await fetch(`${DATALAB_URL}?${q}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch {
    return { items: [], status: 'error' }
  }
  const text = await res.text().catch(() => '')
  let data: RawResponse | undefined
  try {
    data = JSON.parse(text) as RawResponse
  } catch {
    // 평문 응답 = 게이트웨이 거부. 활용신청 누락이 대부분.
    const s = text.toLowerCase()
    const denied =
      s.includes('forbidden') || s.includes('unexpected') || s.includes('service key') || s.includes('not registered')
    return { items: [], status: denied || res.status === 401 || res.status === 403 ? 'not-subscribed' : 'error' }
  }
  const code = data?.response?.header?.resultCode
  if (code && code !== '0000') {
    // 30/20/10 = 키 미등록·미신청 계열
    return { items: [], status: ['30', '20', '10'].includes(code) ? 'not-subscribed' : 'error' }
  }
  return { items: pickItems(data), status: 'ok' }
}

/**
 * 경북 시군별 "외부 방문객(외지인+외국인)" 합계.
 * API 가 지역 필터를 받지 않아 전국을 받고 경북(47xxx)만 거른다.
 * 인구에 비례해 쏠리는 현지인(touDivCd=1)은 빼야 관광 신호에 가깝다.
 */
export async function fetchVisitsFromDataLab(
  apiKey: string,
): Promise<{ items: { sigunguCode: number; visitors: number }[]; baseYm?: string; status: FetchStatus }> {
  let lastStatus: FetchStatus = 'empty'
  for (const baseYm of recentBaseYms()) {
    const { items, status } = await callDataLab(apiKey, baseYm)
    lastStatus = status
    if (status === 'not-subscribed') return { items: [], status }
    if (status !== 'ok' || items.length === 0) continue

    const sums = new Map<number, number>()
    for (const it of items) {
      const sgCode = LDONG_TO_SIGUNGU[it.signguCode ?? '']
      if (!sgCode) continue // 경북(47xxx) 외 또는 포항 통합코드(47110) 제외
      if (it.touDivCd !== '2' && it.touDivCd !== '3') continue // 외지인 + 외국인만
      const n = Number(it.touNum ?? 0)
      if (Number.isFinite(n) && n > 0) sums.set(sgCode, (sums.get(sgCode) ?? 0) + n)
    }
    if (sums.size === 0) continue
    const out = [...sums.entries()]
      .map(([sigunguCode, visitors]) => ({ sigunguCode, visitors: Math.round(visitors) }))
      .sort((a, b) => b.visitors - a.visitors)
    return { items: out, baseYm, status: 'ok' }
  }
  return { items: [], status: lastStatus }
}

export { GB_LDONG_AREA_CD }
