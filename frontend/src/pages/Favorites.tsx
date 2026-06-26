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
import { loadVisitorBoost } from '@/lib/visitorIndex'
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
  const recent = useCourses((s) => s.recent)
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
      const extraResults = await Promise.allSettled(
        (sigunguCodes.length > 0 ? sigunguCodes : [4]).map((c) =>
          searchPlaces({ sigunguCode: c, lang }),
        ),
      )
      const fest = await searchFestivals(lang, undefined, { ogImages: false })
      await loadVisitorBoost()
      const candidates = [
        ...places,
        ...extraResults.flatMap((r) => (r.status === 'fulfilled' ? r.value.items : [])),
      ]
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
    } catch (err) {
      console.error('[buildFromFavorites] failed', err)
      pushToast(t('course.generateFailed'), { type: 'error', duration: 3500 })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="page">
      <TopBar title={t('favorites.title')} />
      <div className="page-body">
        {recent[0] && (
          <button
            type="button"
            onClick={() => {
              setCurrent(recent[0])
              nav('/course')
            }}
            className="favorites__resume"
          >
            <span className="favorites__resume-icon" aria-hidden>↺</span>
            <span className="favorites__resume-body">
              <span className="favorites__resume-eyebrow">{t('favorites.resumeEyebrow')}</span>
              <span className="card-subtitle favorites__resume-title">{recent[0].title}</span>
            </span>
            <span className="favorites__resume-meta">
              {recent[0].items.length}{t('course.visitedUnit')} →
            </span>
          </button>
        )}
        <div className="favorites__tabs">
          {(['places', 'festivals', 'courses'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={clsx(
                'favorites__tab',
                tab === k
                  ? 'favorites__tab--active'
                  : 'favorites__tab--inactive',
              )}
            >
              {t(`favorites.${k}`)}
              <span className="favorites__tab-count">
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
                <ul className="favorites__list-mobile">
                  {places.map((p) => (
                    <li key={p.id}>
                      <PlaceCard place={p} variant="row" />
                    </li>
                  ))}
                </ul>
                <ul className="favorites__list-grid">
                  {places.map((p) => (
                    <li key={p.id}>
                      <PlaceCard place={p} variant="tile" />
                    </li>
                  ))}
                </ul>
              </>
            )}
            {places.length > 0 && (
              <div className="favorites__generate">
                <button
                  type="button"
                  className="btn-download"
                  disabled={generating}
                  onClick={() => void buildFromFavorites()}
                >
                  {generating ? t('course.generating') : t('favorites.generateFromFavorites')} →
                </button>
                {places.length < 3 && (
                  <p className="favorites__generate-hint">{t('favorites.notEnough')}</p>
                )}
              </div>
            )}
          </>
        )}

        {tab === 'festivals' &&
          (festivals.length === 0 ? (
            <Empty />
          ) : (
            <ul className="favorites__fest-list">
              {festivals.map((f) => (
                <li
                  key={f.id}
                  className="card-hover favorites__fest-card"
                  onClick={() => nav(`/festivals/${f.id}`, { state: { festival: f } })}
                >
                  <div className="favorites__fest-thumb">
                    <Thumbnail src={f.thumbnail} alt={f.name} category="festival" compact />
                  </div>
                  <div className="favorites__fest-info">
                    <CategoryBadge category="festival" lang={lang} />
                    <div className="card-subtitle favorites__fest-name">{f.name}</div>
                    <p className="favorites__fest-dates">
                      {prettyYmd(f.eventStartDate)} → {prettyYmd(f.eventEndDate)}
                    </p>
                  </div>
                  <FavoriteStar
                    active
                    className="favorites__fest-star"
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
            <Empty message={t('favorites.emptyCourses')} />
          ) : (
            <ul className="favorites__course-list">
              {saved.map((c) => (
                <li
                  key={c.id}
                  className="card-hover favorites__course-card"
                  onClick={() => {
                    setCurrent(c)
                    nav('/course')
                  }}
                >
                  <div className="favorites__course-head">
                    <div className="card-title favorites__course-title">{c.title}</div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeCourse(c.id)
                      }}
                      className="favorites__course-remove"
                      aria-label={t('course.remove')}
                    >
                      {t('course.remove')}
                    </button>
                  </div>
                  <p className="favorites__course-meta">
                    {c.items.length} · {c.totalDistanceKm}
                    {t('course.km')} · {c.estimatedTravelMinutes}
                    {t('course.min')}
                  </p>
                  <div className="favorites__course-actions">
                    <button
                      type="button"
                      className="btn-secondary favorites__course-share"
                      onClick={(e) => void handleShareCourse(c, e)}
                    >
                      ↗ {t('course.share')}
                    </button>
                    <button
                      type="button"
                      className="btn-text favorites__course-more"
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

function Empty({ message }: { message?: string }) {
  const { t } = useTranslation()
  return <p className="favorites__empty">{message ?? t('favorites.empty')}</p>
}

function prettyYmd(ymd: string) {
  if (!ymd || ymd.length !== 8) return ymd
  return `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}.${ymd.slice(6, 8)}`
}
