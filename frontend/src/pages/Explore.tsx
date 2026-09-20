import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import TopBar from '@/components/TopBar'
import KhsPageHeader from '@/components/khs/KhsPageHeader'
import KakaoMap from '@/components/KakaoMap'
import PlaceCard from '@/components/PlaceCard'
import TempleStayCard from '@/components/TempleStayCard'
import CategoryBadge from '@/components/CategoryBadge'
import Thumbnail from '@/components/Thumbnail'
import FavoriteStar from '@/components/FavoriteStar'
import ErrorRetry from '@/components/ErrorRetry'
import { SkeletonGrid } from '@/components/Skeleton'
import { useFavorites } from '@/stores/favorites'
import { CATEGORIES, RESTAURANT_CUISINES } from '@/constants/categories'
import { fetchGyeongbukVisitors } from '@/api/bigdata'
import { THEME_MAP } from '@/constants/themes'
import { findSigungu, SIGUNGUS, isInGyeongbuk } from '@/constants/sigungu'
import { useSettings } from '@/stores/settings'
import { useLocation } from '@/stores/location'
import { searchPlaces, searchAround, searchFestivals, searchAccessiblePlaces, countPlaces } from '@/api/tour'
import { fetchTemples, type Temple } from '@/api/templestay'
import { haversineKm } from '@/lib/geo'
import { quietRankFor } from '@/lib/visitorIndex'
import { loadVisitorBoost } from '@/api/bigdata'
import { useToasts } from '@/stores/toasts'
import { CloseIcon, SparkleIcon, AccessibleIcon, SearchIcon } from '@/components/icons'
import type { CategoryId, Festival, Place } from '@/types/domain'

type SortKey = 'popular' | 'distance' | 'quiet'
type Radius = 5 | 10 | 20 | 0

const PAGE_SIZE = 18

export default function Explore() {
  const { t } = useTranslation()
  const [sp, setSp] = useSearchParams()
  const nav = useNavigate()
  const lang = useSettings((s) => s.lang)
  const loc = useLocation()
  const pushToast = useToasts((s) => s.show)

  const initialSigungu = sp.get('sigungu') ? Number(sp.get('sigungu')) : undefined
  const initialCategory = (sp.get('cat') as CategoryId | null) ?? undefined
  const initialTheme = sp.get('theme') ?? undefined
  const initialPage = sp.get('page') ? Math.max(1, Number(sp.get('page'))) : 1

  // 테마 진입 시 카테고리/키워드/시군을 자동 결정 (초기 mount 1회만)
  const themeDef = initialTheme ? THEME_MAP[initialTheme] : undefined
  const [theme, setTheme] = useState<string | undefined>(initialTheme)
  const [category, setCategory] = useState<CategoryId | undefined>(
    initialCategory ?? themeDef?.categories?.[0],
  )
  const [sigunguCode, setSigunguCode] = useState<number | undefined>(
    initialSigungu ?? themeDef?.preferredSigungus?.[0],
  )
  // ?q= 로 진입(빅데이터 연관추천 칩 등) 시 키워드 검색을 바로 수행.
  const [keyword, setKeyword] = useState(sp.get('q') ?? themeDef?.keyword ?? '')
  // 검색창 입력값(즉시) — keyword(실제 검색어)는 위 디바운스/Enter 로 반영.
  const [inputValue, setInputValue] = useState(sp.get('q') ?? themeDef?.keyword ?? '')
  const [sort, setSort] = useState<SortKey>('popular')
  const [radius, setRadius] = useState<Radius>(0)
  const [items, setItems] = useState<Place[]>([])
  const [temples, setTemples] = useState<Temple[]>([])
  const [festivals, setFestivals] = useState<Festival[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [pageNo, setPageNo] = useState(initialPage)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [a11yOnly, setA11yOnly] = useState(false)
  const [a11yForbidden, setA11yForbidden] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  // 맛집 전용 서브필터 — 음식 종류(cat3) + 빅데이터 추천(방문자 많은 시군 우선). 맛집 카테고리에서만 노출.
  const [cuisine, setCuisine] = useState<string | undefined>(undefined)
  const [bigdataRec, setBigdataRec] = useState(false)
  /** 빅데이터 추천 정렬용 — 시군코드 → 방문자 순위(작을수록 인기). 한 번만 로드. */
  const regionRankRef = useRef<Map<number, number> | null>(null)
  const [retryTick, setRetryTick] = useState(0)
  // 카테고리 탭 건수 — 현재 지역 기준. 카테고리별 1건 조회(totalCount)라 가볍고 24h 캐시된다.
  // 템플스테이는 사찰 목록 길이, 축제는 표준데이터 건수. 도착하는 대로 채우고 실패한 칸은 비워 둔다.
  const [catCountsByRegion, setCatCountsByRegion] = useState<Record<string, Partial<Record<CategoryId | 'all', number>>>>({})
  const regionKey = `${lang}:${sigunguCode ?? 'all'}`
  const catCounts = catCountsByRegion[regionKey] ?? {}
  useEffect(() => {
    let cancelled = false
    const key = regionKey
    const inRegion = <T extends { sigunguCode?: number }>(xs: T[]) =>
      sigunguCode ? xs.filter((x) => x.sigunguCode === sigunguCode) : xs
    const jobs: Array<[CategoryId | 'all', Promise<number | undefined>]> = [
      ['all', countPlaces({ lang, sigunguCode })],
      ...CATEGORIES.map((c): [CategoryId, Promise<number | undefined>] => {
        if (c.id === 'templestay') return [c.id, fetchTemples().then((xs) => inRegion(xs).length)]
        if (c.id === 'festival') {
          return [c.id, searchFestivals(lang).then((xs) => inRegion(xs).length)]
        }
        return [c.id, countPlaces({ lang, sigunguCode, category: c.id })]
      }),
    ]
    for (const [id, pr] of jobs) {
      pr.then((n) => {
        if (!cancelled && n !== undefined && Number.isFinite(n)) {
          setCatCountsByRegion((cur) => ({ ...cur, [key]: { ...(cur[key] ?? {}), [id]: n } }))
        }
      }).catch(() => {})
    }
    return () => {
      cancelled = true
    }
    // regionKey 는 lang·sigunguCode 에서 파생 — 둘만 deps 로 둔다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, sigunguCode])

  // 지역 탭 건수 — 현재 카테고리 기준. 카테고리 전체 목록이 100건 이하면 한 번 받아 시군별로 세고,
  // 그보다 많으면(관광지·맛집·전체) 시군별 1건 조회의 totalCount 를 쓴다. 템플스테이·축제는 메모리 목록에서 집계.
  const [regionCountsByCat, setRegionCountsByCat] = useState<Record<string, Record<number, number>>>({})
  const catKey = `${lang}:${category ?? 'all'}`
  const regionCounts = regionCountsByCat[catKey] ?? {}
  useEffect(() => {
    let cancelled = false
    const key = catKey
    const put = (code: number, n: number) => {
      if (cancelled) return
      setRegionCountsByCat((cur) => ({ ...cur, [key]: { ...(cur[key] ?? {}), [code]: n } }))
    }
    const tally = (xs: Array<{ sigunguCode?: number }>) => {
      const m = new Map<number, number>()
      for (const x of xs) if (x.sigunguCode) m.set(x.sigunguCode, (m.get(x.sigunguCode) ?? 0) + 1)
      if (cancelled) return
      setRegionCountsByCat((cur) => ({ ...cur, [key]: Object.fromEntries([...m].map(([c, n]) => [String(c), n])) as unknown as Record<number, number> }))
    }
    if (category === 'templestay') {
      void fetchTemples().then(tally).catch(() => {})
    } else if (category === 'festival') {
      void searchFestivals(lang).then(tally).catch(() => {})
    } else {
      // 시군별 건수 — 항목 필터를 거치지 않는 totalCount 전용 조회(시군당 1회, 24h 캐시)
      for (const sg of SIGUNGUS) {
        void countPlaces({ lang, category, sigunguCode: sg.code })
          .then((n) => {
            if (n !== undefined) put(sg.code, n)
          })
          .catch(() => {})
      }
    }
    return () => {
      cancelled = true
    }
    // catKey 는 lang·category 에서 파생 — 둘만 deps 로 둔다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, category])

  // 헤더 통합검색·홈 검색바가 nav('/explore?q=…') 로 보내는 검색어 — 이미 이 화면이 떠 있으면
  // useState 초기값은 다시 읽히지 않으므로 ?q= 변화를 따라 검색어를 갱신한다.
  // (effect 대신 렌더 중 파생 — 이전 값과 달라진 순간 한 번만 반영)
  const qParam = sp.get('q')
  const [seenQ, setSeenQ] = useState(qParam)
  if (qParam !== seenQ) {
    setSeenQ(qParam)
    if (qParam !== null) {
      setInputValue(qParam)
      setKeyword(qParam.trim())
    }
  }

  // 입력 멈추면(350ms) 검색어에 반영 → IME 조합 중이라도 막지 않고, 띄어쓰기 없이 like(%검색어%) 동작.
  useEffect(() => {
    const id = setTimeout(() => setKeyword(inputValue.trim()), 350)
    return () => clearTimeout(id)
  }, [inputValue])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setFetchError(false)
      try {
        if (category === 'templestay') {
          // 템플스테이는 templestay.com 데이터를 우선 쓰고, 사찰명 매칭으로 이미지를 보강한다.
          const all = await fetchTemples(undefined, lang)
          if (cancelled) return
          let filtered = all
          const kw = keyword.trim().toLowerCase()
          if (kw) {
            filtered = filtered.filter((t) => t.name.toLowerCase().includes(kw))
          }
          if (sigunguCode) {
            filtered = filtered.filter((t) => t.sigunguCode === sigunguCode)
          }
          setTotalCount(filtered.length)
          const offset = (pageNo - 1) * PAGE_SIZE
          setTemples(filtered.slice(offset, offset + PAGE_SIZE))
          setItems([])
          setFestivals([])
        } else if (category === 'festival') {
          // 축제는 searchFestival2 로 별도 호출. 진행중 → 예정 → 종료 순 정렬.
          const all = await searchFestivals(lang)
          if (cancelled) return
          const today = toYmd(new Date())
          const order = (s: 'ongoing' | 'upcoming' | 'ended') =>
            s === 'ongoing' ? 0 : s === 'upcoming' ? 1 : 2
          let filtered = [...all]
          const kw = keyword.trim().toLowerCase()
          if (kw) filtered = filtered.filter((f) => f.name.toLowerCase().includes(kw))
          if (sigunguCode) filtered = filtered.filter((f) => f.sigunguCode === sigunguCode)
          filtered.sort((a, b) => {
            const sa = festivalStatus(a, today)
            const sb = festivalStatus(b, today)
            const d = order(sa) - order(sb)
            if (d !== 0) return d
            if (sa === 'ended') return b.eventEndDate.localeCompare(a.eventEndDate)
            return a.eventStartDate.localeCompare(b.eventStartDate)
          })
          setTotalCount(filtered.length)
          const offset = (pageNo - 1) * PAGE_SIZE
          setFestivals(filtered.slice(offset, offset + PAGE_SIZE))
          setItems([])
          setTemples([])
        } else if (radius && loc.current) {
          setTemples([])
          setFestivals([])
          // 반경 기반 모드 — 단일 응답에서 클라이언트 측 페이징
          let around = await searchAround(loc.current, radius * 1000, lang)
          if (category) around = around.filter((p) => p.category === category)
          if (cancelled) return
          if (sort === 'distance' && loc.current) {
            const center = loc.current
            around = [...around].sort(
              (a, b) => haversineKm(center, a.position) - haversineKm(center, b.position),
            )
          }
          setTotalCount(around.length)
          const offset = (pageNo - 1) * PAGE_SIZE
          setItems(around.slice(offset, offset + PAGE_SIZE))
        } else {
          setTemples([])
          setFestivals([])
          // 클라 정렬 모드 — 서버 페이지만 정렬하면 의미가 없어 100개를 받아 전체 정렬 후 페이징.
          const distanceMode = sort === 'distance' && !!loc.current
          const bigdataMode = category === 'restaurant' && bigdataRec
          // 한적순: 시군 데이터랩 한적 순위(1=가장 한적)로 정렬 — "숨은 경북" 정체성을 탐색에서도.
          const quietMode = sort === 'quiet'
          const clientSort = distanceMode || bigdataMode || quietMode
          if (quietMode) {
            await loadVisitorBoost() // IDB 캐시 — 미구독이면 rank undefined 로 원래 순서 유지
            if (cancelled) return
          }
          // 빅데이터 추천 정렬용 시군 순위 — 한 번만 로드해 캐시.
          if (bigdataMode && !regionRankRef.current) {
            const vis = await fetchGyeongbukVisitors()
            const m = new Map<number, number>()
            vis.items.forEach((r, i) => m.set(r.sigunguCode, i))
            regionRankRef.current = m
            if (cancelled) return
          }
          // 무장애 토글 ON → KorWithService2 의 무장애 등록 장소만 조회. OFF → 일반 areaBasedList2.
          const params = {
            category,
            sigunguCode,
            keyword: keyword.trim() || undefined,
            cat3: category === 'restaurant' ? cuisine : undefined,
            lang,
            pageNo: clientSort ? 1 : pageNo,
            numOfRows: clientSort ? 100 : PAGE_SIZE,
          }
          const res = a11yOnly
            ? await searchAccessiblePlaces(params)
            : await searchPlaces(params)
          if (cancelled) return
          if (clientSort) {
            let sorted = res.items
            if (distanceMode && loc.current) {
              const center = loc.current
              sorted = [...res.items].sort(
                (a, b) => haversineKm(center, a.position) - haversineKm(center, b.position),
              )
            } else if (bigdataMode) {
              const rank = regionRankRef.current ?? new Map<number, number>()
              sorted = [...res.items].sort(
                (a, b) =>
                  (rank.get(a.sigunguCode ?? 0) ?? 999) - (rank.get(b.sigunguCode ?? 0) ?? 999) ||
                  (b.thumbnail ? 1 : 0) - (a.thumbnail ? 1 : 0),
              )
            } else if (quietMode) {
              sorted = [...res.items].sort(
                (a, b) =>
                  (quietRankFor(a.sigunguCode ?? 0)?.rank ?? 999) -
                    (quietRankFor(b.sigunguCode ?? 0)?.rank ?? 999) ||
                  (b.thumbnail ? 1 : 0) - (a.thumbnail ? 1 : 0),
              )
            }
            setTotalCount(sorted.length)
            const offset = (pageNo - 1) * PAGE_SIZE
            setItems(sorted.slice(offset, offset + PAGE_SIZE))
          } else {
            setItems(res.items)
            setTotalCount(res.totalCount)
          }
          // 무장애 모드에서 forbidden — 활용신청 누락 안내 표시 (에러 UI 아님)
          setA11yForbidden(a11yOnly && res.error === 'forbidden')
          // tour.ts 가 빈 결과 + error 코드를 함께 돌려주는 경우 → 에러 UI (단, a11y forbidden 은 별도 안내)
          if (res.error && res.error !== 'forbidden' && res.items.length === 0) setFetchError(true)
        }
      } catch {
        if (!cancelled) setFetchError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
    // loc 는 ref 객체라 deps 에서 제외 — loc.current(위치값) 변동은 위 목록에 이미 반영돼 재실행을 유발한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, sigunguCode, keyword, sort, radius, lang, loc.current, pageNo, retryTick, a11yOnly, cuisine, bigdataRec])

  // 무장애 토글 ON 일 때 응답 자체가 무장애 등록 장소이므로 secondary 필터 불필요.
  const displayItems = items

  // 필터/카테고리/지역/키워드 변경 시 1페이지로 리셋.
  // 첫 마운트 때는 URL 의 ?page=N 을 살리기 위해 reset 안 함.
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    setPageNo(1)
    syncPageParam(1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, sigunguCode, keyword, radius, cuisine, bigdataRec])

  // 위치 권한 확보 — 거부/실패면 안내하고 false. 안내 없이 전체 목록이 그대로 나오면 "근처 결과"로 오해한다.
  async function ensureLocation(): Promise<boolean> {
    if (loc.status !== 'granted') await loc.request()
    if (useLocation.getState().status === 'granted') return true
    pushToast(t('explore.locationDenied'), { type: 'info' })
    return false
  }

  async function toggleAround(r: Radius) {
    if (r && !(await ensureLocation())) {
      setRadius(0)
      return
    }
    // 쉼마루는 경북 데이터만 다룬다 — 내 위치가 경북 밖이면 반경 검색 결과가 나올 수 없으므로
    // 빈 목록 대신 이유를 알리고 지역 탭으로 유도한다.
    const here = useLocation.getState().current
    if (r && here && !isInGyeongbuk(here)) {
      pushToast(t('explore.outsideGyeongbuk'), { type: 'info' })
      setRadius(0)
      return
    }
    setRadius(r)
  }

  // 거리순은 내 위치가 있어야 의미가 있다 — 선택 시 위치 권한을 요청한다.
  async function selectDistanceSort() {
    if (!(await ensureLocation())) return
    setSort('distance')
  }

  function setCat(c?: CategoryId) {
    setCategory(c)
    // 맛집이 아니면 맛집 전용 서브필터 초기화 (다른 카테고리에선 노출 안 되도록).
    if (c !== 'restaurant') {
      setCuisine(undefined)
      setBigdataRec(false)
    }
    if (c) sp.set('cat', c)
    else sp.delete('cat')
    sp.delete('page')
    setSp(sp, { replace: true })
  }

  function setSig(code?: number) {
    setSigunguCode(code)
    if (code) sp.set('sigungu', String(code))
    else sp.delete('sigungu')
    sp.delete('page')
    setSp(sp, { replace: true })
  }

  function syncPageParam(p: number) {
    if (p <= 1) sp.delete('page')
    else sp.set('page', String(p))
    setSp(sp, { replace: true })
  }

  function gotoPage(p: number) {
    setPageNo(p)
    syncPageParam(p)
    // 스크롤 위로
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div className="page khs-page">
      <TopBar
        title={
          sigunguCode
            ? findSigungu(sigunguCode)?.[lang as 'ko' | 'en' | 'ja' | 'zh'] ?? t('explore.title')
            : t('explore.title')
        }
      />

      <KhsPageHeader title={t('explore.title')} trail={[{ label: t('explore.title') }]} />

      <div className="page-body explore__stack khs-page__body khs-page__body--single explore--tabs">
        {theme && THEME_MAP[theme] && (
          <div className={clsx(
            'explore__theme',
            THEME_MAP[theme].tone,
          )}>
            <span className="explore__theme-emoji" aria-hidden>
              {(() => { const Icon = THEME_MAP[theme].icon; return <Icon width={18} height={18} /> })()}
            </span>
            <div className="explore__theme-text">
              <p className="explore__theme-label">{THEME_MAP[theme].label[lang]}</p>
              <p className="explore__theme-caption">{THEME_MAP[theme].caption[lang]}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setTheme(undefined)
                sp.delete('theme')
                setSp(sp, { replace: true })
              }}
              className="explore__theme-clear"
              aria-label={t('explore.clearTheme')}
            >
              <CloseIcon width={13} height={13} />
            </button>
          </div>
        )}

        {/* ── 조건 바 (C1-b) — 1행 카테고리 탭(건수) · 2행 지역 탭 + 우측 텍스트 컨트롤 · (맛집) 3행 음식 종류.
            좌측 레일·박스형 스트립 대신 같은 칩 언어 두 줄로 — 홈 카드로 들어와도 GNB로 들어와도 같은 구조. */}
        <div className="explore__bars">
          <div className="explore__bar">
            <span className="explore__bar-label">{t('khs.category')}</span>
            <div className="explore__tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={!category}
                onClick={() => setCat(undefined)}
                className={clsx('explore__tab', !category && 'explore__tab--active')}
              >
                {t('explore.categoryAll')}
                {catCounts.all !== undefined && <span className="explore__tab-count">{fmtCount(catCounts.all)}</span>}
              </button>
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={category === c.id}
                  onClick={() => setCat(c.id)}
                  className={clsx('explore__tab', category === c.id && 'explore__tab--active')}
                >
                  {c.label[lang]}
                  {catCounts[c.id] !== undefined && <span className="explore__tab-count">{fmtCount(catCounts[c.id]!)}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="explore__bar">
            <span className="explore__bar-label">{t('khs.home.region')}</span>
            <div className="explore__tabs">
              <button
                type="button"
                onClick={() => setSig(undefined)}
                className={clsx('explore__tab', !sigunguCode && 'explore__tab--region-active')}
              >
                {t('explore.categoryAll')}
                {catCounts.all !== undefined && category === undefined && (
                  <span className="explore__tab-count">{fmtCount(catCounts.all)}</span>
                )}
                {category !== undefined && catCounts[category] !== undefined && (
                  <span className="explore__tab-count">{fmtCount(catCounts[category]!)}</span>
                )}
              </button>
              {SIGUNGUS.map((sg) => {
                const n = regionCounts[sg.code]
                return (
                  <button
                    key={sg.code}
                    type="button"
                    onClick={() => setSig(sg.code)}
                    className={clsx('explore__tab', sigunguCode === sg.code && 'explore__tab--region-active')}
                  >
                    {sg[lang as 'ko' | 'en' | 'ja' | 'zh']}
                    {n !== undefined && <span className="explore__tab-count">{fmtCount(n)}</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 3행 정렬 — 정렬 · 내 주변 · 배리어프리. 칩보다 한 단계 낮은 텍스트 컨트롤. */}
          <div className="explore__bar">
            <span className="explore__bar-label">{t('explore.sortLabel')}</span>
            <div className="explore__textctls">
              <label className="explore__textctl">
                <span className="explore__textctl-label">{t('explore.sortLabel')}</span>
                <select
                  className="explore__textctl-select"
                  value={sort}
                  onChange={(e) => {
                    const v = e.target.value as SortKey
                    if (v === 'distance') void selectDistanceSort()
                    else setSort(v)
                  }}
                >
                  <option value="popular">{t('explore.sortPopular')}</option>
                  <option value="distance">{t('explore.sortDistance')}</option>
                  <option value="quiet">{t('explore.sortQuiet')}</option>
                </select>
              </label>
              <span className="explore__textctl-divider" aria-hidden />
              <label className="explore__textctl">
                <span className="explore__textctl-label">{t('explore.around')}</span>
                <select
                  className="explore__textctl-select"
                  value={radius}
                  onChange={(e) => void toggleAround(Number(e.target.value) as Radius)}
                >
                  {([0, 5, 10, 20] as Radius[]).map((r) => (
                    <option key={r} value={r}>{r === 0 ? '—' : `${r}${t('course.km')}`}</option>
                  ))}
                </select>
              </label>
              <span className="explore__textctl-divider" aria-hidden />
              <button
                type="button"
                onClick={() => setA11yOnly((v) => !v)}
                aria-pressed={a11yOnly}
                className={clsx('explore__textctl explore__textctl--toggle', a11yOnly && 'explore__textctl--on')}
                title={t('explore.a11yHint')}
              >
                <AccessibleIcon aria-hidden width={14} height={14} /> {t('explore.a11yOnly')}
              </button>
            </div>
          </div>

          {category === 'restaurant' && (
            <div className="explore__bar">
              <span className="explore__bar-label">{t('explore.cuisineLabel')}</span>
              <div className="explore__tabs">
                <button
                  type="button"
                  onClick={() => setCuisine(undefined)}
                  className={clsx('explore__tab', !cuisine && 'explore__tab--region-active')}
                >
                  {t('explore.categoryAll')}
                </button>
                {RESTAURANT_CUISINES.map((cz) => (
                  <button
                    key={cz.cat3}
                    type="button"
                    onClick={() => setCuisine(cz.cat3)}
                    className={clsx('explore__tab', cuisine === cz.cat3 && 'explore__tab--region-active')}
                  >
                    {cz.label[lang]}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setBigdataRec((v) => !v)}
                  className={clsx('explore__tab', bigdataRec && 'explore__tab--region-active')}
                  title={t('explore.bigdataPickHint')}
                >
                  <SparkleIcon aria-hidden width={13} height={13} /> {t('explore.bigdataPick')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 결과 컬럼 — 검색 · 결과 헤더(건수 + 보기) · 목록 */}
        <div className="khs-result-col">
        <div className="explore__search">
          <SearchIcon className="explore__search-icon" />
          <input
            type="search"
            inputMode="search"
            placeholder={t('explore.keywordPlaceholder')}
            className="input explore__search-input"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              // 직접 입력을 시작하면 URL 의 ?q= 는 더 이상 화면 상태를 대표하지 않으므로 지운다.
              // (지워 두어야 헤더 통합검색에서 같은 단어를 다시 검색해도 반영된다.)
              if (sp.has('q')) {
                sp.delete('q')
                setSp(sp, { replace: true })
              }
            }}
            onKeyDown={(e) => {
              // Enter 즉시 검색 (디바운스 대기 없이)
              if (e.key === 'Enter') setKeyword(inputValue.trim())
            }}
          />
        </div>

        <div className="khs-result-head">
          <span className="khs-result-count">
            {!loading && totalCount > 0 ? (
              <>
                <span dangerouslySetInnerHTML={{ __html: t('khs.resultCountHtml', { n: fmtCount(totalCount) }) }} />
                <span className="explore__count-range">
                  {' · '}{(pageNo - 1) * PAGE_SIZE + 1}–{Math.min(pageNo * PAGE_SIZE, totalCount)}
                </span>
              </>
            ) : null}
          </span>
          <div className="explore__view-toggle">
            {(['list', 'map'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setViewMode(v)}
                aria-pressed={viewMode === v}
                className={clsx(
                  'explore__view-btn',
                  viewMode === v ? 'explore__view-btn--active' : 'explore__view-btn--idle',
                )}
              >
                {t(`festivals.view.${v}`)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <SkeletonGrid count={6} cols={category === 'festival' ? 'festival' : 'place'} variant="tile" />
        ) : fetchError ? (
          <ErrorRetry
            message={t('error.apiFailed')}
            onRetry={() => setRetryTick((n) => n + 1)}
          />
        ) : category === 'templestay' && temples.length > 0 ? (
          <>
            <ul className="explore__grid">
              {temples.map((tp) => (
                <li key={tp.id}>
                  <TempleStayCard temple={tp} />
                </li>
              ))}
            </ul>
            {totalPages > 1 && (
              <Pagination pageNo={pageNo} totalPages={totalPages} onChange={gotoPage} />
            )}
          </>
        ) : category === 'festival' && festivals.length > 0 ? (
          <>
            <ul className="explore__grid">
              {festivals.map((f) => (
                <li key={f.id}>
                  <FestivalCard festival={f} lang={lang} />
                </li>
              ))}
            </ul>
            {totalPages > 1 && (
              <Pagination pageNo={pageNo} totalPages={totalPages} onChange={gotoPage} />
            )}
          </>
        ) : items.length === 0 && temples.length === 0 && festivals.length === 0 ? (
          <div className="explore__empty">
            <p className="explore__empty-title">{t('explore.empty')}</p>
            <p className="explore__empty-hint">{t('explore.emptyHint')}</p>
            {(category || sigunguCode || keyword || radius) ? (
              <button
                type="button"
                className="btn-secondary explore__empty-btn"
                onClick={() => {
                  setCat(undefined)
                  setSig(undefined)
                  setInputValue('')
                  setKeyword('')
                  setRadius(0)
                }}
              >
                {t('explore.clearFilters')}
              </button>
            ) : null}
          </div>
        ) : viewMode === 'map' ? (
          <KakaoMap
            places={displayItems.length > 0 ? displayItems : festivals}
            className="explore__map"
            onPlaceClick={(p) =>
              p.category === 'festival'
                ? nav(`/festivals/${p.id}`, { state: { festival: p } })
                : nav(`/place/${p.id}`, { state: { place: p } })
            }
          />
        ) : (
          <>
            {a11yOnly && a11yForbidden && (
              <div className="explore__forbidden">
                <p className="explore__forbidden-title">{t('explore.a11yForbiddenTitle')}</p>
                <p className="explore__forbidden-body">
                  {t('explore.a11yForbiddenBody')}
                </p>
                <button
                  type="button"
                  className="btn-text explore__forbidden-btn"
                  onClick={() => setA11yOnly(false)}
                >
                  {t('explore.clearFilters')}
                </button>
              </div>
            )}
            {a11yOnly && !a11yForbidden && displayItems.length === 0 && (
              <div className="explore__a11y-empty">
                <p className="explore__a11y-empty-text">{t('explore.a11yEmpty')}</p>
                <div className="explore__a11y-empty-actions">
                  <button
                    type="button"
                    className="btn-text explore__a11y-empty-btn"
                    onClick={() => setA11yOnly(false)}
                  >
                    {t('explore.clearFilters')}
                  </button>
                </div>
              </div>
            )}
            <ul className="explore__list-mobile">
              {displayItems.map((p) => (
                <li key={p.id}>
                  <PlaceCard place={p} variant="row" />
                </li>
              ))}
            </ul>
            <ul className="explore__list-desktop">
              {displayItems.map((p) => (
                <li key={p.id}>
                  <PlaceCard place={p} variant="tile" />
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <Pagination
                pageNo={pageNo}
                totalPages={totalPages}
                onChange={gotoPage}
              />
            )}
          </>
        )}
        </div>
      </div>
    </div>
  )
}

function Pagination({
  pageNo,
  totalPages,
  onChange,
}: {
  pageNo: number
  totalPages: number
  onChange: (p: number) => void
}) {
  const { t } = useTranslation()
  const pages = pageWindow(pageNo, totalPages)
  return (
    <nav className="explore__pagination">
      <PageBtn ariaLabel={t('common.back')} disabled={pageNo === 1} onClick={() => onChange(pageNo - 1)}>
        ←
      </PageBtn>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="explore__pagination-gap">
            …
          </span>
        ) : (
          <PageBtn key={p} active={p === pageNo} onClick={() => onChange(p)}>
            {p}
          </PageBtn>
        ),
      )}
      <PageBtn ariaLabel={t('common.next')} disabled={pageNo === totalPages} onClick={() => onChange(pageNo + 1)}>
        →
      </PageBtn>
    </nav>
  )
}

function PageBtn({
  children,
  active,
  disabled,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode
  active?: boolean
  disabled?: boolean
  onClick: () => void
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'explore__page-btn',
        active
          ? 'explore__page-btn--active'
          : 'explore__page-btn--idle',
      )}
    >
      {children}
    </button>
  )
}

type Status = 'ongoing' | 'upcoming' | 'ended'

function festivalStatus(f: Festival, today: string): Status {
  if (f.eventEndDate < today) return 'ended'
  if (f.eventStartDate > today) return 'upcoming'
  return 'ongoing'
}

function toYmd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function prettyYmd(ymd: string) {
  if (!ymd || ymd.length !== 8) return ymd
  return `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}.${ymd.slice(6, 8)}`
}

function FestivalCard({ festival: f, lang }: { festival: Festival; lang: 'ko' | 'en' | 'ja' | 'zh' }) {
  const { t } = useTranslation()
  const togglefestival = useFavorites((s) => s.togglefestival)
  // boolean selector — new Set 같은 새 참조 반환 시 무한 리렌더 됨. some() 결과만 받자.
  const isFav = useFavorites((s) => s.festivals.some((x) => x.id === f.id))
  const today = toYmd(new Date())
  const status = festivalStatus(f, today)
  const ended = status === 'ended'
  const statusStyle =
    status === 'ongoing'
      ? 'status-badge--ongoing'
      : status === 'upcoming'
        ? 'status-badge--upcoming'
        : 'status-badge--ended'
  const dotStyle =
    status === 'ongoing' ? 'status-dot--ongoing' : status === 'upcoming' ? 'status-dot--upcoming' : 'status-dot--ended'
  return (
    <Link
      to={`/festivals/${f.id}`}
      state={{ festival: f }}
      className={clsx(
        'explore-festival-card',
        ended && 'explore-festival-card--ended',
      )}
    >
      <div className="explore-festival-card__media">
        <Thumbnail src={f.thumbnail} alt={f.name} category="festival" />
        <FavoriteStar
          active={isFav}
          disabled={ended}
          overlay
          className="explore-festival-card__star"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            togglefestival(f)
          }}
        />
      </div>
      <div className="explore-festival-card__body">
        <div className="explore-festival-card__badges">
          <CategoryBadge category="festival" lang={lang} />
          <span className={clsx('status-badge', statusStyle)}>
            <span className={clsx('status-dot', dotStyle)} aria-hidden />
            {t(`festivals.${status}`)}
          </span>
        </div>
        <h3 className="card-title explore-festival-card__title">{f.name}</h3>
        <p className={clsx('explore-festival-card__dates', ended ? 'explore-festival-card__dates--ended' : 'explore-festival-card__dates--active')}>
          {prettyYmd(f.eventStartDate)} ~ {prettyYmd(f.eventEndDate)}
        </p>
        <p className="explore-festival-card__address">{f.address}</p>
      </div>
    </Link>
  )
}

/** 페이지 윈도우 — 1, ..., p-1, p, p+1, ..., N 형태 */
function pageWindow(current: number, total: number): (number | '…')[] {
  // 7칸 이하면 전부 노출
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  // 앞쪽: 1 2 3 4 5 … N
  if (current <= 4) {
    return [1, 2, 3, 4, 5, '…', total]
  }
  // 뒤쪽: 1 … N-4 N-3 N-2 N-1 N
  if (current >= total - 3) {
    return [1, '…', total - 4, total - 3, total - 2, total - 1, total]
  }
  // 가운데: 1 … c-1 c c+1 … N
  return [1, '…', current - 1, current, current + 1, '…', total]
}

/** 탭·결과 헤더 건수 — 천 단위 구분(1,614). */
function fmtCount(n: number): string {
  return n.toLocaleString('ko-KR')
}
