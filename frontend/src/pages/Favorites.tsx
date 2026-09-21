import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import TopBar from '@/components/TopBar'
import KhsPageHeader from '@/components/khs/KhsPageHeader'
import MySubNav from '@/components/khs/MySubNav'
import PlaceCard from '@/components/PlaceCard'
import CategoryBadge from '@/components/CategoryBadge'
import Thumbnail from '@/components/Thumbnail'
import FavoriteStar from '@/components/FavoriteStar'
import { ChevronRightIcon, ShareIcon, TrashIcon } from '@/components/icons'
import { useFavorites } from '@/stores/favorites'
import { useCourses } from '@/stores/courses'
import { useSettings } from '@/stores/settings'
import { generateCourse } from '@/lib/courseEngine'
import type { TripDuration } from '@/types/domain'
import { encodeShare, shareOrCopy, toastForShareResult } from '@/lib/share'
import { useToasts } from '@/stores/toasts'
import { askConfirm } from '@/stores/confirm'

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
  const [params] = useSearchParams()
  const initialTab = params.get('tab')
  const [tab, setTab] = useState<'places' | 'festivals' | 'courses'>(
    initialTab === 'festivals' || initialTab === 'courses' ? initialTab : 'places',
  )
  const [generating, setGenerating] = useState(false)

  // 저장 코스 삭제 — 되돌릴 수 없으므로 확인 다이얼로그를 거친다(내 여행 홈과 동일 동작).
  async function handleRemoveCourse(c: typeof saved[number], e: React.MouseEvent) {
    e.stopPropagation()
    const ok = await askConfirm({
      title: t('course.removeConfirmTitle'),
      message: t('course.removeConfirm', { title: c.title }),
      confirmLabel: t('course.remove'),
      danger: true,
    })
    if (!ok) return
    removeCourse(c.id)
    pushToast(t('course.removedToast'))
  }

  async function handleShareCourse(c: typeof saved[number], e: React.MouseEvent) {
    e.stopPropagation()
    const url = `${location.origin}/course/shared/${await encodeShare(c)}`
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
      // '찜으로 코스 만들기' 는 찜한 것만으로 코스를 짠다 — 외부 조회로 후보를 채우지
      // 않는다. 사용자가 고른 곳만 나와야 해서, 장소·축제 모두 찜 목록으로 한정한다.
      // 기간은 찜 개수에 맞춘다(당일 ~4곳 / 1박2일 ~6곳 / 그 이상 2박3일).
      const duration: TripDuration =
        places.length <= 4 ? 'day' : places.length <= 6 ? '1n2d' : '2n3d'
      const course = generateCourse({
        candidates: places,
        festivals,
        baseSigungus: sigunguCodes,
        duration,
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
    <div className="page khs-page">
      <TopBar title={t('favorites.title')} />
      <KhsPageHeader title={t('favorites.title')} trail={[{ label: t('khs.gnb.my') }, { label: t('favorites.title') }]} />

      <div className="page-body page-stack khs-page__body">
        <MySubNav />
        <div className="khs-result-col">
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
                      {prettyYmd(f.eventStartDate)} ~ {prettyYmd(f.eventEndDate)}
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
                      onClick={(e) => void handleRemoveCourse(c, e)}
                      className="favorites__course-remove"
                      aria-label={`${c.title} ${t('course.remove')}`}
                      title={t('course.remove')}
                    >
                      <TrashIcon width={18} height={18} />
                    </button>
                  </div>
                  <p className="favorites__course-meta">
                    {c.items.length}
                    {t('course.visitedUnit')} · {c.totalDistanceKm}
                    {t('course.km')} · {c.estimatedTravelMinutes}
                    {t('course.min')}
                  </p>
                  <div className="favorites__course-actions">
                    <button
                      type="button"
                      className="btn-secondary favorites__course-share"
                      onClick={(e) => void handleShareCourse(c, e)}
                      aria-label={`${c.title} ${t('course.share')}`}
                      title={t('course.share')}
                    >
                      <ShareIcon width={17} height={17} />
                    </button>
                    <button
                      type="button"
                      className="favorites__course-more"
                      aria-label={`${c.title} ${t('common.viewDetail')}`}
                      title={t('common.viewDetail')}
                      onClick={(e) => {
                        e.stopPropagation()
                        setCurrent(c)
                        nav('/course')
                      }}
                    >
                      <ChevronRightIcon width={20} height={20} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ))}
      </div>
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
