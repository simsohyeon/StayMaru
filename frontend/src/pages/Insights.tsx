import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import TopBar from '@/components/TopBar'
import RelatedSpots from '@/components/RelatedSpots'
import GyeongbukSvg from '@/components/IllustratedMap/GyeongbukSvg'
import { MAINLAND_VIEWBOX, SIGUNGU_GEO } from '@/components/IllustratedMap/sigunguGeo'
import { projectMainland } from '@/components/IllustratedMap/mapProjection'
import { fetchGyeongbukVisitors, type BigDataStatus, type RegionVisit } from '@/api/bigdata'
import { SIGUNGUS, findSigungu } from '@/constants/sigungu'
import { useSettings } from '@/stores/settings'
import type { Lang } from '@/types/domain'

/**
 * SCR — 경북 데이터 인사이트 (/insights).
 *
 * "숨은 시군을 데이터로 끌어올린다"는 앱 정체성을 심사자/사용자가 눈으로 확인하는 화면.
 *  ① 방문자 버블 지도 — 데이터랩(DataLab) 실방문자(외지인+외국인)를 일러스트 지도 위
 *     비례 심볼로. 한적한 곳일수록 밝고 작다 → 숨은 경북이 한눈에.
 *  ② 한적한 순 랭킹 — 같은 데이터를 접근 가능한 목록(바)으로. 상위 3곳은 "숨은 보석".
 *  ③ 함께 찾은 곳 — 연관 추천(TarRlte) 재사용.
 *
 * graceful: DataLab 미구독 시 활용신청 안내를 노출하고(가짜 데이터 없음),
 * 코스 엔진은 정적 hiddenBoost 로 계속 동작함을 함께 안내한다.
 */

/** 방문자 규모 → 색 버킷용 순차 램프 (검증 완료: 단조 밝기·라이트엔드 2.1:1). 밝음=한적. */
const SEQ_RAMP = ['#ee9760', '#e07f42', '#cd6423', '#a94a10', '#7f370a'] as const

const W = MAINLAND_VIEWBOX.width
const H = MAINLAND_VIEWBOX.height
/** viewBox 여백 — 가장자리 시군(포항·영덕) 버블 위 직접 라벨이 잘리지 않도록 상하좌우 확장. */
const PAD = 48

/** 언어 → Intl 로케일 태그 (방문자수 compact 표기). */
const INTL_TAG: Record<Lang, string> = { ko: 'ko', en: 'en', ja: 'ja', zh: 'zh-CN' }

interface RegionDatum extends RegionVisit {
  /** 시군명 (현재 언어) */
  name: string
  /** 한적 순위 (1 = 가장 한적) */
  quietRank: number
  /** 지도 좌표 (울릉 등 본토 밖은 undefined) */
  px?: { x: number; y: number }
  /** 버블 반지름 (viewBox px) */
  r: number
  /** 램프 버킷 0(한적)~4(붐빔) */
  bucket: number
}

export default function Insights() {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const [visits, setVisits] = useState<RegionVisit[]>([])
  const [status, setStatus] = useState<BigDataStatus | 'loading'>('loading')
  const [baseYm, setBaseYm] = useState<string | undefined>()
  const [selected, setSelected] = useState<number | null>(null)
  const [relatedSigungu, setRelatedSigungu] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchGyeongbukVisitors().then((res) => {
      if (cancelled) return
      setVisits(res.items)
      setStatus(res.status)
      setBaseYm(res.baseYm)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // 정적 폴백 — 통계청 인구밀도(2023)를 방문 신호의 대리값으로. 라이브 DataLab 이 오기 전에도
  // "숨은 경북" 데이터 스토리를 즉시(빈 화면 없이) 그린다. 밀도 낮음 = 한적 = 숨은 보석.
  const proxyVisits: RegionVisit[] = useMemo(
    () =>
      SIGUNGUS.map((sg) => ({ sigunguCode: sg.code, visitors: sg.populationDensity })).sort(
        (a, b) => b.visitors - a.visitors,
      ),
    [],
  )

  // 라이브 방문자 데이터가 실제로 왔는지. 아니면(로딩/미구독/에러/빈) 정적 폴백으로 항상 렌더.
  const liveOk = status === 'ok' && visits.length > 0
  const dataMode: 'live' | 'proxy' = liveOk ? 'live' : 'proxy'
  const effectiveVisits = liveOk ? visits : proxyVisits

  // 파생 데이터 — 한적 순 정렬 + 지도 좌표/반지름/색 버킷.
  const regions: RegionDatum[] = useMemo(() => {
    if (effectiveVisits.length === 0) return []
    const asc = [...effectiveVisits].sort((a, b) => a.visitors - b.visitors)
    const logs = asc.map((v) => Math.log10(Math.max(1, v.visitors)))
    const lmin = Math.min(...logs)
    const lspan = Math.max(...logs) - lmin || 1
    const vmax = Math.max(...asc.map((v) => v.visitors))
    const geoByCode = new Map(SIGUNGU_GEO.map((g) => [g.code, g]))
    return asc.map((v, i) => {
      const sg = findSigungu(v.sigunguCode)
      const geo = geoByCode.get(v.sigunguCode)
      const norm = (Math.log10(Math.max(1, v.visitors)) - lmin) / lspan
      // 울릉군(17)은 본토 bbox 밖 — 지도 버블 제외, 목록에만.
      const px =
        geo && v.sigunguCode !== 17 ? projectMainland(geo.center) : undefined
      return {
        ...v,
        name: sg ? sg[lang as Lang] : String(v.sigunguCode),
        quietRank: i + 1,
        px,
        // 면적 비례(√) — 최소 14px 는 탭 타깃/가독 하한.
        r: 14 + Math.sqrt(v.visitors / vmax) * 34,
        bucket: Math.min(4, Math.floor(norm * 5)),
      }
    })
  }, [effectiveVisits, lang])

  const quietTop3 = regions.slice(0, 3)
  const maxVisitors = regions.length > 0 ? regions[regions.length - 1].visitors : 0
  const selectedRegion = regions.find((r) => r.sigunguCode === selected)
  const compact = useMemo(
    () => new Intl.NumberFormat(INTL_TAG[lang as Lang] ?? 'ko', { notation: 'compact' }),
    [lang],
  )
  const relatedDefault = relatedSigungu ?? quietTop3[0]?.sigunguCode ?? 11

  // 지표 값 포맷 — 라이브는 주간 방문자수, 폴백은 인구밀도(명/km²).
  const fmtMetric = (v: number) =>
    dataMode === 'live'
      ? t('insights.visitorsWeek', { n: compact.format(v) })
      : t('insights.densityValue', { n: compact.format(v) })

  return (
    <div className="page">
      <TopBar title={t('insights.title')} />

      {/* ── Hero — 데이터 스토리 선언 ── */}
      <section className="insights__hero">
        <div className="insights__hero-inner">
          <p className="eyebrow">{t('insights.eyebrow')}</p>
          <h1 className="insights__title">{t('insights.heading')}</h1>
          <p className="insights__subtitle">
            {dataMode === 'live' ? t('insights.subtitle') : t('insights.subtitleProxy')}
          </p>
        </div>
      </section>

      {/* ── ① 방문자 버블 지도 — 정적 폴백으로 항상 렌더, 라이브 오면 실측 교체 ── */}
      <section className="insights__section">
        <div className="insights__section-head">
          <p className="eyebrow">{t('insights.mapTitle')}</p>
          {dataMode === 'proxy' && <span className="badge-soft">{t('insights.proxyBadge')}</span>}
        </div>
        <p className="insights__hint">{t('insights.mapHint')}</p>

        {regions.length > 0 && (
          <>
            <figure className="insights-map">
              <svg
                viewBox={`${-PAD} ${-PAD} ${W + PAD * 2} ${H + PAD * 2}`}
                className="insights-map__svg"
                role="img"
                aria-label={t('insights.mapAria')}
              >
                {/* 후퇴형 베이스맵 — 데이터(버블)가 주인공. 일러스트는 다른 화면 전용. */}
                <GyeongbukSvg variant="quiet" />
                {/* 버블 — 한적(작고 밝음) → 붐빔(크고 진함). 2px 서피스 링으로 겹침 분리. */}
                {regions.map((rg) =>
                  rg.px ? (
                    <g key={rg.sigunguCode}>
                      <circle
                        cx={rg.px.x}
                        cy={rg.px.y}
                        r={rg.r}
                        fill={SEQ_RAMP[rg.bucket]}
                        fillOpacity={0.88}
                        stroke="#ffffff"
                        strokeWidth={2}
                        className={clsx(
                          'insights-map__bubble',
                          selected === rg.sigunguCode && 'insights-map__bubble--selected',
                        )}
                      />
                      {/* 숨은 보석 — 점선 링 강조 */}
                      {rg.quietRank <= 3 && (
                        <circle
                          cx={rg.px.x}
                          cy={rg.px.y}
                          r={rg.r + 7}
                          className="insights-map__gem-ring"
                        />
                      )}
                      {/* 선택적 직접 라벨 — 숨은 3곳 + 최다 1곳만 */}
                      {(rg.quietRank <= 3 || rg.visitors === maxVisitors) && (
                        <text
                          x={rg.px.x}
                          y={rg.px.y - rg.r - 10}
                          textAnchor="middle"
                          className="insights-map__label"
                        >
                          {rg.name}
                        </text>
                      )}
                      {/* 확대 탭 타깃 (시각 없음) */}
                      <circle
                        cx={rg.px.x}
                        cy={rg.px.y}
                        r={rg.r + 12}
                        fill="transparent"
                        className="insights-map__hit"
                        onClick={() =>
                          setSelected((cur) => (cur === rg.sigunguCode ? null : rg.sigunguCode))
                        }
                      >
                        <title>{`${rg.name} · ${fmtMetric(rg.visitors)}`}</title>
                      </circle>
                    </g>
                  ) : null,
                )}
              </svg>

              <figcaption className="insights-map__caption">
                {/* 순차 램프 범례 — 5단계 스텝 스와치, 밝음(한적)→진함(붐빔) */}
                <span className="insights-map__legend">
                  {t('insights.legendQuiet')}
                  <i className="insights-map__legend-ramp" aria-hidden>
                    {SEQ_RAMP.map((c) => (
                      <b key={c} style={{ background: c }} />
                    ))}
                  </i>
                  {t('insights.legendBusy')}
                </span>
                <span>{t('insights.ulleungNote')}</span>
              </figcaption>
            </figure>

            {/* 탭 선택 정보 카드 */}
            {selectedRegion && (
              <div className="insights-map__info card">
                <div className="insights-map__info-main">
                  <p className="insights-map__info-name">{selectedRegion.name}</p>
                  <p className="insights-map__info-meta">
                    {t('insights.quietRank', { rank: selectedRegion.quietRank })} ·{' '}
                    {fmtMetric(selectedRegion.visitors)}
                  </p>
                </div>
                <Link
                  to={`/explore?sigungu=${selectedRegion.sigunguCode}`}
                  className="insights-map__info-cta"
                >
                  {t('insights.exploreCta')}
                </Link>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── ② 한적한 순 랭킹 (접근 가능한 데이터 뷰) ── */}
      {regions.length > 0 && (
        <section className="insights__section">
          <p className="eyebrow">{t('insights.rankTitle')}</p>
          <p className="insights__hint">
            {dataMode === 'live' ? t('insights.rankHint') : t('insights.rankHintProxy')}
          </p>

          <ol className="insights-rank">
            {regions.map((rg) => (
              <li key={rg.sigunguCode} className="insights-rank__row">
                <span className="insights-rank__num">{rg.quietRank}</span>
                <span className="insights-rank__name">
                  {rg.name}
                  {rg.quietRank <= 3 && (
                    <em className="insights-rank__gem">{t('insights.gemBadge')}</em>
                  )}
                </span>
                <span className="insights-rank__track" aria-hidden>
                  <span
                    className={clsx(
                      'insights-rank__bar',
                      rg.quietRank <= 3 && 'insights-rank__bar--gem',
                    )}
                    style={{ width: `${Math.max(2, (rg.visitors / maxVisitors) * 100)}%` }}
                  />
                </span>
                <span className="insights-rank__value">{compact.format(rg.visitors)}</span>
              </li>
            ))}
          </ol>

          <p className="insights__source">
            {dataMode === 'live'
              ? baseYm &&
                t('insights.source', { ym: `${baseYm.slice(0, 4)}.${baseYm.slice(4)}` })
              : t('insights.proxySource')}
          </p>
        </section>
      )}

      {/* ── ③ 숨은 보석 → 코스로 연결 ── */}
      {quietTop3.length > 0 && (
        <section className="insights__section">
          <p className="eyebrow">{t('insights.gemsTitle')}</p>
          <p className="insights__hint">
            {dataMode === 'live' ? t('insights.gemsHint') : t('insights.gemsHintProxy')}
          </p>
          <div className="insights-gems">
            {quietTop3.map((rg) => (
              <Link
                key={rg.sigunguCode}
                to={`/explore?sigungu=${rg.sigunguCode}`}
                className="insights-gems__card card"
              >
                <span className="insights-gems__rank">№{rg.quietRank}</span>
                <span className="insights-gems__name">{rg.name}</span>
                <span className="insights-gems__meta">{fmtMetric(rg.visitors)}</span>
                <span className="insights-gems__cta">{t('insights.gemCta')} →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── ④ 함께 찾은 곳 (연관 추천 빅데이터) ── */}
      <section className="insights__section">
        <p className="eyebrow">{t('bigdata.relatedTitle')}</p>
        <p className="insights__hint">{t('bigdata.relatedHint')}</p>

        <div className="insights__chips">
          {SIGUNGUS.map((sg) => (
            <button
              key={sg.code}
              type="button"
              onClick={() => setRelatedSigungu(sg.code)}
              aria-pressed={relatedDefault === sg.code}
              className={clsx(
                'insights__chip',
                relatedDefault === sg.code ? 'insights__chip--active' : 'insights__chip--inactive',
              )}
            >
              {sg[lang as Lang]}
            </button>
          ))}
        </div>

        <div className="insights__related">
          <RelatedSpots key={relatedDefault} sigunguCode={relatedDefault} limit={12} showWhenEmpty />
        </div>
      </section>
    </div>
  )
}
