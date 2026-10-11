import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import TopBar from '@/components/TopBar'
import KhsPageHeader from '@/components/khs/KhsPageHeader'
import NowGyeongbuk from '@/components/insights/NowGyeongbuk'
import { fetchGyeongbukVisitors, type BigDataStatus, type RegionVisit } from '@/api/bigdata'
import { useSettings } from '@/stores/settings'
import type { Lang } from '@/types/domain'

/**
 * 지금 경북 (/insights) — 여행자의 질문 세 개에 답하는 화면.
 *   Q1 이번 주말 어디 가면 안 붐빌까 · Q2 가려던 곳이 붐비면 대신 어디로 · Q3 내 취향이면 어디가 맞을까
 *
 * 이 화면이 하는 일은 방문자 통계를 받아 오는 것뿐이고, 판단과 표시는 NowGyeongbuk 이 맡는다.
 * 통계는 서버에 적재된 한국관광 데이터랩 수치(api/sync-visits.ts)를 쓴다. 못 받으면 빈 화면 대신
 * 그 사실을 적는다 — 추정 상수로 숫자를 채우면 "방문자"라고 쓰인 자리에 다른 뜻의 값이 들어간다.
 */

export default function Insights() {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const [visits, setVisits] = useState<RegionVisit[]>([])
  const [status, setStatus] = useState<BigDataStatus | 'loading'>('loading')
  const [baseYm, setBaseYm] = useState<string | undefined>(undefined)

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

  const compact = useMemo(
    () =>
      new Intl.NumberFormat(
        ({ ko: 'ko', en: 'en', ja: 'ja', zh: 'zh-CN' } as Record<Lang, string>)[lang as Lang] ?? 'ko',
        { notation: 'compact' },
      ),
    [lang],
  )

  /** 주간 방문자수 — 라벨까지 붙인 형태(카드 캡션·Q2 보조문구). */
  const fmtMetric = (v: number) => t('insights.visitorsWeek', { n: compact.format(v) })
  /** 값만 — 칩·표처럼 자리가 좁은 곳. */
  const fmtMetricShort = (v: number) => compact.format(v)

  return (
    <div className="page khs-page">
      <TopBar title={t('insights.title')} />

      <KhsPageHeader title={t('insights.title')} trail={[{ label: t('insights.title') }]} />

      {/* 좌측 소개 레일 없이 단일 컬럼 — 질문 블록이 곧 화면의 도입부다. */}
      <div className="page-body khs-page__body khs-page__body--single insights__body">
        <div className="khs-result-col">
          {visits.length > 0 ? (
            <NowGyeongbuk
              visits={visits}
              baseYm={baseYm}
              lang={lang as Lang}
              fmtMetric={fmtMetric}
              fmtMetricShort={fmtMetricShort}
              metricName={t('insights.metricName')}
            />
          ) : (
            <p className="now__empty">
              {status === 'loading' ? t('insights.now.loading') : t('insights.unavailable')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
