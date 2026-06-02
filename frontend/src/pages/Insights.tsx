import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import TopBar from '@/components/TopBar'
import RelatedSpots from '@/components/RelatedSpots'
import { fetchGyeongbukVisitors, type BigDataStatus, type RegionVisit } from '@/api/bigdata'
import { SIGUNGUS, findSigungu } from '@/constants/sigungu'
import { useSettings } from '@/stores/settings'
import type { Lang } from '@/types/domain'

const DATA_PORTAL_URL = 'https://www.data.go.kr/tcs/dss/selectDataSetList.do?keyword=%EA%B4%80%EA%B4%91%EC%A7%80%20%EC%97%B0%EA%B4%80%20%EC%B6%94%EC%B2%9C'

/**
 * 경북 관광 데이터랩 인사이트 — 데이터 활용도 심사 showcase.
 *  ① 시군별 방문자 랭킹 (DataLabService)
 *  ② 빅데이터가 주목한 관광지 (TarRlteService1, 시군 선택)
 *  ③ 활용신청 안내 (미구독 시에도 화면이 "준비된" 상태로 보이도록)
 */
export default function Insights() {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const [visitors, setVisitors] = useState<RegionVisit[]>([])
  const [vStatus, setVStatus] = useState<BigDataStatus | 'loading'>('loading')
  const [vBaseYm, setVBaseYm] = useState<string | undefined>()
  const [pickedSigungu, setPickedSigungu] = useState<number>(11) // 안동 기본

  useEffect(() => {
    let cancelled = false
    async function run() {
      setVStatus('loading')
      const res = await fetchGyeongbukVisitors()
      if (cancelled) return
      setVisitors(res.items)
      setVStatus(res.status)
      setVBaseYm(res.baseYm)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const maxVisitors = visitors.length > 0 ? visitors[0].visitors : 0

  return (
    <div className="bg-canvas">
      <TopBar back />

      {/* ── Hero ── */}
      <section className="px-5 pt-10 pb-8 md:px-10 md:pt-16 md:pb-10">
        <div className="max-w-3xl">
          <p className="eyebrow">{t('bigdata.insightsEyebrow')}</p>
          <h1 className="mt-4 font-display text-display-lg md:text-display-mega text-ink break-keep">
            {t('bigdata.insightsTitle')}
          </h1>
          <p className="mt-5 max-w-2xl text-body-md text-body break-keep">
            {t('bigdata.insightsSubtitle')}
          </p>
        </div>
      </section>

      {/* ── ① 시군별 방문자 랭킹 ── */}
      <section className="px-5 pb-section md:px-10 border-t border-hairline pt-10">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <p className="eyebrow">{t('bigdata.visitorsTitle')}</p>
            <p className="mt-2 text-body-sm text-muted break-keep">{t('bigdata.visitorsHint')}</p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-soft">
            DataLabService
            {vBaseYm ? ` · ${vBaseYm.slice(0, 4)}.${vBaseYm.slice(4, 6)}` : ''}
          </span>
        </div>

        {vStatus === 'loading' ? (
          <ul className="mt-6 space-y-2.5" aria-hidden>
            {Array.from({ length: 8 }).map((_, i) => (
              <li key={i} className="h-9 animate-pulse rounded-md bg-canvas-soft" />
            ))}
          </ul>
        ) : visitors.length > 0 ? (
          <ol className="mt-6 space-y-2">
            {visitors.map((r, i) => (
              <VisitorBar
                key={r.sigunguCode}
                rank={i + 1}
                name={findSigungu(r.sigunguCode)?.[lang as Lang] ?? String(r.sigunguCode)}
                visitors={r.visitors}
                pct={maxVisitors > 0 ? (r.visitors / maxVisitors) * 100 : 0}
                unit={t('bigdata.visitorsUnit')}
              />
            ))}
          </ol>
        ) : (
          <ActivateCard
            notSubscribed={vStatus === 'not-subscribed'}
            t={t}
          />
        )}
      </section>

      {/* ── ② 빅데이터가 주목한 관광지 (시군 선택) ── */}
      <section className="px-5 pb-section md:px-10 border-t border-hairline pt-10">
        <p className="eyebrow">{t('bigdata.popularSpotsTitle')}</p>
        <p className="mt-2 text-body-sm text-muted break-keep">{t('bigdata.popularSpotsHint')}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {SIGUNGUS.map((sg) => (
            <button
              key={sg.code}
              type="button"
              onClick={() => setPickedSigungu(sg.code)}
              className={clsx(
                'rounded-pill border px-3 h-8 text-sm transition-colors',
                pickedSigungu === sg.code
                  ? 'border-ink bg-ink text-canvas'
                  : 'border-hairline-strong bg-card text-ink hover:bg-canvas-soft',
              )}
            >
              {sg[lang as Lang]}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <RelatedSpots key={pickedSigungu} sigunguCode={pickedSigungu} limit={12} showWhenEmpty />
        </div>
      </section>
    </div>
  )
}

function VisitorBar({
  rank,
  name,
  visitors,
  pct,
  unit,
}: {
  rank: number
  name: string
  visitors: number
  pct: number
  unit: string
}) {
  return (
    <li className="relative overflow-hidden rounded-md border border-hairline bg-card">
      <div
        className="absolute inset-y-0 left-0 bg-primary/10"
        style={{ width: `${Math.max(pct, 3)}%` }}
        aria-hidden
      />
      <div className="relative flex items-center gap-3 px-3.5 py-2.5">
        <span className="font-mono text-[11px] text-muted-soft w-6">{String(rank).padStart(2, '0')}</span>
        <span className="flex-1 truncate text-sm font-medium text-ink">{name}</span>
        <span className="font-mono text-caption text-body tabular-nums">
          {visitors.toLocaleString()}
          {unit && <span className="ml-0.5 text-muted-soft">{unit}</span>}
        </span>
      </div>
    </li>
  )
}

function ActivateCard({
  notSubscribed,
  t,
}: {
  notSubscribed: boolean
  t: (k: string) => string
}) {
  return (
    <div className="mt-6 rounded-lg border border-dashed border-hairline-strong bg-canvas-soft p-6 md:p-8">
      <p className="font-display text-title-md text-ink break-keep">{t('bigdata.activateTitle')}</p>
      <p className="mt-3 max-w-2xl text-body-sm text-body break-keep">
        {notSubscribed ? t('bigdata.activateBody') : t('bigdata.empty')}
      </p>
      <a
        href={DATA_PORTAL_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-flex items-center gap-2 rounded-md border border-hairline-strong bg-card px-4 h-10 text-sm font-medium text-ink hover:bg-card/70 transition-colors"
      >
        ↗ {t('bigdata.activateCta')}
      </a>
    </div>
  )
}
