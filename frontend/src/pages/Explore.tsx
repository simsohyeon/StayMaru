import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import TopBar from '@/components/TopBar'
import KakaoMap from '@/components/KakaoMap'
import PlaceCard from '@/components/PlaceCard'
import TempleStayCard from '@/components/TempleStayCard'
import CategoryBadge from '@/components/CategoryBadge'
import Thumbnail from '@/components/Thumbnail'
import FavoriteStar from '@/components/FavoriteStar'
import ErrorRetry from '@/components/ErrorRetry'
import { SkeletonGrid } from '@/components/Skeleton'
import { useFavorites } from '@/stores/favorites'
import { CATEGORIES } from '@/constants/categories'
import { THEME_MAP } from '@/constants/themes'
import { findSigungu, SIGUNGUS } from '@/constants/sigungu'
import { useSettings } from '@/stores/settings'
import { useLocation } from '@/stores/location'
import { searchPlaces, searchAround, searchFestivals, searchAccessiblePlaces } from '@/api/tour'
import { fetchTemples, type Temple } from '@/api/templestay'
import { haversineKm } from '@/lib/geo'
import { addPlaceToCourse } from '@/lib/courseActions'
import { useToasts } from '@/stores/toasts'
import type { CategoryId, Festival, Place } from '@/types/domain'

type SortKey = 'popular' | 'distance'
type Radius = 5 | 10 | 20 | 0

const PAGE_SIZE = 18

export default function Explore() {
  const { t } = useTranslation()
  const [sp, setSp] = useSearchParams()
  const nav = useNavigate()
  const lang = useSettings((s) => s.lang)
  const loc = useLocation()
  const pushToast = useToasts((s) => s.show)

  // 탐색 결과 카드에서 바로 "코스에 담기" — 찜 목록에만 의존하던 한계 해소.
  const addToCourseBtn = (place: Place) => (
    <button
      type="button"
      className="chip"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        const r = addPlaceToCourse(place)
        pushToast(
          t(
            r === 'duplicate'
              ? 'course.alreadyInCourse'
              : r === 'created'
                ? 'course.startedCourse'
                : 'course.addedToCourse',
          ),
          { type: r === 'duplicate' ? 'info' : 'success' },
        )
      }}
    >
      📍 {t('course.addToCourse')}
    </button>
  )

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
  /** 한글 IME 조합 중 키워드 검색이 불필요하게 호출되지 않도록 */
  const composingRef = useRef(false)
  const [retryTick, setRetryTick] = useState(0)

  useEffect(() => {
    if (composingRef.current) return // IME 조합 중에는 호출 보류
    let cancelled = false
    async function run() {
      setLoading(true)
      setFetchError(false)
      try {
        if (category === 'templestay') {
          // 템플스테이는 한국불교문화사업단(templestay.com) 데이터를 우선 사용하고,
          // 사찰명 매칭으로 관광공사 사찰 이미지를 보강한다.
          const all = await fetchTemples(undefined, lang)
          if (cancelled) return
          let filtered = all
          const kw = keyword.trim().toLowerCase()
          if (kw) {
            filtered = filtered.filter((t) => t.name.toLowerCase().includes(kw))
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
          // 무장애 토글 ON → KorWithService2 의 무장애 등록 장소만 조회.
          // OFF → 일반 KorService2 의 areaBasedList2 사용 (서버 페이징).
          const res = a11yOnly
            ? await searchAccessiblePlaces({
                category,
                sigunguCode,
                keyword: keyword.trim() || undefined,
                lang,
                pageNo,
                numOfRows: PAGE_SIZE,
              })
            : await searchPlaces({
                category,
                sigunguCode,
                keyword: keyword.trim() || undefined,
                lang,
                pageNo,
                numOfRows: PAGE_SIZE,
              })
          if (cancelled) return
          let list = res.items
          if (sort === 'distance' && loc.current) {
            const center = loc.current
            list = [...list].sort(
              (a, b) => haversineKm(center, a.position) - haversineKm(center, b.position),
            )
          }
          setItems(list)
          setTotalCount(res.totalCount)
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
  }, [category, sigunguCode, keyword, sort, radius, lang, loc.current, pageNo, retryTick, a11yOnly])

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
  }, [category, sigunguCode, keyword, radius])

  async function toggleAround(r: Radius) {
    if (r && loc.status !== 'granted') await loc.request()
    setRadius(r)
  }

  function setCat(c?: CategoryId) {
    setCategory(c)
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
    <div className="page">
      <TopBar
        title={
          sigunguCode
            ? findSigungu(sigunguCode)?.[lang as 'ko' | 'en' | 'ja' | 'zh'] ?? t('explore.title')
            : t('explore.title')
        }
      />

      <div className="page-body explore__stack">
        {theme && THEME_MAP[theme] && (
          <div className={clsx(
            'explore__theme',
            THEME_MAP[theme].tone,
          )}>
            <span className="explore__theme-emoji" aria-hidden>{THEME_MAP[theme].emoji}</span>
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
              ✕
            </button>
          </div>
        )}

        <div className="explore__search">
          <span className="explore__search-icon">
            ⌕
          </span>
          <input
            type="search"
            inputMode="search"
            placeholder={t('explore.keywordPlaceholder')}
            className="input explore__search-input"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onCompositionStart={() => {
              composingRef.current = true
            }}
            onCompositionEnd={(e) => {
              composingRef.current = false
              // 조합이 끝난 시점에서 keyword 가 이미 set 되어 있으므로 effect 다시 트리거
              setKeyword(e.currentTarget.value)
            }}
          />
        </div>

        <div>
          <span className="eyebrow explore__filter-label">{t('explore.title')}</span>
          <div className="chip-row explore__chip-row">
            <button
              type="button"
              onClick={() => setCat(undefined)}
              className={clsx('chip', !category && 'chip-active')}
            >
              {t('explore.categoryAll')}
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                className={clsx('chip', category === c.id && 'chip-active')}
              >
                {c.emoji} {c.label[lang]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="eyebrow explore__filter-label">{t('home.pickRegion')}</span>
          <div className="chip-row explore__chip-row">
            <button
              type="button"
              onClick={() => setSig(undefined)}
              className={clsx('chip', !sigunguCode && 'chip-active')}
            >
              {t('explore.categoryAll')}
            </button>
            {SIGUNGUS.map((sg) => (
              <button
                key={sg.code}
                type="button"
                onClick={() => setSig(sg.code)}
                className={clsx('chip', sigunguCode === sg.code && 'chip-active')}
              >
                {sg[lang as 'ko' | 'en' | 'ja' | 'zh']}
              </button>
            ))}
          </div>
        </div>

        <div className="explore__toolbar">
          <span className="eyebrow">{t('explore.around')}</span>
          {([0, 5, 10, 20] as Radius[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => void toggleAround(r)}
              className={clsx('chip', radius === r && 'chip-active')}
            >
              {r === 0 ? '—' : `${r}${t('course.km')}`}
            </button>
          ))}
          <div className="explore__toolbar-actions">
            <div className="explore__view-toggle">
              {(['list', 'map'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setViewMode(v)}
                  className={clsx(
                    'explore__view-btn',
                    viewMode === v ? 'explore__view-btn--active' : 'explore__view-btn--idle',
                  )}
                >
                  {t(`festivals.view.${v}`)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setA11yOnly((v) => !v)}
              className={clsx('chip', a11yOnly && 'chip-active')}
              title={t('explore.a11yHint')}
            >
              ♿ {t('explore.a11yOnly')}
            </button>
            <button
              type="button"
              onClick={() => setSort('popular')}
              className={clsx('chip', sort === 'popular' && 'chip-active')}
            >
              {t('explore.sortPopular')}
            </button>
            <button
              type="button"
              onClick={() => setSort('distance')}
              className={clsx('chip', sort === 'distance' && 'chip-active')}
            >
              {t('explore.sortDistance')}
            </button>
          </div>
        </div>

        {/* 결과 카운트 */}
        {!loading && totalCount > 0 && (
          <p className="explore__count">
            {(pageNo - 1) * PAGE_SIZE + 1}-{Math.min(pageNo * PAGE_SIZE, totalCount)} / {totalCount}
          </p>
        )}

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
            <ul className="explore__grid--festival">
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
            {a11yOnly && (
              <div className="explore__notice">
                <p className="explore__notice-eyebrow">
                  ♿ {t('explore.a11ySourceEyebrow')}
                </p>
                <p className="explore__notice-body">
                  {t('explore.a11ySource')}
                </p>
              </div>
            )}
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
                  <PlaceCard place={p} variant="row" trailing={addToCourseBtn(p)} />
                </li>
              ))}
            </ul>
            <ul className="explore__list-desktop">
              {displayItems.map((p) => (
                <li key={p.id}>
                  <PlaceCard place={p} variant="tile" trailing={addToCourseBtn(p)} />
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
          {prettyYmd(f.eventStartDate)} → {prettyYmd(f.eventEndDate)}
        </p>
        <p className="explore-festival-card__address">{f.address}</p>
      </div>
    </Link>
  )
}

/** 페이지 윈도우 — 1, ..., p-1, p, p+1, ..., N 형태 */
function pageWindow(current: number, total: number): (number | '…')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const out: (number | '…')[] = []
  const push = (v: number | '…') => out.push(v)
  push(1)
  if (current > 4) push('…')
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    push(p)
  }
  if (current < total - 3) push('…')
  push(total)
  return out
}
