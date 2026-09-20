import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import TopBar from '@/components/TopBar'
import KhsPageHeader from '@/components/khs/KhsPageHeader'
import { useSettings } from '@/stores/settings'
import { CURATED_COURSES } from '@/constants/curatedCourses'
import { SIGUNGUS } from '@/constants/sigungu'
import {
  fetchGyeongbukAwardPhotos,
  attribution,
  pickBySigungu,
  type AwardPhoto,
} from '@/api/photoAward'

/**
 * 테마 콘텐츠 — digital.khs.go.kr/recommend/themeCollection.do 레이아웃 클론.
 *
 * 원본 계측 (1440 뷰포트):
 *   nav.breadcrumb                 1400×77   @133   padding 32 0 0
 *   section.asset-visual #1        1400×644  @210   padding 48 0 92
 *     .visual-title 1400×80 (h2 28/700 + p 18/#464C53, gap 12)
 *     .img-wrap 1400×396 flex gap 28 → .img-item.one 1092 + .img-item.two 280 (radius 8)
 *   section.asset-visual #2        1400×725  @854   padding 0 0 92
 *     .visual-title 80
 *     .img-wrap 525 → .col-item flex gap 28
 *        ul.row-list 684 (2 × 328×525, gap 28)   ul.col-list 688 (2 × 688×249, gap 28)
 *   section.asset-content          1400×705  @1579  padding 92 0 100
 *     .market-title 80 (h3 28/700 + p 18)
 *     ul.market-list.flex-four 1400×405 flex gap 28 → 4 × 329×405
 *   카드: a(radius 8) = .bg-img(bg #1E2124, padding 32 24) + .btn-link(50, bg #3D8B81)
 *        h4 20/600 흰색 · p 18 흰색 · 버튼 span 16 흰색
 *
 * 사진 자산이 없는 자리는 원본 치수를 유지한 채 톤 그라데이션으로 대체한다.
 * 데스크톱(≥1024px)에서 KHS 레이아웃, 모바일에서는 단순 목록으로 폴백한다.
 * '바로가기' 바는 모든 카드에서 카드 전폭(50px) 으로 통일한다.
 */

/** 원본 sec2 의 4개 대표 콘텐츠 자리 — 쉼마루 큐레이션 코스로 채운다. */
const SPOTLIGHT = CURATED_COURSES.slice(0, 4)

/** 원본 sec3 의 테마 유형별 카테고리 4장 — 각 테마는 그 취향(프로필)으로 곧바로 코스를 만든다. 문안은 khs.themes.<key>Title/Desc. */
const THEME_CARDS = [
  { key: 'hanok', to: '/?gen=hanok_emotion&sigungu=11' },
  { key: 'seowon', to: '/?gen=hanok_emotion&sigungu=14,11' },
  { key: 'templestay', to: '/?gen=temple_healing&sigungu=2,14' },
  { key: 'festival', to: '/?gen=festival_link' },
] as const

/** 큐레이션 코스 카드 → 홈에서 그 코스를 즉시 생성 */
const curatedGenUrl = (id: string) => `/?curated=${encodeURIComponent(id)}`

/** 사진이 있을 때만 has-photo 를 붙인다 (clsx 를 새로 끌어오지 않기 위한 헬퍼). */
function clsxPhoto(base: string, photo?: AwardPhoto): string {
  return photo ? `${base} has-photo` : base
}

export default function Themes() {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)

  // 관광공모전 수상작(경북) — 실패 시 빈 배열이라 그라데이션 폴백이 유지된다.
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

  /* 사진 배정 — 한 장이 두 곳에 쓰이지 않도록 used 로 소진시킨다.
     순서: sec1 밴드 2장 → 대표 코스 4장(거점 시군 매칭) → 카테고리 4장. */
  const assigned = useMemo(() => {
    const used = new Set<string>()
    const take = (p?: AwardPhoto) => {
      if (p) used.add(p.id)
      return p
    }
    const spare = () => take(photos.find((p) => !used.has(p.id)))
    const byTitle = (kw: string) => take(photos.find((p) => p.title.includes(kw) && !used.has(p.id)))

    const band = [byTitle('대릉원') ?? byTitle('첨성대') ?? spare(), byTitle('산사') ?? spare()]
    const course = SPOTLIGHT.map((c) => {
      const names = c.sigunguCodes
        .map((code) => SIGUNGUS.find((s) => s.code === code)?.ko)
        .filter(Boolean) as string[]
      const hit = names.map((n) => pickBySigungu(photos, n, used)).find(Boolean)
      return take(hit) ?? spare()
    })
    const cards = THEME_CARDS.map(() => spare())
    return { band, course, cards }
  }, [photos])

  const title = t('khs.themes.title')

  return (
    <div className="page khs-page khs-themes">
      <TopBar title={title} />

      <KhsPageHeader title={title} trail={[{ label: title }]} />

      {/* ═══ sec1 — 인트로 + 2분할 이미지 밴드 (1092 + 280) ═══ */}
      <section className="khs-asset-visual khs-asset-visual--first">
        <div className="khs-inner">
          <div className="khs-visual-title">
            <h2>{t('khs.themes.introTitle')}</h2>
            <p>{t('khs.themes.introBody')}</p>
          </div>

          <div className="khs-img-wrap">
            {(['one', 'two'] as const).map((variant, i) => {
              const photo = assigned.band[i]
              return (
                <div
                  key={variant}
                  className={clsxPhoto(`khs-img-item khs-img-item--${variant}`, photo)}
                  style={photo ? { ['--khs-photo' as string]: `url("${photo.image}")` } : undefined}
                >
                  <span className="khs-img-item__label">
                    {photo ? photo.title : i === 0 ? t('khs.themes.bandOne') : t('khs.themes.bandTwo')}
                  </span>
                  {photo && <span className="khs-photo-credit">{attribution(photo)}</span>}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══ sec2 — 대표 코스 4장 (row-list 2 + col-list 2) — 거점·테마 조건을 물고 탐색으로 ═══ */}
      <section className="khs-asset-visual">
        <div className="khs-inner">
          <div className="khs-visual-title">
            <h2>{t('khs.themes.courseTitle')}</h2>
            <p>{t('khs.themes.courseBody')}</p>
          </div>

          <div className="khs-img-wrap">
            <div className="khs-col-item">
              {/* 좌: 세로 큰 카드 2장 (328×525) */}
              <ul className="khs-row-list">
                {SPOTLIGHT.slice(0, 2).map((c, i) => {
                  const photo = assigned.course[i]
                  return (
                    <li key={c.id} className="khs-market-item">
                      <Link
                        to={curatedGenUrl(c.id)}
                        className="khs-theme-link"
                        style={{
                          ['--khs-accent' as string]: c.accent,
                          ...(photo ? { ['--khs-photo' as string]: `url("${photo.image}")` } : {}),
                        }}
                      >
                        <div className={clsxPhoto('khs-bg-img', photo)}>
                          <p className="khs-bg-img__title">{c.i18n[lang].title}</p>
                          <p className="khs-bg-img__desc">{c.i18n[lang].desc}</p>
                          {photo && <span className="khs-photo-credit">{attribution(photo)}</span>}
                        </div>
                        <div className="khs-btn-link">
                          <span>{t('khs.themes.makeCourse')}</span>
                          <i aria-hidden>→</i>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>

              {/* 우: 가로 카드 2장 (688×249) — 버튼 구조는 세로 카드와 동일(전폭 바) */}
              <ul className="khs-col-list">
                {SPOTLIGHT.slice(2, 4).map((c, i) => {
                  const photo = assigned.course[i + 2]
                  return (
                    <li key={c.id} className="khs-market-item">
                      <Link
                        to={curatedGenUrl(c.id)}
                        className="khs-theme-link khs-theme-link--wide"
                        style={{
                          ['--khs-accent' as string]: c.accent,
                          ...(photo ? { ['--khs-photo' as string]: `url("${photo.image}")` } : {}),
                        }}
                      >
                        <div className={clsxPhoto('khs-bg-img', photo)}>
                          <p className="khs-bg-img__title">{c.i18n[lang].title}</p>
                          <p className="khs-bg-img__desc">{c.i18n[lang].desc}</p>
                          {photo && <span className="khs-photo-credit">{attribution(photo)}</span>}
                        </div>
                        <div className="khs-btn-link">
                          <span>{t('khs.themes.makeCourse')}</span>
                          <i aria-hidden>→</i>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ sec3 — 테마 유형별 카테고리 4장 (329×405) ═══ */}
      <section className="khs-asset-content">
        <div className="khs-inner">
          <div className="khs-market-title">
            <h3>{t('khs.themes.catTitle')}</h3>
            <p>{t('khs.themes.catBody')}</p>
          </div>

          <ul className="khs-market-list">
            {THEME_CARDS.map((c, i) => {
              const photo = assigned.cards[i]
              return (
                <li key={c.key} className="khs-market-item">
                  <Link
                    to={c.to}
                    className="khs-theme-link"
                    style={photo ? { ['--khs-photo' as string]: `url("${photo.image}")` } : undefined}
                  >
                    <div className={clsxPhoto('khs-bg-img', photo)}>
                      <h4 className="khs-bg-img__title">{t(`khs.themes.${c.key}Title`)}</h4>
                      <p className="khs-bg-img__desc">{t(`khs.themes.${c.key}Desc`)}</p>
                      {photo && <span className="khs-photo-credit">{attribution(photo)}</span>}
                    </div>
                    <div className="khs-btn-link">
                      <span>{t('khs.themes.makeCourse')}</span>
                      <i aria-hidden>→</i>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {/* 모바일 폴백 — 데스크톱 레이아웃이 꺼진 폭에서 최소한의 진입 경로 제공 */}
      <div className="khs-themes__mobile">
        <ul>
          {THEME_CARDS.map((c) => (
            <li key={c.key}>
              <Link to={c.to} className="card-hover khs-themes__mobile-card">
                <b>{t(`khs.themes.${c.key}Title`)}</b>
                <span>{t(`khs.themes.${c.key}Desc`)}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link to="/explore" className="btn-text">
          {t('khs.themes.more')}
        </Link>
      </div>
    </div>
  )
}
