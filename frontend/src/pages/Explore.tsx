import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import TopBar from '@/components/TopBar'
import PlaceCard from '@/components/PlaceCard'
import TempleStayCard from '@/components/TempleStayCard'
import CategoryBadge from '@/components/CategoryBadge'
import Thumbnail from '@/components/Thumbnail'
import FavoriteStar from '@/components/FavoriteStar'
import { useFavorites } from '@/stores/favorites'
import { CATEGORIES } from '@/constants/categories'
import { findSigungu, SIGUNGUS } from '@/constants/sigungu'
import { useSettings } from '@/stores/settings'
import { useLocation } from '@/stores/location'
import { searchPlaces, searchAround, searchFestivals } from '@/api/tour'
import { fetchTemples, type Temple } from '@/api/templestay'
import { haversineKm } from '@/lib/geo'
import type { CategoryId, Festival, Place } from '@/types/domain'

type SortKey = 'popular' | 'distance'
type Radius = 5 | 10 | 20 | 0

const PAGE_SIZE = 18

export default function Explore() {
  const { t } = useTranslation()
  const [sp, setSp] = useSearchParams()
  const lang = useSettings((s) => s.lang)
  const loc = useLocation()

  const initialSigungu = sp.get('sigungu') ? Number(sp.get('sigungu')) : undefined
  const initialCategory = (sp.get('cat') as CategoryId | null) ?? undefined
  const initialPage = sp.get('page') ? Math.max(1, Number(sp.get('page'))) : 1

  const [category, setCategory] = useState<CategoryId | undefined>(initialCategory)
  const [sigunguCode, setSigunguCode] = useState<number | undefined>(initialSigungu)
  const [keyword, setKeyword] = useState('')
  const [sort, setSort] = useState<SortKey>('popular')
  const [radius, setRadius] = useState<Radius>(0)
  const [items, setItems] = useState<Place[]>([])
  const [temples, setTemples] = useState<Temple[]>([])
  const [festivals, setFestivals] = useState<Festival[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [pageNo, setPageNo] = useState(initialPage)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
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
          // 일반 모드 — TourAPI 서버 페이징 사용 (totalCount 반환)
          const res = await searchPlaces({
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
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [category, sigunguCode, keyword, sort, radius, lang, loc.current, pageNo])

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
    <div className="bg-canvas">
      <TopBar
        title={
          sigunguCode
            ? findSigungu(sigunguCode)?.[lang as 'ko' | 'en' | 'ja' | 'zh'] ?? t('explore.title')
            : t('explore.title')
        }
      />

      <div className="space-y-6 px-5 py-8 md:px-10 md:py-12">
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-soft font-mono text-xs">
            ⌕
          </span>
          <input
            type="search"
            inputMode="search"
            placeholder={t('explore.keywordPlaceholder')}
            className="input pl-10"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        <div>
          <span className="eyebrow block mb-2">{t('explore.title')}</span>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5">
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
          <span className="eyebrow block mb-2">{t('home.pickRegion')}</span>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5">
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

        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">{t('explore.around')}</span>
          {([0, 5, 10, 20] as Radius[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => void toggleAround(r)}
              className={clsx('chip', radius === r && 'chip-active')}
            >
              {r === 0 ? '—' : `${r}km`}
            </button>
          ))}
          <div className="ml-auto flex gap-1">
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
          <p className="font-mono text-caption text-muted">
            {(pageNo - 1) * PAGE_SIZE + 1}-{Math.min(pageNo * PAGE_SIZE, totalCount)} / {totalCount}
          </p>
        )}

        {loading ? (
          <p className="py-16 text-center font-mono text-caption text-muted">
            {'>'} {t('course.generating')}
          </p>
        ) : category === 'templestay' && temples.length > 0 ? (
          <>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
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
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
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
          <p className="py-16 text-center text-body-md text-muted">{t('explore.empty')}</p>
        ) : (
          <>
            <ul className="space-y-3 md:hidden">
              {items.map((p) => (
                <li key={p.id}>
                  <PlaceCard place={p} variant="row" />
                </li>
              ))}
            </ul>
            <ul className="hidden md:grid md:grid-cols-2 md:gap-5 lg:grid-cols-3">
              {items.map((p) => (
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
  const pages = pageWindow(pageNo, totalPages)
  return (
    <nav className="flex flex-wrap items-center justify-center gap-1.5 pt-6">
      <PageBtn disabled={pageNo === 1} onClick={() => onChange(pageNo - 1)}>
        ←
      </PageBtn>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="px-1 font-mono text-caption text-muted-soft">
            …
          </span>
        ) : (
          <PageBtn key={p} active={p === pageNo} onClick={() => onChange(p)}>
            {p}
          </PageBtn>
        ),
      )}
      <PageBtn disabled={pageNo === totalPages} onClick={() => onChange(pageNo + 1)}>
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
}: {
  children: React.ReactNode
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 font-mono text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
        active
          ? 'border-ink bg-ink text-canvas'
          : 'border-hairline-strong bg-card text-ink hover:bg-canvas-soft',
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
      ? 'bg-emerald-50 text-emerald-800'
      : status === 'upcoming'
        ? 'bg-primary/10 text-primary'
        : 'bg-canvas-soft text-muted'
  const dotStyle =
    status === 'ongoing' ? 'bg-emerald-500' : status === 'upcoming' ? 'bg-primary' : 'bg-muted-soft'
  return (
    <Link
      to={`/festivals/${f.id}`}
      state={{ festival: f }}
      className={clsx(
        'card-hover overflow-hidden flex flex-col relative',
        ended && 'opacity-60 grayscale',
      )}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden">
        <Thumbnail src={f.thumbnail} alt={f.name} category="festival" />
        <FavoriteStar
          active={isFav}
          disabled={ended}
          overlay
          className="absolute right-2 top-2"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            togglefestival(f)
          }}
        />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2">
          <CategoryBadge category="festival" lang={lang} />
          <span
            className={`inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusStyle}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${dotStyle}`} aria-hidden />
            {t(`festivals.${status}`)}
          </span>
        </div>
        <h3 className="mt-3 text-display-sm text-ink truncate">{f.name}</h3>
        <p className={clsx('mt-2 font-mono text-caption', ended ? 'text-muted' : 'text-primary')}>
          {prettyYmd(f.eventStartDate)} → {prettyYmd(f.eventEndDate)}
        </p>
        <p className="mt-1 text-caption text-muted truncate">{f.address}</p>
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
