import { useEffect, useMemo, useRef, useState } from 'react'
import { SearchIcon } from '../icons'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { CURATED_COURSES } from '@/constants/curatedCourses'
import { SIGUNGUS, findSigungu } from '@/constants/sigungu'
import { CATEGORIES, CATEGORY_MAP, PROFILE_LABELS } from '@/constants/categories'
import { sortedThemes } from '@/constants/themes'
import { searchPlaces } from '@/api/tour'
import { fetchTemples } from '@/api/templestay'
import { curatedExploreUrl } from '@/lib/exploreUrl'
import {
  fetchGyeongbukAwardPhotos,
  attribution,
  pickBySigungu,
  type AwardPhoto,
} from '@/api/photoAward'
import { prefersReducedMotion, useKhsReveal } from './useKhsReveal'
import type {
  CategoryId,
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
const PROFILES: CourseProfile[] = [
  'known_gb',
  'hidden_gb',
  'hanok_emotion',
  'temple_healing',
  'experience_focus',
  'festival_link',
]

/** 취향(코스 프로필) → 탐색 카테고리. '테마별' 탭이 검색조건을 물고 탐색으로 갈 때 사용. */
const PROFILE_CATEGORY: Record<CourseProfile, CategoryId> = {
  known_gb: 'attraction',
  hidden_gb: 'trail',
  hanok_emotion: 'hanok',
  temple_healing: 'templestay',
  experience_focus: 'experience',
  festival_link: 'festival',
}

export default function KhsDesktopHome({
  lang,
  festivals,
  quietName,
  generating,
  onGenerate,
  onSearch,
}: {
  lang: Lang
  festivals: Festival[]
  quietName: string
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

  /* ── 원본 `.card-list` 의 매체유형 카드 5장 — 각 카드가 자기 수치를 갖는다 ── */
  const mediaCards = useMemo(
    () => [
      { key: t('khs.home.mediaCourse'), desc: t('khs.home.mediaCourseDesc'), value: CURATED_COURSES.length },
      { key: t('khs.home.mediaPlace'), desc: t('khs.home.mediaPlaceDesc'), value: placeCount },
      { key: t('khs.home.mediaFestival'), desc: t('khs.home.mediaFestivalDesc'), value: festivals.length },
      { key: t('khs.home.mediaTemplestay'), desc: t('khs.home.mediaTemplestayDesc'), value: templeCount },
      { key: t('khs.home.mediaSigungu'), desc: t('khs.home.mediaSigunguDesc'), value: SIGUNGUS.length },
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
          quietName={quietName}
          generating={generating}
          onGenerate={onGenerate}
        />
        <SectionTheme lang={lang} photos={photos} />
        <SectionNotice festivals={festivals} />
        <HeritageChannel />
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

  /* 원본 `.visual-list-item` 탭 자리 — 쉼마루는 9개(플레이스홀더 없이).
     지역별·테마별은 검색바에서 고른 지역·취향을 그대로 조건으로 넘긴다.
     기간별은 현재 시즌 테마(단풍·벚꽃…)로, 나머지는 카테고리 고정. */
  const themeTab = profile
    ? `/explore?cat=${PROFILE_CATEGORY[profile as CourseProfile]}${sigungu ? `&sigungu=${sigungu}` : ''}`
    : '/themes'
  const tabs: { label: string; to?: string }[] = [
    { label: t('khs.home.tabRegion'), to: sigungu ? `/explore?sigungu=${sigungu}` : '/explore' },
    { label: t('khs.home.tabTheme'), to: themeTab },
    { label: t('khs.home.tabPeriod'), to: `/explore?theme=${sortedThemes()[0].id}` },
    { label: t('khs.home.tabHanok'), to: '/explore?cat=hanok' },
    { label: t('khs.home.tabSeowon'), to: '/explore?cat=seowon' },
    { label: t('khs.home.tabTemplestay'), to: '/explore?cat=templestay' },
    { label: t('khs.home.tabExperience'), to: '/explore?cat=experience' },
    { label: t('khs.home.tabFestival'), to: '/festivals' },
    { label: t('khs.home.tabInsights'), to: '/insights' },
  ]

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
                {/* 공공누리 1유형 — 출처 표시 의무 */}
                {photo && <p className="khs-photo-credit">{attribution(photo)}</p>}
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
              ‹
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
              ›
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

        {/* ── 해시태그 + 탭 10 (원본 .visual-list) ── */}
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

          <ul className="khs-visual-tabs">
            {tabs.map((tab, i) =>
              tab.to ? (
                <li key={`${tab.label}-${i}`}>
                  <Link to={tab.to} className="khs-visual-tab">
                    {tab.label}
                  </Link>
                </li>
              ) : (
                <li key={`${tab.label}-${i}`}>
                  <span className="khs-visual-tab khs-empty">{tab.label}</span>
                </li>
              ),
            )}
          </ul>
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
  quietName,
  generating,
  onGenerate,
}: {
  lang: Lang
  stats: { label: string; value: number }[]
  mediaCards: { key: string; desc: string; value: number }[]
  quietName: string
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
                  <b className="khs-card-li__key">{c.key}</b>
                  <p className="khs-card-li__desc">{c.desc}</p>
                  <CountUp value={c.value} run={shown} delay={i * 80} />
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
                    <span className="khs-popular__tag">{c.badge ?? t('khs.empty')}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="khs-popular__note">
            {quietName ? t('khs.home.quietNote', { name: quietName }) : t('khs.empty')}
          </p>
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
                  <span className="khs-theme-card__badge">{c.badge ?? t('khs.empty')}</span>
                  {photo && <span className="khs-photo-credit">{attribution(photo)}</span>}
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
 * SECTION NOTICE — 공지 리스트(670) + 홍보영상(670)
 * ═══════════════════════════════════════════════════════════════════ */
function SectionNotice({ festivals }: { festivals: Festival[] }) {
  const { t } = useTranslation()
  const { ref, shown } = useKhsReveal<HTMLElement>(80)
  // 원본 공지 5행. 축제가 모자라면 플레이스홀더 행으로 채워 높이를 유지한다.
  const rows = [...festivals.slice(0, 5)]
  const filler = Math.max(0, 5 - rows.length)

  return (
    <section ref={ref} className={clsx('khs-section-notice khs-inner', shown && 'is-shown')}>
      <div className="khs-notice-list">
        <h2 className="khs-h2 khs-reveal">{t('khs.home.noticeTitle')}</h2>
        <ul>
          {rows.map((f, i) => (
            <li key={f.id} className="khs-reveal" style={{ transitionDelay: `${i * 80}ms` }}>
              <Link to={`/festivals/${f.id}`} state={{ festival: f }} className="khs-notice-row">
                <span className="khs-notice-row__title">{f.name}</span>
                <span className="khs-notice-row__date">{f.eventStartDate}</span>
              </Link>
            </li>
          ))}
          {Array.from({ length: filler }, (_, i) => (
            <li
              key={`empty-${i}`}
              className="khs-reveal"
              style={{ transitionDelay: `${(rows.length + i) * 80}ms` }}
            >
              <span className="khs-notice-row khs-empty">
                <span className="khs-notice-row__title">{t('khs.empty')}</span>
                <span className="khs-notice-row__date">—</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="khs-advertisement">
        <div className="khs-swiper-top">
          <h2 className="khs-h2 khs-reveal">{t('khs.home.videoTitle')}</h2>
          <div className="khs-swiper-button-container khs-reveal">
            <button
              type="button"
              className="khs-swiper-btn khs-swiper-btn--sm"
              aria-label={t('khs.home.prev')}
            >
              ‹
            </button>
            <button
              type="button"
              className="khs-swiper-btn khs-swiper-btn--sm"
              aria-label={t('khs.home.next')}
            >
              ›
            </button>
          </div>
        </div>
        {/* 쉼마루에는 홍보 영상 자산이 없다 — 원본 슬롯(670×360) 치수만 유지. */}
        <div className="khs-ad-slide khs-reveal khs-empty">
          <span>{t('khs.empty')}</span>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════
 * HERITAGE CHANNEL — 배너 밴드(1400×233) + 겹치는 영상 카드(726×298)
 * ═══════════════════════════════════════════════════════════════════ */
function HeritageChannel() {
  const { t } = useTranslation()
  const { ref, shown } = useKhsReveal<HTMLElement>(80)
  return (
    <section ref={ref} className={clsx('khs-heritage-channel khs-inner', shown && 'is-shown')}>
      <div className="khs-bg-bar">
        <h2 className="khs-bg-bar__title khs-reveal">{t('khs.home.channelTitle')}</h2>
        <p className="khs-bg-bar__desc khs-reveal">{t('khs.home.channelDesc')}</p>
        <Link to="/insights" className="khs-channel-btn khs-reveal">
          {t('khs.home.channelCta')}
        </Link>
      </div>
      <div className="khs-youtube-channel khs-reveal khs-empty">
        <span>{t('khs.empty')}</span>
      </div>
    </section>
  )
}
