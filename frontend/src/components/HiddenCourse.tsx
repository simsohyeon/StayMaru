import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchGyeongbukVisitors } from '@/api/bigdata'
import { findSigungu } from '@/constants/sigungu'
import { computeQuietRegions, type QuietRegion } from '@/lib/hiddenIndex'
import type { Lang } from '@/types/domain'

/**
 * '숨은 경북 코스' — 제안서 최상위 약속(FR-04)을 데이터 근거와 함께 독립 진입점으로 노출.
 *
 * 데이터랩 외부 방문객 통계로 한적지수(0~100)를 산출해 상위 시·군을 보여주고,
 * 그 지역들로 hidden_gb 프로필 코스를 즉시 생성한다.
 * 통계가 오기 전에는 자리만 잡아 두고 기다린다 — 추정값으로 순위를 지어 보여주지 않는다.
 */
interface Props {
  lang: Lang
  generating: boolean
  /** 선택된 상위 한적 시·군 코드로 숨은 코스 생성 */
  onGenerate: (sigunguCodes: number[]) => void
}

const TOP_N = 5

export default function HiddenCourse({ lang, generating, onGenerate }: Props) {
  const { t } = useTranslation()
  const [regions, setRegions] = useState<QuietRegion[]>([])
  const [loading, setLoading] = useState(true)
  const [ym, setYm] = useState<string | undefined>()

  useEffect(() => {
    let alive = true
    void fetchGyeongbukVisitors()
      .then((res) => {
        if (!alive) return
        if (res.status === 'ok' && res.items.length > 0) {
          setRegions(computeQuietRegions(res.items))
          setYm(res.baseYm)
        }
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const top = regions.slice(0, TOP_N)
  const topCodes = top.map((r) => r.sigunguCode)
  const nameOf = (code: number) =>
    findSigungu(code)?.[lang as 'ko' | 'en' | 'ja' | 'zh'] ?? String(code)
  const source = ym ? t('hidden.sourceLive', { ym: `${ym.slice(0, 4)}.${ym.slice(4, 6)}` }) : t('hidden.sourceBase')

  return (
    <section className="hidden-gb">
      <div>
        <h2 className="section-title">{t('hidden.title')}</h2>
        <p className="section-sub">{t('hidden.subtitle')}</p>
      </div>

      {/* 한적지수 상위 + 즉시 코스 생성 */}
      <div className="hidden-gb__grid">
        <div className="card-pad hidden-gb__panel">
          <div className="hidden-gb__panel-head">
            <span className="eyebrow">{t('hidden.quietIndex')}</span>
            <span className="hidden-gb__source">{source}</span>
          </div>
          {top.length > 0 ? (
            <ul className="hidden-gb__list">
              {top.map((r) => (
                <li key={r.sigunguCode} className="hidden-gb__row">
                  <span className="hidden-gb__region">{nameOf(r.sigunguCode)}</span>
                  <span className="hidden-gb__bar">
                    <span className="hidden-gb__bar-fill" style={{ width: `${r.quietScore}%` }} />
                  </span>
                  <span className="hidden-gb__score">{r.quietScore}</span>
                </li>
              ))}
            </ul>
          ) : loading ? (
            <ul className="hidden-gb__list" aria-hidden>
              {Array.from({ length: TOP_N }).map((_, i) => (
                <li key={i} className="hidden-gb__row hidden-gb__row--skeleton animate-pulse">
                  <span className="hidden-gb__region" />
                  <span className="hidden-gb__bar" />
                  <span className="hidden-gb__score" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="hidden-gb__why">{t('hidden.unavailable')}</p>
          )}
          <p className="hidden-gb__why">{t('hidden.why')}</p>
          <button
            type="button"
            className="btn-primary hidden-gb__cta"
            disabled={generating || topCodes.length === 0}
            onClick={() => onGenerate(topCodes)}
          >
            {t('hidden.cta')}
          </button>
        </div>
      </div>
    </section>
  )
}
