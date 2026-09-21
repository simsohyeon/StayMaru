import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import TopBar from '@/components/TopBar'
import KhsPageHeader from '@/components/khs/KhsPageHeader'
import MySubNav from '@/components/khs/MySubNav'
import PlaceCard from '@/components/PlaceCard'
import CategoryBadge from '@/components/CategoryBadge'
import Thumbnail from '@/components/Thumbnail'
import { ChevronRightIcon, TrashIcon } from '@/components/icons'
import { useFavorites } from '@/stores/favorites'
import { useCourses } from '@/stores/courses'
import { useSettings } from '@/stores/settings'
import { formatDuration } from '@/lib/duration'
import { useToasts } from '@/stores/toasts'
import { askConfirm } from '@/stores/confirm'
import { findSigungu } from '@/constants/sigungu'
import type { Course } from '@/types/domain'

const LANG_LABEL = { ko: '한국어', en: 'English', ja: '日本語', zh: '中文' } as const

function ymdToday() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

/** 「내 여행」 홈 — 요약 타일 · 찜 · 저장 코스 · 설정/안내를 한 화면에 모은 허브. */
export default function MyTrip() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const lang = useSettings((s) => s.lang)
  const places = useFavorites((s) => s.places)
  const festivals = useFavorites((s) => s.festivals)
  const saved = useCourses((s) => s.saved)
  const setCurrent = useCourses((s) => s.setCurrent)
  const removeCourse = useCourses((s) => s.remove)
  const pushToast = useToasts((s) => s.show)
  const [tab, setTab] = useState<'places' | 'festivals'>('places')

  // 저장 코스 삭제 — 되돌릴 수 없으므로 확인 다이얼로그를 거친다.
  async function handleRemoveCourse(c: Course) {
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

  // 타일 힌트 — 찜한 장소 상위 시·군 3곳 / 축제 진행·예정 / 마지막 저장일
  const bySigungu = new Map<number, number>()
  for (const p of places) if (p.sigunguCode) bySigungu.set(p.sigunguCode, (bySigungu.get(p.sigunguCode) ?? 0) + 1)
  const regionHint = [...bySigungu.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([code, n]) => `${findSigungu(code)?.[lang] ?? code} ${n}`)
    .join(' · ')
  const today = ymdToday()
  const ongoing = festivals.filter((f) => f.eventStartDate <= today && f.eventEndDate >= today).length
  const upcoming = festivals.filter((f) => f.eventStartDate > today).length
  const lastSaved = saved[0]?.createdAt ? new Date(saved[0].createdAt).toLocaleDateString(lang) : ''

  const empty = places.length === 0 && festivals.length === 0 && saved.length === 0

  return (
    <div className="page khs-page">
      <TopBar title={t('khs.gnb.my')} />
      <KhsPageHeader title={t('khs.gnb.my')} trail={[{ label: t('khs.gnb.my') }]} />

      <div className="page-body page-stack khs-page__body">
        <MySubNav />
        <div className="khs-result-col my">

          <ul className="my__tiles">
            <Tile to="/favorites" label={t('favorites.places')} n={places.length} unit={t('my.unitPlace')} hint={regionHint} />
            <Tile
              to="/favorites?tab=festivals"
              label={t('favorites.festivals')}
              n={festivals.length}
              unit={t('my.unitFestival')}
              hint={festivals.length ? t('my.festivalHint', { ongoing, upcoming }) : ''}
            />
            <Tile
              to="/favorites?tab=courses"
              label={t('favorites.courses')}
              n={saved.length}
              unit={t('my.unitCourse')}
              hint={lastSaved ? t('my.lastSaved', { date: lastSaved }) : ''}
            />
          </ul>

          {empty ? (
            <div className="my__empty">
              <p>{t('my.emptyBody')}</p>
              <Link to="/explore" className="btn-download">{t('my.emptyCta')} →</Link>
            </div>
          ) : (
            <>
              <section className="my__section">
                <div className="my__section-head">
                  <h2>{t('favorites.title')}</h2>
                  <Link to={tab === 'places' ? '/favorites' : '/favorites?tab=festivals'}>
                    {t('my.viewAll', { n: tab === 'places' ? places.length : festivals.length })}
                  </Link>
                </div>
                <div className="my__fav-bar">
                  <div className="favorites__tabs my__tabs">
                    {(['places', 'festivals'] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setTab(k)}
                        className={clsx('favorites__tab', tab === k ? 'favorites__tab--active' : 'favorites__tab--inactive')}
                      >
                        {t(`favorites.${k}`)}
                        <span className="favorites__tab-count">{k === 'places' ? places.length : festivals.length}</span>
                      </button>
                    ))}
                  </div>
                  {places.length > 0 && (
                    <Link to="/favorites" className="btn-download my__generate">{t('favorites.generateFromFavorites')} →</Link>
                  )}
                </div>
                {tab === 'places' &&
                  (places.length === 0 ? (
                    <p className="favorites__empty">{t('favorites.empty')}</p>
                  ) : (
                    <ul className="my__grid">
                      {places.slice(0, 3).map((p) => (
                        <li key={p.id}><PlaceCard place={p} variant="tile" /></li>
                      ))}
                    </ul>
                  ))}
                {tab === 'festivals' &&
                  (festivals.length === 0 ? (
                    <p className="favorites__empty">{t('favorites.empty')}</p>
                  ) : (
                    <ul className="my__grid">
                      {festivals.slice(0, 3).map((f) => (
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
                            <p className="favorites__fest-dates">{prettyYmd(f.eventStartDate)} ~ {prettyYmd(f.eventEndDate)}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ))}
              </section>

              <section className="my__section">
                <div className="my__section-head">
                  <h2>{t('favorites.courses')}</h2>
                  <Link to="/favorites?tab=courses">{t('my.viewAll', { n: saved.length })}</Link>
                </div>
                {saved.length === 0 ? (
                  <p className="favorites__empty">{t('favorites.emptyCourses')}</p>
                ) : (
                  <ul className="my__courses">
                    {saved.slice(0, 3).map((c) => (
                      <li key={c.id} className="my__course-row">
                        <button
                          type="button"
                          className="my__course"
                          aria-label={`${c.title} ${t('common.viewDetail')}`}
                          onClick={() => {
                            setCurrent(c)
                            nav('/course')
                          }}
                        >
                          <span className="my__course-body">
                            <span className="card-subtitle my__course-title">{c.title}</span>
                            <span className="my__course-meta">
                              {c.items.length}{t('course.visitedUnit')} · {c.totalDistanceKm}{t('course.km')} · {formatDuration(c.estimatedTravelMinutes, t)}
                            </span>
                          </span>
                          <span className="my__course-open" aria-hidden>
                            <ChevronRightIcon width={20} height={20} />
                          </span>
                        </button>
                        <button
                          type="button"
                          className="my__course-remove"
                          aria-label={`${c.title} ${t('course.remove')}`}
                          title={t('course.remove')}
                          onClick={() => void handleRemoveCourse(c)}
                        >
                          <TrashIcon width={18} height={18} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          <div className="my__settings">
            <span className="my__settings-label">{t('my.settingsRow')}</span>
            <ul className="my__settings-links">
              <li><Link to="/settings">{t('settings.language')} · {LANG_LABEL[lang]}</Link></li>
              <li><Link to="/settings#about">{t('footer.policy.about')}</Link></li>
              <li><Link to="/settings#privacy">{t('footer.policy.privacy')}</Link></li>
              <li><Link to="/settings" className="my__settings-all">{t('nav.settings')} →</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function Tile({ to, label, n, unit, hint }: { to: string; label: string; n: number; unit: string; hint: string }) {
  return (
    <li>
      <Link to={to} className="my__tile">
        <span className="my__tile-label">{label}</span>
        <span className="my__tile-num">
          {n}<small>{unit}</small>
        </span>
        <span className="my__tile-hint">{hint || ' '}</span>
      </Link>
    </li>
  )
}

function prettyYmd(ymd: string) {
  if (!ymd || ymd.length !== 8) return ymd
  return `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}.${ymd.slice(6, 8)}`
}
