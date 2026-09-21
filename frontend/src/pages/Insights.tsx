import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import TopBar from '@/components/TopBar'
import KhsPageHeader from '@/components/khs/KhsPageHeader'
import NowGyeongbuk from '@/components/insights/NowGyeongbuk'
import { fetchGyeongbukVisitors, type BigDataStatus, type RegionVisit } from '@/api/bigdata'
import { SIGUNGUS } from '@/constants/sigungu'
import { useSettings } from '@/stores/settings'
import type { Lang } from '@/types/domain'

/**
 * 지금 경북 (/insights) — 여행자의 질문 세 개에 답하는 화면.
 *   Q1 이번 주말 어디 가면 안 붐빌까 · Q2 가려던 곳이 붐비면 대신 어디로 · Q3 내 취향이면 어디가 맞을까
 *
 * 이 화면이 하는 일은 방문자 통계를 받아 오는 것뿐이고, 판단과 표시는 NowGyeongbuk 이 맡는다.
 * 라이브 통계가 없으면 인구밀도를 대리값으로 써서 빈 화면 없이 같은 답을 낸다.
 */

export default function Insights() {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const [visits, setVisits] = useState<RegionVisit[]>([])
  const [status, setStatus] = useState<BigDataStatus | 'loading'>('loading')

  useEffect(() => {
    let cancelled = false
    void fetchGyeongbukVisitors().then((res) => {
      if (cancelled) return
      setVisits(res.items)
      setStatus(res.status)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // 정적 폴백 — 통계청 인구밀도(2023)를 방문 신호의 대리값으로. 라이브 DataLab 이 오기 전에도
  // "숨은 경북" 판단을 즉시(빈 화면 없이) 낸다. 밀도 낮음 = 한적 = 숨은 보석.
  const proxyVisits: RegionVisit[] = useMemo(
    () =>
      SIGUNGUS.map((sg) => ({ sigunguCode: sg.code, visitors: sg.populationDensity })).sort(
        (a, b) => b.visitors - a.visitors,
      ),
    [],
  )

  const liveOk = status === 'ok' && visits.length > 0
  const dataMode: 'live' | 'proxy' = liveOk ? 'live' : 'proxy'
  const effectiveVisits = liveOk ? visits : proxyVisits

  const compact = useMemo(
    () =>
      new Intl.NumberFormat(
        ({ ko: 'ko', en: 'en', ja: 'ja', zh: 'zh-CN' } as Record<Lang, string>)[lang as Lang] ?? 'ko',
        { notation: 'compact' },
      ),
    [lang],
  )

  // 지표 값 포맷 — 라이브는 주간 방문자수, 폴백은 인구밀도(명/km²).
  const fmtMetric = (v: number) =>
    dataMode === 'live'
      ? t('insights.visitorsWeek', { n: compact.format(v) })
      : t('insights.densityValue', { n: compact.format(v) })

  return (
    <div className="page khs-page">
      <TopBar title={t('insights.title')} />

      <KhsPageHeader title={t('insights.title')} trail={[{ label: t('insights.title') }]} />

      {/* 좌측 소개 레일 없이 단일 컬럼 — 질문 블록이 곧 화면의 도입부다. */}
      <div className="page-body khs-page__body khs-page__body--single insights__body">
        <div className="khs-result-col">
          <NowGyeongbuk
            visits={effectiveVisits}
            dataMode={dataMode}
            lang={lang as Lang}
            fmtMetric={fmtMetric}
            compact={compact}
          />
        </div>
      </div>
    </div>
  )
}
