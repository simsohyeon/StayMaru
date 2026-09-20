import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import clsx from 'clsx'
import RelatedSpots from '@/components/RelatedSpots'
import type { RegionVisit } from '@/api/bigdata'
import { searchFestivals, countPlaces } from '@/api/tour'
import { fetchTemples } from '@/api/templestay'
import { fetchRainChance } from '@/api/weather'
import { SIGUNGUS, findSigungu } from '@/constants/sigungu'
import { CATEGORY_MAP } from '@/constants/categories'
import { CURATED_COURSES } from '@/constants/curatedCourses'
import { josa } from '@/lib/josa'
import {
  upcomingWeekend,
  overlapsWeekend,
  busyLevel,
  pickQuietRegions,
  busiestRegions,
  quietRankOf,
  alternativesFor,
  pickBestCategory,
  tasteRanking,
  courseUrl,
  TASTE_PROFILE,
  ULLEUNG_CODE,
} from '@/lib/nowGyeongbuk'
import type { CategoryId, Festival, Lang } from '@/types/domain'

/**
 * "지금 경북" — 인사이트 화면 상단의 판단 블록 3개.
 *   Q1 이번 주말 어디 가면 안 붐빌까 · Q2 가려던 곳이 붐비면 대신 어디로 · Q3 내 취향이면 어디가 맞을까
 * 방문자 통계(부모가 전달) + 축제 기간 + 강수확률 + 카테고리별 장소 수를 lib/nowGyeongbuk 의 순수 함수로 합친다.
 * 새 API 없음 — 모두 다른 화면이 이미 쓰는 호출(24h 캐시).
 */

type TasteKey = keyof typeof TASTE_PROFILE
const TASTES: TasteKey[] = ['hanok', 'seowon', 'templestay', 'festival']
/** Q2 "결"을 정할 때 보는 카테고리 — 템플스테이는 경북 전체 20곳으로 얇아 제외. */
const CHARACTER_CATS: CategoryId[] = ['hanok', 'seowon', 'temple']
const INTL_TAG: Record<Lang, string> = { ko: 'ko', en: 'en', ja: 'ja', zh: 'zh-CN' }

/**
 * 동시 호출 제한 실행기 — 시·군 22곳 × 카테고리 건수 조회를 한 번에 쏘면 TourAPI 프록시가 500 을 돌려준다.
 * 5개씩 순차로 흘리고, undefined(실패)는 한 번 더 시도한다.
 */
async function runPool<T, R>(items: T[], worker: (x: T) => Promise<R>, size = 5): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  const lane = async () => {
    while (i < items.length) {
      const idx = i++
      out[idx] = await worker(items[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, lane))
  return out
}
async function countWithRetry(p: { lang: Lang; sigunguCode: number; category: CategoryId }): Promise<number | undefined> {
  const n = await countPlaces(p)
  if (n !== undefined) return n
  await new Promise((r) => setTimeout(r, 400))
  return countPlaces(p)
}

interface Props {
  visits: RegionVisit[]
  dataMode: 'live' | 'proxy'
  baseYm?: string
  lang: Lang
  /** 지표 포맷 — 라이브: 주간 방문 n · 폴백: 인구밀도 */
  fmtMetric: (v: number) => string
  compact: Intl.NumberFormat
}

export default function NowGyeongbuk({ visits, dataMode, baseYm, lang, fmtMetric, compact }: Props) {
  const { t } = useTranslation()
  const weekend = useMemo(() => upcomingWeekend(), [])
  const name = (code: number) => findSigungu(code)?.[lang] ?? String(code)
  const catLabel = (c: CategoryId) => CATEGORY_MAP[c].label[lang]

  // ── 축제(주말 겹침) ──
  const [festivals, setFestivals] = useState<Festival[]>([])
  useEffect(() => {
    let cancelled = false
    searchFestivals(lang)
      .then((xs) => {
        if (!cancelled) setFestivals(xs)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [lang])
  const weekendFestivals = useMemo(
    () => festivals.filter((f) => overlapsWeekend(f, weekend)),
    [festivals, weekend],
  )
  const festivalRegions = useMemo(
    () => new Set(weekendFestivals.map((f) => f.sigunguCode).filter((c): c is number => !!c)),
    [weekendFestivals],
  )

  // ── 강수확률 — 한적 후보 상위 6곳 + Q2 대상만 (22곳 전부 부르지 않는다) ──
  const [rainByRegion, setRainByRegion] = useState<Map<number, number>>(new Map())
  const rainTargets = useMemo(() => {
    const asc = [...visits].sort((a, b) => a.visitors - b.visitors)
    return asc
      .filter((v) => v.sigunguCode !== ULLEUNG_CODE && !festivalRegions.has(v.sigunguCode))
      .slice(0, 6)
      .map((v) => v.sigunguCode)
  }, [visits, festivalRegions])
  useEffect(() => {
    let cancelled = false
    const missing = rainTargets.filter((c) => !rainByRegion.has(c))
    if (missing.length === 0) return
    void Promise.all(missing.map((c) => fetchRainChance(c, weekend.sat).then((w) => [c, w.rainChance] as const))).then(
      (pairs) => {
        if (cancelled) return
        setRainByRegion((cur) => {
          const next = new Map(cur)
          for (const [c, r] of pairs) next.set(c, Math.round(r * 100))
          return next
        })
      },
    )
    return () => {
      cancelled = true
    }
    // rainByRegion 은 이 effect 가 채우는 값 — deps 에 넣으면 자기 자신을 다시 부른다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rainTargets, weekend.sat])

  // ── 카테고리별 시·군 장소 수 (탭·대안 공용, 카테고리 단위 캐시) ──
  const [counts, setCounts] = useState<Partial<Record<CategoryId, Map<number, number>>>>({})
  const loadCounts = (cat: CategoryId) => {
    if (counts[cat]) return
    const done = (m: Map<number, number>) => setCounts((cur) => (cur[cat] ? cur : { ...cur, [cat]: m }))
    if (cat === 'templestay') {
      void fetchTemples(undefined, lang).then((xs) => {
        const m = new Map<number, number>()
        for (const x of xs) if (x.sigunguCode) m.set(x.sigunguCode, (m.get(x.sigunguCode) ?? 0) + 1)
        done(m)
      })
      return
    }
    if (cat === 'festival') {
      const m = new Map<number, number>()
      for (const f of weekendFestivals) if (f.sigunguCode) m.set(f.sigunguCode, (m.get(f.sigunguCode) ?? 0) + 1)
      done(m)
      return
    }
    void runPool(SIGUNGUS, (sg) =>
      countWithRetry({ lang, sigunguCode: sg.code, category: cat }).then((n) => [sg.code, n] as const),
    ).then((pairs) => done(new Map(pairs.filter((p): p is readonly [number, number] => p[1] !== undefined))))
  }

  // ── Q1 ──
  const quietPicks = useMemo(
    () => pickQuietRegions({ visits, festivalRegions, rainByRegion }),
    [visits, festivalRegions, rainByRegion],
  )
  const busiest = useMemo(() => busiestRegions(visits, 2), [visits])
  const maxV = busiest[0]?.visitors ?? 0
  const festNames = useMemo(
    () => [...festivalRegions].filter((c) => !busiest.some((b) => b.sigunguCode === c)).slice(0, 3).map(name),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [festivalRegions, busiest, lang],
  )
  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(INTL_TAG[lang], { month: 'short', day: 'numeric', weekday: 'short' }),
    [lang],
  )
  const joinNames = (codes: number[], sep: string) => codes.map(name).join(sep)
  const ko = lang === 'ko'
  const quietStr = joinNames(quietPicks.map((v) => v.sigunguCode), ' · ')
  const busyStr = joinNames(busiest.map((v) => v.sigunguCode), '·')
  const festStr = festNames.join('·')
  const answerValues = {
    quiet: quietStr,
    quietJ: ko && quietPicks.length ? josa(name(quietPicks.at(-1)!.sigunguCode), '이', '가') : '',
    busy: busyStr,
    busyJ: ko && busiest.length ? josa(name(busiest.at(-1)!.sigunguCode), '은', '는') : '',
    fest: festStr,
    festJ: ko && festNames.length ? josa(festNames.at(-1)!, '은', '는') : '',
  }

  // ── Q2 ──
  const chips = useMemo(() => busiestRegions(visits, 5), [visits])
  const [target, setTarget] = useState<number | null>(null)
  const targetCode = target ?? (chips.some((c) => c.sigunguCode === 2) ? 2 : chips[0]?.sigunguCode ?? null)
  const targetVisit = visits.find((v) => v.sigunguCode === targetCode)
  const [targetCounts, setTargetCounts] = useState<Record<number, Partial<Record<CategoryId, number>>>>({})
  useEffect(() => {
    if (targetCode === null || targetCounts[targetCode]) return
    let cancelled = false
    void runPool(CHARACTER_CATS, (c) =>
      countWithRetry({ lang, sigunguCode: targetCode, category: c }).then((n) => [c, n] as const),
    ).then((pairs) => {
      if (cancelled) return
      const defined = pairs.filter((p): p is readonly [CategoryId, number] => p[1] !== undefined)
      // 셋 다 실패면 다음 렌더에서 다시 시도할 수 있게 비워 둔다
      if (defined.length === 0) return
      setTargetCounts((cur) => ({ ...cur, [targetCode]: Object.fromEntries(defined) }))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetCode, lang])
  const bestCat = targetCode !== null ? pickBestCategory(targetCounts[targetCode] ?? {}) : undefined
  useEffect(() => {
    if (bestCat) loadCounts(bestCat)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bestCat])
  const alternatives = useMemo(
    () => (targetCode !== null && bestCat && counts[bestCat] ? alternativesFor(targetCode, visits, counts[bestCat]!) : []),
    [targetCode, bestCat, counts, visits],
  )
  const targetFestivals = weekendFestivals.filter((f) => f.sigunguCode === targetCode)
  const targetLevel = targetVisit ? busyLevel(targetVisit.visitors, maxV) : 1
  const targetCurated = targetCode !== null ? CURATED_COURSES.find((c) => c.sigunguCodes.includes(targetCode)) : undefined

  // ── Q3 ──
  const [tab, setTab] = useState<TasteKey>('hanok')
  useEffect(() => {
    loadCounts(tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, weekendFestivals.length])
  const rows = useMemo(
    () => (counts[tab] ? tasteRanking(counts[tab]!, visits, { minPlaces: tab === 'templestay' || tab === 'festival' ? 1 : 5 }).slice(0, 8) : []),
    [counts, tab, visits],
  )
  const maxCount = rows.reduce((m, r) => Math.max(m, r.count), 0)
  const levelWord = (lv: number) => t(`insights.now.busy${lv}`)
  const quietClass = (lv: number) => (lv <= 2 ? '' : lv === 3 ? 'is-mid' : 'is-hi')
  const quietWordKey = (lv: number) => (lv <= 2 ? 'quietWord' : lv === 3 ? 'midWord' : 'busyWord')

  if (visits.length === 0) return <p className="now__empty">{t('insights.now.loading')}</p>

  const ymLabel = baseYm ? `${baseYm.slice(0, 4)}.${baseYm.slice(4)}` : ''

  return (
    <>
      {/* ── Q1 ── */}
      <section className="now" aria-labelledby="now-q1">
        <div className="now__head">
          <h2 className="now__title" id="now-q1">
            {t('insights.now.q1Title')}
            <small>
              {t(dataMode === 'live' ? 'insights.now.q1Basis' : 'insights.now.q1BasisProxy', {
                sat: dateFmt.format(weekend.sat),
                sun: dateFmt.format(weekend.sun),
                ym: ymLabel,
              })}
            </small>
          </h2>
        </div>
        {quietPicks.length > 0 && busiest.length > 0 && (
          <p className="now__answer">
            {/* 문장마다 한 줄 — 중간에서 끊기지 않게 각각 블록으로 둔다 */}
            <span>
              <Trans i18nKey="insights.now.answerQuiet" values={answerValues} components={{ 1: <b /> }} />
            </span>
            <span>
              <Trans
                i18nKey={festNames.length ? 'insights.now.answerBusy' : 'insights.now.answerBusyNoFest'}
                values={answerValues}
                components={{ 2: <span className="now__busy" /> }}
              />
            </span>
          </p>
        )}
        <div className="now__cards">
          {quietPicks.map((v) => {
            const rank = quietRankOf(visits, v.sigunguCode) ?? 0
            const rain = rainByRegion.get(v.sigunguCode)
            const nFest = weekendFestivals.filter((f) => f.sigunguCode === v.sigunguCode).length
            return (
              <article key={v.sigunguCode} className="now-card">
                <div className="now-card__top">
                  <span className="now-card__name">{name(v.sigunguCode)}</span>
                  <span className="now-card__rank">
                    {rank === 1 ? t('insights.now.rankTop') : t('insights.now.rankNth', { n: rank })}
                  </span>
                </div>
                <div className="now-meter" aria-hidden>
                  <i style={{ width: `${Math.max(3, (v.visitors / (maxV || 1)) * 100)}%` }} />
                </div>
                <div className="now-meter__cap">
                  <span>{fmtMetric(v.visitors)}</span>
                  {dataMode === 'live' && v.visitors > 0 && (
                    <span>{t('insights.now.ofMax', { name: name(busiest[0].sigunguCode), n: Math.round(maxV / v.visitors) })}</span>
                  )}
                </div>
                <ul className="now-card__facts">
                  <li>
                    <b>{t('insights.now.weather')}</b>
                    {rain === undefined ? '—' : t('insights.now.rain', { n: rain })}
                  </li>
                  <li>
                    <b>{t('insights.now.festivalOverlap')}</b>
                    {nFest === 0 ? t('insights.now.none') : t('insights.now.festivalCount', { n: nFest })}
                  </li>
                </ul>
                <Link to={courseUrl('hidden_gb', [v.sigunguCode])} className="now-cta">
                  <span>{t('insights.now.makeCourse', { name: name(v.sigunguCode) })}</span>
                  <span aria-hidden>→</span>
                </Link>
              </article>
            )
          })}
        </div>
      </section>

      {/* ── Q2 ── */}
      {targetCode !== null && targetVisit && (
        <section className="now" aria-labelledby="now-q2">
          <div className="now__head">
            <h2 className="now__title" id="now-q2">
              {t('insights.now.q2Title')}
              <small>{t('insights.now.q2Sub')}</small>
            </h2>
          </div>
          <div className="now__chips" role="group" aria-label={t('insights.now.q2Title')}>
            {chips.map((c) => (
              <button
                key={c.sigunguCode}
                type="button"
                className="now-chip"
                aria-pressed={c.sigunguCode === targetCode}
                onClick={() => setTarget(c.sigunguCode)}
              >
                {name(c.sigunguCode)} <span className="now-chip__n">{compact.format(c.visitors)}</span>
              </button>
            ))}
          </div>
          <div className="now__grid2">
            <div className="now-panel">
              <h3 className="now-panel__title">{t('insights.now.thisWeekend', { name: name(targetCode) })}</h3>
              <div className="now-lvl">
                <span className={clsx('now-lvl__word', targetLevel <= 2 && 'now-lvl__word--calm')}>{levelWord(targetLevel)}</span>
                <span className="now-lvl__sub">
                  {t('insights.now.busySub', {
                    n: compact.format(targetVisit.visitors),
                    rank: visits.length - (quietRankOf(visits, targetCode) ?? visits.length) + 1,
                  })}
                </span>
              </div>
              <div className={clsx('now-segs', targetLevel <= 2 && 'now-segs--calm')} aria-hidden>
                {[1, 2, 3, 4, 5].map((i) => (
                  <i key={i} className={i <= targetLevel ? 'is-on' : undefined} />
                ))}
              </div>
              <div className="now-badges">
                {targetFestivals.length === 0 ? (
                  <span className="now-bd now-bd--ok">{t('insights.now.noFest')}</span>
                ) : (
                  <span className="now-bd now-bd--fest">{t('insights.now.hasFest', { n: targetFestivals.length })}</span>
                )}
                {bestCat && targetCounts[targetCode]?.[bestCat] ? (
                  <span className="now-bd">
                    {t('insights.now.strong', { cat: catLabel(bestCat), n: targetCounts[targetCode]![bestCat] })}
                  </span>
                ) : null}
              </div>
              <div className="now__related">
                <RelatedSpots key={targetCode} sigunguCode={targetCode} limit={6} />
              </div>
              <Link
                to={targetCurated ? `/?curated=${targetCurated.id}` : courseUrl('known_gb', [targetCode])}
                className="now-cta now-cta--ink"
              >
                <span>{t('insights.now.stillGo', { name: name(targetCode) })}</span>
                <span aria-hidden>→</span>
              </Link>
            </div>
            <div className="now-panel">
              <h3 className="now-panel__title">
                {t('insights.now.altTitle', { cat: bestCat ? catLabel(bestCat) : '…' })}
              </h3>
              {alternatives.length > 0 ? (
                <div className="now-alt">
                  {alternatives.map((a) => (
                    <Link
                      key={a.sigunguCode}
                      to={courseUrl(bestCat === 'hanok' ? 'hanok_emotion' : bestCat === 'temple' ? 'temple_healing' : 'known_gb', [a.sigunguCode])}
                      className="now-alt__card"
                    >
                      <span className="now-alt__name">{name(a.sigunguCode)}</span>
                      <span className="now-alt__cmp">
                        <Trans
                          i18nKey="insights.now.altCmp"
                          values={{ name: name(targetCode), n: Math.max(2, Math.round(1 / Math.max(a.ratio, 1e-6))), cat: bestCat ? catLabel(bestCat) : '', count: a.count }}
                          components={{ 1: <b /> }}
                        />
                      </span>
                      <span className="now-alt__go">{t('insights.now.altGo', { name: name(a.sigunguCode) })}</span>
                    </Link>
                  ))}
                </div>
              ) : bestCat && counts[bestCat] ? (
                <p className="now__empty">{t('insights.now.altNone', { name: name(targetCode), cat: catLabel(bestCat) })}</p>
              ) : (
                <p className="now__empty">{t('insights.now.loading')}</p>
              )}
              <p className="now-panel__note now-panel__note--muted">{t('insights.now.altRule', { name: name(targetCode) })}</p>
            </div>
          </div>
        </section>
      )}

      {/* ── Q3 ── */}
      <section className="now" aria-labelledby="now-q3">
        <div className="now__head">
          <h2 className="now__title" id="now-q3">
            {t('insights.now.q3Title')}
            <small>{t('insights.now.q3Sub')}</small>
          </h2>
        </div>
        <div className="now__tabs" role="tablist">
          {TASTES.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              className="now-tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
            >
              {catLabel(k)}
            </button>
          ))}
        </div>
        {rows.length > 0 ? (
          <div className="now-rows">
            <div className="now-rows__head" aria-hidden>
              <span />
              <span>{t('insights.now.colRegion')}</span>
              <span>{t('insights.now.colCount', { cat: catLabel(tab) })}</span>
              <span>{t('insights.now.colBusy')}</span>
              <span />
            </div>
            {rows.map((r, i) => {
              const lv = busyLevel(r.visitors, maxV)
              return (
                <Link
                  key={r.sigunguCode}
                  to={courseUrl(TASTE_PROFILE[tab], [r.sigunguCode])}
                  className={clsx('now-row', r.sparse && 'now-row--sparse')}
                >
                  <span className="now-row__rk">{i + 1}</span>
                  <span className="now-row__nm">{name(r.sigunguCode)}</span>
                  {/* 막대와 개수는 한 줄로 — 개수를 막대 위에 띄우면 좁은 화면에서 행 테두리에 붙는다. */}
                  <span className="now-row__count" aria-hidden>
                    <span className="now-row__bar">
                      <i style={{ width: `${Math.max(4, (r.count / (maxCount || 1)) * 100)}%` }} />
                    </span>
                    <span className="now-row__n">{t('insights.now.countUnit', { n: r.count })}</span>
                  </span>
                  <span className="now-row__quiet">
                    <i className={quietClass(lv) || undefined} />
                    {t(`insights.now.${quietWordKey(lv)}`, { n: compact.format(r.visitors) })}
                  </span>
                  <span className="now-row__go">{t('insights.now.rowGo')}</span>
                </Link>
              )
            })}
          </div>
        ) : (
          <p className="now__empty">{t('insights.now.q3Empty')}</p>
        )}
        <p className="now-panel__note now-panel__note--muted">{t('insights.now.sparseNote')}</p>
      </section>
    </>
  )
}
