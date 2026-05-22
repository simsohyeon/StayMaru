import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import TopBar from '@/components/TopBar'
import PlaceCard from '@/components/PlaceCard'
import CategoryBadge from '@/components/CategoryBadge'
import Thumbnail from '@/components/Thumbnail'
import FavoriteStar from '@/components/FavoriteStar'
import { useFavorites } from '@/stores/favorites'
import { useCourses } from '@/stores/courses'
import { useSettings } from '@/stores/settings'
import { searchPlaces, searchFestivals } from '@/api/tour'
import { generateCourse } from '@/lib/courseEngine'
import { encodeShare, shareOrCopy, toastForShareResult } from '@/lib/share'
import { useToasts } from '@/stores/toasts'

export default function Favorites() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const lang = useSettings((s) => s.lang)
  const places = useFavorites((s) => s.places)
  const festivals = useFavorites((s) => s.festivals)
  const toggleFest = useFavorites((s) => s.togglefestival)
  const saved = useCourses((s) => s.saved)
  const setCurrent = useCourses((s) => s.setCurrent)
  const removeCourse = useCourses((s) => s.remove)
  const pushToast = useToasts((s) => s.show)
  const [tab, setTab] = useState<'places' | 'festivals' | 'courses'>('places')
  const [generating, setGenerating] = useState(false)

  async function handleShareCourse(c: typeof saved[number], e: React.MouseEvent) {
    e.stopPropagation()
    const url = `${location.origin}/course/shared/${encodeShare(c)}`
    const heroImage = c.items[0]?.place.thumbnail
    const description = `${c.items.length}${t('course.visitedUnit')} · ${c.totalDistanceKm}${t('course.km')} · ${c.estimatedTravelMinutes}${t('course.min')}`
    const r = await shareOrCopy({ title: c.title, text: description, url, imageUrl: heroImage })
    toastForShareResult(r, t, pushToast)
  }

  async function buildFromFavorites() {
    setGenerating(true)
    try {
      const sigunguCodes = Array.from(
        new Set(places.map((p) => p.sigunguCode).filter((x): x is number => !!x)),
      ).slice(0, 3)
      const extraBuckets = await Promise.all(
        (sigunguCodes.length > 0 ? sigunguCodes : [4]).map((c) =>
          searchPlaces({ sigunguCode: c, lang }),
        ),
      )
      const fest = await searchFestivals(lang)
      const candidates = [...places, ...extraBuckets.flatMap((r) => r.items)]
      const course = generateCourse({
        candidates,
        festivals: [...festivals, ...fest],
        baseSigungus: sigunguCodes,
        duration: '1n2d',
        hiddenMode: false,
        favorites: places,
        lang,
      })
      setCurrent(course)
      nav('/course')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="bg-canvas">
      <TopBar title={t('favorites.title')} />
      <div className="px-5 py-8 md:px-10 md:py-12">
        <div className="mb-8 flex gap-1 border-b border-hairline">
          {(['places', 'festivals', 'courses'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={clsx(
                '-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                tab === k
                  ? 'border-ink text-ink'
                  : 'border-transparent text-muted hover:text-ink',
              )}
            >
              {t(`favorites.${k}`)}
              <span className="ml-1.5 font-mono text-[11px] text-muted-soft">
                {k === 'places' ? places.length : k === 'festivals' ? festivals.length : saved.length}
              </span>
            </button>
          ))}
        </div>

        {tab === 'places' && (
          <>
            {places.length === 0 ? (
              <Empty />
            ) : (
              <>
                <ul className="space-y-3 md:hidden">
                  {places.map((p) => (
                    <li key={p.id}>
                      <PlaceCard place={p} variant="row" />
                    </li>
                  ))}
                </ul>
                <ul className="hidden md:grid md:grid-cols-2 md:gap-5 lg:grid-cols-3">
                  {places.map((p) => (
                    <li key={p.id}>
                      <PlaceCard place={p} variant="tile" />
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn-download"
                disabled={places.length === 0 || generating}
                onClick={() => void buildFromFavorites()}
              >
                {generating ? t('course.generating') : t('favorites.generateFromFavorites')} →
              </button>
              {places.length > 0 && places.length < 3 && (
                <p className="font-mono text-caption text-muted">{t('favorites.notEnough')}</p>
              )}
            </div>
          </>
        )}

        {tab === 'festivals' &&
          (festivals.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-3 md:grid md:grid-cols-2 md:gap-5 md:space-y-0 lg:grid-cols-3">
              {festivals.map((f) => (
                <li
                  key={f.id}
                  className="card-hover relative flex gap-4 p-4 cursor-pointer"
                  onClick={() => nav(`/festivals/${f.id}`, { state: { festival: f } })}
                >
                  <div className="h-20 w-24 flex-shrink-0 overflow-hidden rounded-md">
                    <Thumbnail src={f.thumbnail} alt={f.name} category="festival" compact />
                  </div>
                  <div className="min-w-0 flex-1 pr-8">
                    <CategoryBadge category="festival" lang={lang} />
                    <div className="mt-2 text-title-sm text-ink truncate">{f.name}</div>
                    <p className="mt-1 font-mono text-caption text-primary">
                      {prettyYmd(f.eventStartDate)} → {prettyYmd(f.eventEndDate)}
                    </p>
                  </div>
                  <FavoriteStar
                    active
                    className="absolute right-2 top-3"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFest(f)
                    }}
                  />
                </li>
              ))}
            </ul>
          ))}

        {tab === 'courses' &&
          (saved.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-3 md:grid md:grid-cols-2 md:gap-5 md:space-y-0">
              {saved.map((c) => (
                <li
                  key={c.id}
                  className="card-hover p-5 cursor-pointer"
                  onClick={() => {
                    setCurrent(c)
                    nav('/course')
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-title-md text-ink truncate">{c.title}</div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeCourse(c.id)
                      }}
                      className="font-mono text-[11px] text-muted hover:text-ink"
                    >
                      remove
                    </button>
                  </div>
                  <p className="mt-2 font-mono text-caption text-muted">
                    {c.items.length} · {c.totalDistanceKm}
                    {t('course.km')} · {c.estimatedTravelMinutes}
                    {t('course.min')}
                  </p>
                  <div className="mt-3 flex gap-2 border-t border-hairline pt-3">
                    <button
                      type="button"
                      className="btn-secondary !h-8 !px-3 !text-[11px]"
                      onClick={(e) => void handleShareCourse(c, e)}
                    >
                      ↗ {t('course.share')}
                    </button>
                    <button
                      type="button"
                      className="btn-text !text-[11px]"
                      onClick={(e) => {
                        e.stopPropagation()
                        setCurrent(c)
                        nav('/course')
                      }}
                    >
                      {t('common.viewMore')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </div>
  )
}

function Empty() {
  const { t } = useTranslation()
  return <p className="py-16 text-center text-body-md text-muted">{t('favorites.empty')}</p>
}

function prettyYmd(ymd: string) {
  if (!ymd || ymd.length !== 8) return ymd
  return `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}.${ymd.slice(6, 8)}`
}
