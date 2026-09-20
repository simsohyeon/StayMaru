import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { SearchIcon, RouteIcon, HanokIcon, FestivalIcon, TempleIcon, MapIcon, ChevronLeftIcon, ChevronRightIcon } from '../icons'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { CURATED_COURSES } from '@/constants/curatedCourses'
import { SIGUNGUS, findSigungu } from '@/constants/sigungu'
import { CATEGORIES, CATEGORY_MAP, PROFILE_LABELS } from '@/constants/categories'
import Thumbnail from '@/components/Thumbnail'
import { searchPlaces } from '@/api/tour'
import { fetchTemples } from '@/api/templestay'
import { curatedExploreUrl } from '@/lib/exploreUrl'
import { curatedCourseLabel } from '@/lib/curatedLabel'
import {
  fetchGyeongbukAwardPhotos,
  pickBySigungu,
  type AwardPhoto,
} from '@/api/photoAward'
import { prefersReducedMotion, useKhsReveal } from './useKhsReveal'
import type {
  CourseProfile,
  DateRange,
  Festival,
  Lang,
  TripDuration,
} from '@/types/domain'

/**
 * digital.khs.go.kr 데스크톱 레이아웃 클론 (≥1024px 전용).
 *
 * 원본에서 계측해 그대로 옮긴 값:
 *   헤더 134px (header-top 76 + navigation 58) / section-visual padding-top 133
 *   히어로 swiper 563px · effect fade · autoplay 5000ms · speed 300ms · 3 slides
 *   navigation-search 1082×122 · radius 8 · shadow 0 0 10px rgba(0,0,0,.1) — 히어로 하단에 걸침
 *   theme-grid 3col · gap 28 · rows 278/278/200 · card-01 은 1/1/3/2, card-06 은 전폭
 *   리빌 ScrollTrigger start 'top 80%' (통계는 'top 50%') · opacity+y · 0.7s · power2.out
 *   stagger 0.1 (테마카드) / 0.08 (공지)
 *
 * 브랜드 슬롯(로고·기관명)에는 쉼마루 것을 넣는다. 국가유산청 마크를 그대로 쓰면
 * 공공기관 사칭이 되므로, 레이아웃만 동일하게 두고 아이덴티티는 교체한다.
 *
 * 콘텐츠가 원본만큼 없는 자리는 비우지 않고 `.khs-empty` 플레이스홀더로 채워
 * 레이아웃 치수가 원본과 동일하게 유지되도록 한다.
 *
 * 문안은 전부 i18n(`khs.*`) 키를 쓴다 — 지역·카테고리·코스명은 상수의 다국어 필드에서 파생.
 */

/** 히어로 검색바가 넘기는 코스 조건 — Home 의 generateFromInput 과 같은 모양. */
export interface HeroSearch {
  sigunguCodes: number[]
  range: DateRange
  profiles: CourseProfile[]
  duration: TripDuration
}

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 출발·도착일 차이를 코스 엔진의 duration 으로 환산. */
function durationFromRange(start: string, end: string): TripDuration {
  const nights = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 86400000,
  )
  if (nights <= 0) return 'day'
  if (nights === 1) return '1n2d'
  if (nights === 2) return '2n3d'
  return 'custom'
}

/** 히어로에 우선 배치할 수상작 (제목 키워드). 없으면 금상 → 나머지 순으로 채운다. */
const HERO_PHOTO_PREF = ['하회마을', '첨성대', '소수서원']

/** 히어로 3슬라이드 — 원본과 같은 개수·같은 문안 위계(타이틀 + 서브카피). i18n 키 접미. */
const SLIDE_KEYS = ['slide1', 'slide2', 'slide3'] as const

/** 히어로 검색바 취향 셀렉트 순서 */
/** 매체유형 카드 — 라벨·설명·수치 + 우측 아이콘 + 클릭 시 이동할 화면 */
type MediaCard = {
  key: string
  desc: string
  value: number
  icon: (props: React.SVGProps<SVGSVGElement>) => React.JSX.Element
  to: string
}

const PROFILES: CourseProfile[] = [
  'known_gb',
  'hidden_gb',
  'hanok_emotion',
  'temple_healing',
  'experience_focus',
  'festival_link',
]


export default function KhsDesktopHome({
  lang,
  festivals,
  generating,
  onGenerate,
  onSearch,
}: {
  lang: Lang
  festivals: Festival[]
  generating: boolean
  onGenerate: () => void
  /** 히어로 검색바 — 조건 그대로 코스를 만든다(모달을 띄우지 않는다). */
  onSearch: (s: HeroSearch) => void
}) {
  const { t } = useTranslation()
  /* 관광공모전 수상작(경북 15건) — 실패하면 빈 배열이라 그라데이션 폴백이 그대로 유지된다. */
  const [photos, setPhotos] = useState<AwardPhoto[]>([])
  useEffect(() => {
    let cancelled = false
    void fetchGyeongbukAwardPhotos().then((p) => {
      if (!cancelled) setPhotos(p)
    })
    return () => {
      cancelled = true
    }
  }, [])

  /* 매체 카드의 장소·템플스테이 수 — 실패 시 0 (카운터만 0 으로 남고 레이아웃은 유지). */
  const [placeCount, setPlaceCount] = useState(0)
  const [templeCount, setTempleCount] = useState(0)
  useEffect(() => {
    let cancelled = false
    void searchPlaces({ lang, numOfRows: 1 })
      .then((r) => {
        if (!cancelled) setPlaceCount(r.totalCount)
      })
      .catch(() => {})
    void fetchTemples()
      .then((list) => {
        if (!cancelled) setTempleCount(list.length)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [lang])

  /* ── 통계 4종 — 원본 `.user-date` 카운터 자리 ── */
  const stats = useMemo(
    () => [
      { label: t('khs.home.statCourses'), value: CURATED_COURSES.length },
      { label: t('khs.home.statSigungu'), value: SIGUNGUS.length },
      { label: t('khs.home.statCategories'), value: CATEGORIES.length },
      { label: t('khs.home.statFestivals'), value: festivals.length },
    ],
    [festivals.length, t],
  )

  /* ── 원본 `.card-list` 의 매체유형 카드 5장 — 각 카드가 자기 수치·아이콘을 갖고, 해당 화면으로 이동한다 ── */
  const mediaCards = useMemo<MediaCard[]>(
    () => [
      { key: t('khs.home.mediaCourse'), desc: t('khs.home.mediaCourseDesc'), value: CURATED_COURSES.length, icon: RouteIcon, to: '/themes' },
      { key: t('khs.home.mediaPlace'), desc: t('khs.home.mediaPlaceDesc'), value: placeCount, icon: HanokIcon, to: '/explore' },
      { key: t('khs.home.mediaFestival'), desc: t('khs.home.mediaFestivalDesc'), value: festivals.length, icon: FestivalIcon, to: '/festivals' },
      { key: t('khs.home.mediaTemplestay'), desc: t('khs.home.mediaTemplestayDesc'), value: templeCount, icon: TempleIcon, to: '/explore?cat=templestay' },
      { key: t('khs.home.mediaSigungu'), desc: t('khs.home.mediaSigunguDesc'), value: SIGUNGUS.length, icon: MapIcon, to: '/insights' },
    ],
    [festivals.length, placeCount, templeCount, t],
  )

  return (
    <div className="khs-desktop">
      <main className="khs-main">
        <SectionVisual lang={lang} onSearch={onSearch} generating={generating} photos={photos} />
        <SectionInfo
          lang={lang}
          stats={stats}
          mediaCards={mediaCards}
          generating={generating}
          onGenerate={onGenerate}
        />
        <SectionTheme lang={lang} photos={photos} />
        <SectionFestival festivals={festivals} lang={lang} />
      </main>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
 * SECTION VISUAL — 히어로 fade 캐러셀 + 걸친 검색바 + 해시태그 + 탭 10
 * ═══════════════════════════════════════════════════════════════════ */
function SectionVisual({
  lang,
  onSearch,
  generating,
  photos,
}: {
  lang: Lang
  onSearch: (s: HeroSearch) => void
  generating: boolean
  photos: AwardPhoto[]
}) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  // 검색 조건 — 기본 출발일 오늘, 도착일 +1 (1박 2일)
  const [sigungu, setSigungu] = useState('')
  const [start, setStart] = useState(() => ymd(new Date()))
  const [end, setEnd] = useState(() => ymd(new Date(Date.now() + 86400000)))
  const [profile, setProfile] = useState('')
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const timer = useRef<number | null>(null)

  /* 원본 Swiper: autoplay.delay 5000, speed 300, loop false, effect fade.
     loop:false 라 마지막 슬라이드에서 처음으로 되돌아온다(원본 동작 동일). */
  useEffect(() => {
    if (paused) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    timer.current = window.setInterval(() => {
      setIdx((i) => (i + 1) % SLIDE_KEYS.length)
    }, 5000)
    return () => {
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [paused])

  const go = (d: number) => setIdx((i) => (i + d + SLIDE_KEYS.length) % SLIDE_KEYS.length)

  const runSearch = () => {
    if (generating) return
    const safeEnd = end < start ? start : end
    onSearch({
      sigunguCodes: sigungu ? [Number(sigungu)] : [],
      range: { start, end: safeEnd },
      profiles: profile ? [profile as CourseProfile] : [],
      duration: durationFromRange(start, safeEnd),
    })
  }
  const resetFilters = () => {
    setSigungu('')
    setProfile('')
    setStart(ymd(new Date()))
    setEnd(ymd(new Date(Date.now() + 86400000)))
  }

  // 슬라이드별 배경 사진 — 선호 작품 우선, 부족분은 금상→나머지 순으로.
  const heroPhotos = useMemo(() => {
    const picked: AwardPhoto[] = []
    for (const kw of HERO_PHOTO_PREF) {
      const hit = photos.find((p) => p.title.includes(kw) && !picked.includes(p))
      if (hit) picked.push(hit)
    }
    const rest = [...photos]
      .filter((p) => !picked.includes(p))
      .sort((a, b) => Number(b.isTop) - Number(a.isTop))
    while (picked.length < SLIDE_KEYS.length && rest.length) picked.push(rest.shift()!)
    return picked
  }, [photos])

  /* 원본 `.visual-tooltip` 의 추천 검색조건 해시태그 (5개) — 각각 조건을 물고 탐색으로 간다. */
  const hashtags = [
    { label: findSigungu(11)?.[lang] ?? '', to: '/explore?sigungu=11' },
    { label: CATEGORY_MAP.hanok.label[lang], to: '/explore?cat=hanok' },
    { label: CATEGORY_MAP.templestay.label[lang], to: '/explore?cat=templestay' },
    { label: CATEGORY_MAP.seowon.label[lang], to: '/explore?cat=seowon' },
    { label: CATEGORY_MAP.festival.label[lang], to: '/festivals' },
  ].filter((h) => h.label)

  return (
    <section className="khs-section-visual">
      <div className="khs-visual-slider">
        {/* ── fade 캐러셀 (swiper-fade 재현: 슬라이드가 겹쳐 있고 opacity 만 300ms 전환) ── */}
        <div
          className="khs-swiper"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          {SLIDE_KEYS.map((k, i) => {
            const photo = heroPhotos[i]
            return (
              <div
                key={k}
                className={clsx(
                  'khs-slide',
                  `khs-slide--${i + 1}`,
                  photo && 'has-photo',
                  i === idx && 'is-active',
                )}
                style={photo ? { ['--khs-photo' as string]: `url("${photo.image}")` } : undefined}
                aria-hidden={i !== idx}
              >
                <div className="khs-slide__scrim" />
                <div className="khs-inner khs-slide__body">
                  <h2 className="khs-slide__title">{t(`khs.home.${k}Title`)}</h2>
                  <p className="khs-slide__sub">{t(`khs.home.${k}Sub`)}</p>
                </div>
              </div>
            )
          })}

          {/* 컨트롤: ‹ 2/3 › — 재생/정지 버튼은 두지 않는다.
             대신 마우스를 올리거나 포커스가 들어오면 자동재생이 멈춘다
             (WCAG 2.2.2 '일시정지' 대응 — 정지 수단이 아예 없으면 안 된다). */}
          <div className="khs-swiper-ctrl">
            <button
              type="button"
              className="khs-swiper-btn"
              aria-label={t('khs.home.prevSlide')}
              onClick={() => go(-1)}
            >
              <ChevronLeftIcon width={16} height={16} />
            </button>
            <span className="khs-swiper-count">
              <b>{idx + 1}</b>
              <i>/</i>
              <span>{SLIDE_KEYS.length}</span>
            </span>
            <button
              type="button"
              className="khs-swiper-btn"
              aria-label={t('khs.home.nextSlide')}
              onClick={() => go(1)}
            >
              <ChevronRightIcon width={16} height={16} />
            </button>
          </div>
        </div>

        {/* ── 히어로 하단에 걸치는 흰 검색바 (원본 .navigation-search 1082×122) ── */}
        <div className="khs-navigation-search">
          <form
            className="khs-search-form"
            onSubmit={(e) => {
              e.preventDefault()
              runSearch()
            }}
          >
            <label className="khs-select">
              <span className="khs-select__label">{t('khs.home.region')}</span>
              <select
                className="khs-select__field"
                value={sigungu}
                onChange={(e) => setSigungu(e.target.value)}
              >
                <option value="">{t('khs.home.all')}</option>
                {SIGUNGUS.slice(0, 22).map((sg) => (
                  <option key={sg.code} value={sg.code}>
                    {sg[lang]}
                  </option>
                ))}
              </select>
            </label>

            {/* 기간 — 빌더 모달과 같은 출발일/도착일 선택 */}
            <label className="khs-select khs-select--date">
              <span className="khs-select__label">{t('khs.home.start')}</span>
              <input
                type="date"
                className="khs-select__field"
                value={start}
                onChange={(e) => {
                  setStart(e.target.value)
                  if (end < e.target.value) setEnd(e.target.value)
                }}
              />
            </label>
            <label className="khs-select khs-select--date">
              <span className="khs-select__label">{t('khs.home.end')}</span>
              <input
                type="date"
                className="khs-select__field"
                min={start}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>

            <label className="khs-select">
              <span className="khs-select__label">{t('khs.home.taste')}</span>
              <select
                className="khs-select__field"
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
              >
                <option value="">{t('khs.home.all')}</option>
                {PROFILES.map((p) => (
                  <option key={p} value={p}>
                    {PROFILE_LABELS[p][lang]}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="khs-reset" onClick={resetFilters}>
              {t('khs.home.reset')}
            </button>
          </form>

          {/* 원본 모바일 .search-bottom = 입력줄 + 34×34 아이콘 버튼.
             데스크톱에서는 입력줄/아이콘이 숨고 "검색하기" 텍스트만 남는다. */}
          <div className="khs-search-bottom">
            <label htmlFor="khs-hero-keyword" className="sr-only">
              {t('khs.home.keyword')}
            </label>
            <input
              id="khs-hero-keyword"
              type="search"
              className="khs-search-keyword"
              placeholder={t('khs.home.keywordPlaceholder')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                const k = q.trim()
                if (k) nav(`/explore?q=${encodeURIComponent(k)}`)
                else runSearch()
              }}
            />
            {/* 키워드가 있으면 장소 검색(/explore), 없으면 위 조건으로 코스 생성.
               둘 다 모달을 띄우지 않는다 — "검색"이 곧 결과로 이어지게 한다. */}
            <button
              type="button"
              className="khs-search-submit"
              aria-label={t('khs.home.search')}
              disabled={generating}
              onClick={() => {
                const k = q.trim()
                if (k) nav(`/explore?q=${encodeURIComponent(k)}`)
                else runSearch()
              }}
            >
              <span className="khs-search-submit__label">
                {generating ? t('khs.home.generating') : t('khs.home.search')}
              </span>
              <SearchIcon className="khs-search-submit__icon" />
            </button>
          </div>
        </div>

        {/* ── 추천 검색조건 해시태그 (원본 .visual-list) — 원본의 탭 카드 행(지역별·기간별…)은
            해시태그·GNB 와 역할이 겹쳐 두지 않는다. ── */}
        <div className="khs-visual-list">
          <div className="khs-visual-tooltip">
            <span className="khs-visual-tooltip__label">{t('khs.search.recommend')}</span>
            <ul className="khs-hashtags">
              {hashtags.map((h) => (
                <li key={h.to}>
                  <Link to={h.to} className="khs-hashtag">
                    #{h.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════
 * SECTION INFO — 소개 + 통계 카운터 4 + 매체카드 5 + 인기 4
 * 리빌 start 'top 50%' (원본과 동일), 카운터는 숫자 count-up
 * ═══════════════════════════════════════════════════════════════════ */
function SectionInfo({
  lang,
  stats,
  mediaCards,
  generating,
  onGenerate,
}: {
  lang: Lang
  stats: { label: string; value: number }[]
  mediaCards: MediaCard[]
  generating: boolean
  onGenerate: () => void
}) {
  const { t } = useTranslation()
  const { ref, shown } = useKhsReveal<HTMLElement>(50)

  return (
    <section ref={ref} className={clsx('khs-section-info', shown && 'is-shown')}>
      <div className="khs-inner khs-info-inner">
        <div className="khs-left-content">
          <h2 className="khs-h2">{t('khs.home.infoTitle')}</h2>

          <div className="khs-photo-card">
            <p className="khs-card-title">{t('khs.home.infoBody')}</p>
            <button
              type="button"
              className="khs-photo-btn"
              onClick={onGenerate}
              disabled={generating}
            >
              {generating ? t('khs.home.generating') : t('khs.home.makeCourse')}
            </button>

            <div className="khs-user-date">
              {stats.map((s, i) => (
                <div key={s.label} className="khs-stat">
                  <span className="khs-stat__label">{s.label}</span>
                  <CountUp value={s.value} run={shown} delay={i * 80} />
                </div>
              ))}
            </div>
          </div>

          <div className="khs-card-list">
            <ul>
              {mediaCards.map((c, i) => (
                <li key={c.key} className="khs-card-li">
                  <Link to={c.to} className="khs-card-li__link">
                    <span className="khs-card-li__head">
                      <b className="khs-card-li__key">{c.key}</b>
                      <span className="khs-card-li__icon" aria-hidden>
                        <c.icon width={20} height={20} />
                      </span>
                    </span>
                    <p className="khs-card-li__desc">{c.desc}</p>
                    <CountUp value={c.value} run={shown} delay={i * 80} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="khs-right-content">
          <h2 className="khs-h2">{t('khs.home.popular')}</h2>
          <ul className="khs-popular">
            {CURATED_COURSES.slice(0, 4).map((c, i) => (
              <li key={c.id}>
                <button type="button" className="khs-popular__item" onClick={onGenerate}>
                  <span className="khs-popular__rank">{i + 1}</span>
                  <span className="khs-popular__body">
                    <b className="khs-popular__name">{c.i18n[lang].title}</b>
                    <span className="khs-popular__tag">{curatedCourseLabel(c, lang, t)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/** 원본 통계 카운터의 숫자 증가 연출 (천단위 구분 유지). */
function CountUp({ value, run, delay = 0 }: { value: number; run: boolean; delay?: number }) {
  // 모션 감소 환경에서는 카운트업 없이 최종값에서 시작한다.
  const reduced = prefersReducedMotion()
  const [n, setN] = useState(() => (reduced ? value : 0))

  useEffect(() => {
    if (!run || reduced) return
    let raf = 0
    let start = 0
    const DURATION = 1200
    const kick = window.setTimeout(() => {
      const step = (ts: number) => {
        if (!start) start = ts
        const p = Math.min(1, (ts - start) / DURATION)
        // power2.out — 원본 리빌과 같은 감속 곡선
        setN(Math.round(value * (1 - Math.pow(1 - p, 3))))
        if (p < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, delay)
    return () => {
      window.clearTimeout(kick)
      cancelAnimationFrame(raf)
    }
  }, [run, value, delay, reduced])

  return <strong className="khs-count">{n.toLocaleString('ko-KR')}</strong>
}

/* ═══════════════════════════════════════════════════════════════════
 * SECTION THEME — 6카드 모자이크 (3col / gap 28 / rows 278·278·200)
 * 카드는 거점 시군 + 첫 테마 카테고리를 조건으로 탐색 서비스에 진입한다.
 * ═══════════════════════════════════════════════════════════════════ */
function SectionTheme({ lang, photos }: { lang: Lang; photos: AwardPhoto[] }) {
  const { t } = useTranslation()
  const { ref, shown } = useKhsReveal<HTMLElement>(80)

  // 코스 거점 시군과 수상작 촬영지를 맞춰 카드 배경을 채운다. 남으면 중복 없이 순서대로.
  const cardPhotos = useMemo(() => {
    const used = new Set<string>()
    const spare = () => photos.find((p) => !used.has(p.id))
    return CURATED_COURSES.slice(0, 6).map((c) => {
      const names = c.sigunguCodes
        .map((code) => SIGUNGUS.find((s) => s.code === code)?.ko)
        .filter(Boolean) as string[]
      const hit = names.map((n) => pickBySigungu(photos, n, used)).find(Boolean) ?? spare()
      if (hit) used.add(hit.id)
      return hit
    })
  }, [photos])

  return (
    <section ref={ref} className={clsx('khs-section-theme khs-inner', shown && 'is-shown')}>
      <h2 className="khs-h2 khs-reveal">{t('khs.home.themeTitle')}</h2>
      <div className="khs-theme-list">
        <ul className="khs-theme-grid">
          {CURATED_COURSES.slice(0, 6).map((c, i) => {
            const photo = cardPhotos[i]
            return (
              <li
                key={c.id}
                className={clsx(
                  'khs-theme-card',
                  `khs-card-0${i + 1}`,
                  i === 0 && 'khs-theme-card--large',
                )}
                style={{
                  ['--khs-accent' as string]: c.accent,
                  ...(photo ? { ['--khs-photo' as string]: `url("${photo.image}")` } : {}),
                  transitionDelay: `${i * 100}ms`,
                }}
              >
                <Link
                  to={curatedExploreUrl(c)}
                  className={clsx('khs-theme-card__link', photo && 'has-photo')}
                >
                  <b className="khs-theme-card__title">{c.i18n[lang].title}</b>
                  <p className="khs-theme-card__desc">{c.i18n[lang].desc}</p>
                  <span className="khs-theme-card__badge">{curatedCourseLabel(c, lang, t)}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════
 * SECTION FESTIVAL — 전폭 축제 스트립 (상태 탭 + 사진 카드 4장)
 * 원본의 우측 홍보영상 슬롯(670×360)은 쉼마루에 해당 자산이 없어 비었으므로
 * 슬롯을 두지 않고 축제가 한 줄 전체를 쓴다.
 * ═══════════════════════════════════════════════════════════════════ */
const FEST_PER_PAGE = 4

function SectionFestival({ festivals, lang }: { festivals: Festival[]; lang: Lang }) {
  const { t } = useTranslation()
  const { ref, shown } = useKhsReveal<HTMLElement>(80)
  const [status, setStatus] = useState<'ongoing' | 'upcoming'>('ongoing')
  const [page, setPage] = useState(0)

  const today = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  }, [])

  // 홈에서는 종료된 축제를 보이지 않는다 — 진행 중 / 예정 두 갈래만.
  const buckets = useMemo(() => {
    const ongoing: Festival[] = []
    const upcoming: Festival[] = []
    for (const f of festivals) {
      if (f.eventEndDate < today) continue
      if (f.eventStartDate > today) upcoming.push(f)
      else ongoing.push(f)
    }
    ongoing.sort((a, b) => a.eventEndDate.localeCompare(b.eventEndDate))
    upcoming.sort((a, b) => a.eventStartDate.localeCompare(b.eventStartDate))
    return { ongoing, upcoming }
  }, [festivals, today])

  // 진행 중이 없으면 예정 탭으로 — 빈 스트립을 먼저 보여주지 않는다.
  const active = buckets[status].length === 0 && buckets.ongoing.length === 0 ? 'upcoming' : status
  const list = buckets[active]
  const pages = Math.max(1, Math.ceil(list.length / FEST_PER_PAGE))
  const safePage = Math.min(page, pages - 1)
  const shownList = list.slice(safePage * FEST_PER_PAGE, safePage * FEST_PER_PAGE + FEST_PER_PAGE)

  function pick(next: 'ongoing' | 'upcoming') {
    setStatus(next)
    setPage(0)
  }

  return (
    <section ref={ref} className={clsx('khs-section-fest khs-inner', shown && 'is-shown')}>
      <div className="khs-fest-top">
        <h2 className="khs-h2 khs-reveal">{t('khs.home.festivalTitle')}</h2>
        <div className="khs-fest-top__right khs-reveal">
          <Link to="/festivals" className="khs-fest-all">
            {t('khs.home.festivalAll', { n: buckets.ongoing.length + buckets.upcoming.length })} →
          </Link>
          {pages > 1 && (
            <div className="khs-swiper-button-container">
              <button
                type="button"
                className="khs-swiper-btn khs-swiper-btn--sm"
                aria-label={t('khs.home.prev')}
                onClick={() => setPage((p) => (p - 1 + pages) % pages)}
              >
                <ChevronLeftIcon width={14} height={14} />
              </button>
              <button
                type="button"
                className="khs-swiper-btn khs-swiper-btn--sm"
                aria-label={t('khs.home.next')}
                onClick={() => setPage((p) => (p + 1) % pages)}
              >
                <ChevronRightIcon width={14} height={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="khs-fest-tabs khs-reveal">
        {(['ongoing', 'upcoming'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => pick(k)}
            className={clsx('khs-fest-tab', active === k && 'khs-fest-tab--active')}
          >
            {t(`festivals.${k}`)}
            <span className="khs-fest-tab__count">{buckets[k].length}</span>
          </button>
        ))}
      </div>

      {shownList.length === 0 ? (
        <p className="khs-fest-empty">{t('khs.empty')}</p>
      ) : (
        <ul
          className="khs-fest-grid"
          style={{ '--fest-cols': Math.min(shownList.length, FEST_PER_PAGE) } as CSSProperties}
        >
          {shownList.map((f, i) => (
            <li key={f.id} className="khs-reveal" style={{ transitionDelay: `${i * 80}ms` }}>
              <Link to={`/festivals/${f.id}`} state={{ festival: f }} className="khs-fest-card">
                <span className="khs-fest-card__thumb">
                  <Thumbnail src={f.thumbnail} alt={f.name} category="festival" />
                  <span className={clsx('khs-fest-pill', active === 'ongoing' && 'khs-fest-pill--on')}>
                    {t(`festivals.${active}`)}
                  </span>
                </span>
                <span className="khs-fest-card__head">
                  <b className="khs-fest-card__name">{f.name}</b>
                  {active === 'upcoming' && (
                    <span className="khs-fest-card__dday">{`D-${dayDiff(today, f.eventStartDate)}`}</span>
                  )}
                </span>
                <span className="khs-fest-card__meta">
                  {[f.sigunguCode ? findSigungu(f.sigunguCode)?.[lang] : undefined, `${mmdd(f.eventStartDate)} ~ ${mmdd(f.eventEndDate)}`]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** YYYYMMDD → MM.DD */
function mmdd(ymd: string) {
  return ymd && ymd.length === 8 ? `${ymd.slice(4, 6)}.${ymd.slice(6, 8)}` : ymd
}

/** 두 YYYYMMDD 사이의 일수(from → to). 음수는 0으로 막는다. */
function dayDiff(from: string, to: string) {
  const d = (y: string) => Date.UTC(+y.slice(0, 4), +y.slice(4, 6) - 1, +y.slice(6, 8))
  return Math.max(0, Math.round((d(to) - d(from)) / 86400000))
}

