#!/usr/bin/env node
/**
 * 한국관광공사 OpenAPI 활용신청 승인 상태 점검 — 1차 심사 제출 전 확인용.
 *
 * 소개서(기능설명서)에 적은 API 가 실제로 내 인증키로 호출되는지 한 번에 확인한다.
 * 운영사무국은 제출한 인증키로 API 별 호출건수와 활용 내역을 대조하므로,
 * 여기서 '미신청'으로 나오는 API 는 목록에서 빼야 한다.
 *
 * 사용법:
 *   TOUR_API_KEY='디코딩키' node doc/공모전/scripts/check-tour-apis.mjs
 *   (또는 frontend/.env.local 의 TOUR_API_KEY 를 자동으로 읽는다)
 *
 * 주의: 이 스크립트는 '지금 호출되는가'를 확인할 뿐, 개발 기간 누적 호출건수는
 *       공공데이터포털 마이페이지에서 따로 확인해야 한다.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const BASE = 'https://apis.data.go.kr/B551011'

function loadKey() {
  if (process.env.TOUR_API_KEY) return process.env.TOUR_API_KEY.trim()
  try {
    const envPath = resolve(HERE, '../../../frontend/.env.local')
    const line = readFileSync(envPath, 'utf8')
      .split('\n')
      .find((l) => l.startsWith('TOUR_API_KEY='))
    if (line) return line.slice('TOUR_API_KEY='.length).trim().replace(/^["']|["']$/g, '')
  } catch {
    /* .env.local 없음 — 아래에서 안내 */
  }
  return ''
}

/** 최근 완료된 달 — 빅데이터 서비스는 당월 데이터가 없다. */
function recentBaseYm(monthsAgo = 3) {
  const d = new Date()
  d.setMonth(d.getMonth() - monthsAgo)
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
}

const COMMON = { MobileOS: 'ETC', MobileApp: 'Shimmaru', _type: 'json', numOfRows: '1', pageNo: '1' }

/** 소개서 슬라이드 11~12 에 기재한 순서와 동일하게 둔다. */
const TARGETS = [
  { no: 1, label: 'KorService2 — 지역기반', path: 'KorService2/areaBasedList2', q: { areaCode: '35', arrange: 'A' } },
  { no: 1, label: 'KorService2 — 위치기반', path: 'KorService2/locationBasedList2', q: { mapX: '128.7294', mapY: '36.5684', radius: '5000' } },
  { no: 2, label: 'KorService2 — 키워드 검색', path: 'KorService2/searchKeyword2', q: { keyword: '서원', areaCode: '35' } },
  { no: 3, label: 'KorService2 — 공통정보', path: 'KorService2/detailCommon2', q: { contentId: '__CONTENT_ID__' } },
  { no: 3, label: 'KorService2 — 소개정보', path: 'KorService2/detailIntro2', q: { contentId: '__CONTENT_ID__', contentTypeId: '__CONTENT_TYPE_ID__' } },
  { no: 3, label: 'KorService2 — 이미지정보', path: 'KorService2/detailImage2', q: { contentId: '__CONTENT_ID__', imageYN: 'Y' } },
  { no: 4, label: 'EngService2 (영문)', path: 'EngService2/areaBasedList2', q: { areaCode: '35', arrange: 'A' } },
  { no: 4, label: 'JpnService2 (일문)', path: 'JpnService2/areaBasedList2', q: { areaCode: '35', arrange: 'A' } },
  { no: 4, label: 'ChsService2 (중문)', path: 'ChsService2/areaBasedList2', q: { areaCode: '35', arrange: 'A' } },
  { no: 5, label: 'KorWithService2 (무장애)', path: 'KorWithService2/areaBasedList2', q: { areaCode: '35', arrange: 'A' } },
  { no: 6, label: 'KorPetTourService2 (반려동물)', path: 'KorPetTourService2/areaBasedList2', q: { areaCode: '35', arrange: 'A' } },
  { no: 7, label: 'TarRlteTarService1 (연관 추천)', path: 'TarRlteTarService1/areaBasedList1', q: { baseYm: recentBaseYm(), areaCd: '47', signguCd: '47170' } },
  { no: 8, label: 'DataLabService (데이터랩)', path: 'DataLabService/locgoRegnVisitrDDList', q: { startYmd: `${recentBaseYm()}08`, endYmd: `${recentBaseYm()}14` } },
  { no: 9, label: 'PhokoAwrdService (사진 수상작)', path: 'PhokoAwrdService/phokoAwrdList', q: {} },
]

async function call(key, path, q) {
  const search = new URLSearchParams({ ...COMMON, ...q })
  search.set('serviceKey', key)
  const url = `${BASE}/${path}?${search.toString()}`
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000) })
    const text = await res.text()
    // 미신청 서비스는 게이트웨이가 JSON 이 아닌 평문/XML 오류를 돌려준다.
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      /* 평문 — 아래에서 분류 */
    }
    if (!json) {
      const s = text.toLowerCase()
      // 사내 프록시·방화벽 차단을 '미신청' 으로 오해하지 않도록 먼저 걸러낸다.
      if (s.includes('allowlist') || s.includes('egress') || s.includes('proxy')) {
        return { ok: false, verdict: '네트워크 차단', detail: '방화벽/프록시가 apis.data.go.kr 접속을 막고 있습니다' }
      }
      const denied =
        s.includes('forbidden') ||
        s.includes('unexpected') ||
        s.includes('service key') ||
        s.includes('not registered') ||
        s.includes('service_access_denied') ||
        [401, 403, 500].includes(res.status)
      return { ok: false, verdict: denied ? '미신청/거부' : '오류', detail: `HTTP ${res.status} ${text.slice(0, 80).replace(/\s+/g, ' ')}` }
    }
    const header = json?.response?.header ?? {}
    const code = header.resultCode
    const body = json?.response?.body ?? {}
    if (code && code !== '0000') {
      const denied = /ACCESS_DENIED|NOT_REGISTERED|SERVICE_KEY/i.test(String(header.resultMsg ?? ''))
      return { ok: false, verdict: denied ? '미신청/거부' : `오류 ${code}`, detail: String(header.resultMsg ?? '').slice(0, 60) }
    }
    const total = body.totalCount ?? 0
    const items = body?.items
    const first = typeof items === 'object' && items ? [].concat(items.item ?? [])[0] : null
    return { ok: true, verdict: total > 0 ? '정상' : '정상(0건)', detail: `totalCount=${total}`, first }
  } catch (e) {
    return { ok: false, verdict: '오류', detail: String(e).slice(0, 80) }
  }
}

const key = loadKey()
if (!key) {
  console.error('TOUR_API_KEY 가 없습니다. 공공데이터포털 마이페이지의 "일반 인증키(Decoding)" 를 넣어 주세요.')
  console.error("사용법: TOUR_API_KEY='디코딩키' node doc/공모전/scripts/check-tour-apis.mjs")
  process.exit(1)
}

console.log('한국관광공사 OpenAPI 활용 상태 점검\n')

// detailCommon2 등은 실제 contentId 가 필요하다 — 지역기반 조회에서 하나 빌려온다.
let contentId = ''
let contentTypeId = ''
const seed = await call(key, 'KorService2/areaBasedList2', { areaCode: '35', arrange: 'A' })
if (seed.first) {
  contentId = seed.first.contentid ?? ''
  contentTypeId = seed.first.contenttypeid ?? ''
}

const results = []
for (const t of TARGETS) {
  const q = Object.fromEntries(
    Object.entries(t.q).map(([k, v]) => [
      k,
      v === '__CONTENT_ID__' ? contentId : v === '__CONTENT_TYPE_ID__' ? contentTypeId : v,
    ]),
  )
  if (Object.values(q).some((v) => v === '')) {
    results.push({ ...t, verdict: '건너뜀', detail: 'contentId 확보 실패' })
    console.log(`  [${t.no}] ${t.label.padEnd(34)} 건너뜀 — contentId 확보 실패`)
    continue
  }
  const r = await call(key, t.path, q)
  results.push({ ...t, ...r })
  const mark = r.verdict === '정상' ? '✅' : r.verdict.startsWith('정상') ? '⚠️ ' : '❌'
  console.log(`  ${mark} [${t.no}] ${t.label.padEnd(34)} ${r.verdict.padEnd(12)} ${r.detail ?? ''}`)
}

const blocked = results.filter((r) => r.verdict === '네트워크 차단')
if (blocked.length > 0) {
  console.log('\n네트워크가 apis.data.go.kr 접속을 막고 있어 판정할 수 없습니다.')
  console.log('방화벽이 없는 환경(집/개인 노트북)에서 다시 실행해 주세요.')
  process.exit(2)
}

const denied = results.filter((r) => r.verdict === '미신청/거부')
console.log('')
if (denied.length === 0) {
  console.log('모든 API 가 호출됩니다. 소개서 슬라이드 11~12 목록을 그대로 두셔도 됩니다.')
} else {
  console.log('다음 API 는 인증키로 호출되지 않습니다 — 소개서 목록에서 빼야 합니다:')
  for (const d of denied) console.log(`  · [${d.no}] ${d.label}`)
  console.log('\n공공데이터포털에서 해당 서비스를 "활용신청"(무료·자동승인)하면 즉시 켜집니다.')
}
console.log('\n※ 개발 기간 누적 호출건수는 공공데이터포털 마이페이지 > 오픈API > 개발계정 에서 확인하세요.')
