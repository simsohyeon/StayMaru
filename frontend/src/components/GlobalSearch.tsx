import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { searchPlaces, searchFestivals } from '@/api/tour'
import { SIGUNGUS } from '@/constants/sigungu'
import { CATEGORIES, CATEGORY_MAP } from '@/constants/categories'
import { useSettings } from '@/stores/settings'
import type { Place, Festival, Sigungu, CategoryId } from '@/types/domain'

const RECENT_KEY = 'shimmaru.recentSearches.v1'
const RECENT_MAX = 6

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === 'string') : []
  } catch {
    return []
  }
}

function pushRecent(q: string): string[] {
  const trimmed = q.trim()
  if (!trimmed) return loadRecent()
  const prev = loadRecent().filter((s) => s !== trimmed)
  const next = [trimmed, ...prev].slice(0, RECENT_MAX)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* quota / private mode — 무시 */
  }
  return next
}

// 빠른 진입 — 빈 쿼리일 때 노출되는 주요 카테고리 단축키.
const QUICK_CATEGORIES: CategoryId[] = ['hanok', 'temple', 'seowon', 'experience', 'market']

interface SigunguResult { type: 'sigungu'; id: string; label: string; sublabel?: string; emoji: string; data: Sigungu }
interface PlaceResult   { type: 'place';   id: string; label: string; sublabel?: string; emoji: string; data: Place }
interface FestivalResult{ type: 'festival';id: string; label: string; sublabel?: string; emoji: string; data: Festival }
type SearchResult = SigunguResult | PlaceResult | FestivalResult

/**
 * 전역 통합 검색.
 *
 * - 단축키: ⌘K (mac) / Ctrl+K (win)
 * - 검색 대상: 시군구(로컬), 장소(searchKeyword), 축제(searchFestival 후 클라이언트 필터)
 * - debounce 350ms 로 API 호출 최소화
 */
export default function GlobalSearch() {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [recent, setRecent] = useState<string[]>(() => loadRecent())
  const inputRef = useRef<HTMLInputElement>(null)

  const quickCats = useMemo(
    () =>
      QUICK_CATEGORIES.map((id) => CATEGORIES.find((c) => c.id === id)).filter(
        (c): c is (typeof CATEGORIES)[number] => !!c,
      ),
    [],
  )

  // ⌘K / Ctrl+K 단축키 + ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // 열릴 때 input 포커스
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else {
      setQ('')
      setResults([])
      setActiveIdx(0)
    }
  }, [open])

  // debounce 검색
  useEffect(() => {
    if (!open) return
    const query = q.trim()
    if (query.length < 1) {
      setResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    const timeout = setTimeout(async () => {
      try {
        const sigunguHits: SigunguResult[] = SIGUNGUS.filter((s) => {
          const name = s[lang as 'ko' | 'en' | 'ja' | 'zh']
          return name.toLowerCase().includes(query.toLowerCase()) ||
                 s.slug.toLowerCase().includes(query.toLowerCase())
        })
          .slice(0, 3)
          .map((s) => ({
            type: 'sigungu',
            id: `sig-${s.code}`,
            label: s[lang as 'ko' | 'en' | 'ja' | 'zh'],
            sublabel: t('search.regionSublabel'),
            emoji: '📍',
            data: s,
          }))

        const [placesRes, festivalAll] = await Promise.all([
          searchPlaces({ keyword: query, lang, numOfRows: 8 }).catch(() => ({ items: [] as Place[] })),
          searchFestivals(lang).catch(() => [] as Festival[]),
        ])

        const placeHits: PlaceResult[] = placesRes.items.slice(0, 6).map((p) => ({
          type: 'place',
          id: p.id,
          label: p.name,
          sublabel: p.address,
          emoji: CATEGORY_MAP[p.category]?.emoji ?? '•',
          data: p,
        }))

        const fesHits: FestivalResult[] = festivalAll
          .filter((f) => f.name.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 4)
          .map((f) => ({
            type: 'festival',
            id: f.id,
            label: f.name,
            sublabel: f.address,
            emoji: '🎏',
            data: f,
          }))

        if (!cancelled) {
          setResults([...sigunguHits, ...placeHits, ...fesHits])
          setActiveIdx(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [q, lang, open, t])

  function go(r: SearchResult) {
    // 키워드 입력 후 결과를 선택한 경우 — 최근 검색에 저장.
    if (q.trim()) setRecent(pushRecent(q))
    setOpen(false)
    if (r.type === 'place') {
      nav(`/place/${r.id}`, { state: { place: r.data } })
    } else if (r.type === 'festival') {
      nav(`/festivals/${r.id}`, { state: { festival: r.data } })
    } else {
      nav(`/explore?sigungu=${r.data.code}`)
    }
  }

  function clearRecent() {
    try {
      localStorage.removeItem(RECENT_KEY)
    } catch {
      /* ignore */
    }
    setRecent([])
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(results.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const r = results[activeIdx]
      if (r) go(r)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 h-9 rounded-md border border-hairline-strong bg-card px-3 text-body-sm text-muted hover:text-ink hover:bg-canvas-soft"
        aria-label={t('search.openLabel')}
      >
        <span className="font-mono">⌕</span>
        <span className="hidden md:inline">{t('search.openLabel')}</span>
        <kbd className="hidden md:inline-flex items-center rounded border border-hairline px-1 font-mono text-[10px] text-muted-soft">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-16 md:pt-24"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-lg border border-hairline bg-canvas shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
              <span className="font-mono text-muted-soft">⌕</span>
              <input
                ref={inputRef}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('search.placeholder')}
                className="flex-1 bg-transparent text-body-md text-ink outline-none"
              />
              <kbd className="hidden items-center rounded border border-hairline px-1.5 font-mono text-[10px] text-muted md:inline-flex">
                ESC
              </kbd>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {loading && (
                <p className="p-6 text-center font-mono text-caption text-muted">…</p>
              )}
              {!loading && q.trim().length === 0 && (
                <div className="px-4 py-4 space-y-4">
                  {recent.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between">
                        <p className="eyebrow">{t('search.recent')}</p>
                        <button
                          type="button"
                          onClick={clearRecent}
                          className="font-mono text-[10px] text-muted-soft hover:text-ink"
                        >
                          {t('search.recentClear')}
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {recent.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setQ(r)}
                            className="badge-soft hover:bg-canvas-soft"
                          >
                            ↺ {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="eyebrow">{t('search.quickAccess')}</p>
                    <div className="mt-2 grid grid-cols-2 gap-1.5 md:grid-cols-3">
                      {quickCats.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setOpen(false)
                            nav(`/explore?cat=${c.id}`)
                          }}
                          className="flex items-center gap-2 rounded-md border border-hairline px-3 py-2 text-left text-body-sm text-body hover:border-ink hover:bg-canvas-soft"
                        >
                          <span className="text-base" aria-hidden>{c.emoji}</span>
                          <span className="truncate">{c.label[lang]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-center text-[10px] font-mono text-muted-soft pt-1">
                    {t('search.empty')}
                  </p>
                </div>
              )}
              {!loading && q.trim().length > 0 && results.length === 0 && (
                <p className="p-6 text-center text-caption text-muted">
                  {t('search.noResults')}
                </p>
              )}
              <ul className="py-1">
                {results.map((r, idx) => (
                  <li key={`${r.type}-${r.id}`}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => go(r)}
                      className={
                        'flex w-full items-center gap-3 px-4 py-2.5 text-left ' +
                        (idx === activeIdx ? 'bg-canvas-soft' : 'hover:bg-canvas-soft')
                      }
                    >
                      <span className="text-xl" aria-hidden>{r.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-title-sm text-ink truncate">{r.label}</div>
                        {r.sublabel && (
                          <div className="text-caption text-muted truncate">{r.sublabel}</div>
                        )}
                      </div>
                      <span className="font-mono text-xs text-muted-soft">↵</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

