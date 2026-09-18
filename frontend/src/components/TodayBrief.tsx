import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { findSigungu } from '@/constants/sigungu'
import { fetchRainChance, type RainHint } from '@/api/weather'
import { josa } from '@/lib/josa'
import { RainIcon, LeafIcon } from '@/components/icons'
import type { Lang } from '@/types/domain'

/** 히어로가 기본으로 잡는 거점 — 경북 도청 소재지(안동시). 사용자가 거점을 고르기 전 기준. */
const DEFAULT_SIGUNGU = 11

/**
 * 홈 최상단 '오늘' 브리핑 — 지금 날씨와 한적 1위를 먼저 보여주고 코스 생성으로 보낸다.
 * 예보를 못 받으면 평년값으로 폴백하므로(weather.ts) 이 카드는 항상 렌더된다.
 */
export default function TodayBrief({
  lang,
  quietName,
  generating,
  onGenerate,
}: {
  lang: Lang
  /** 데이터랩 한적 1위 시군명. 아직 안 왔으면 빈 문자열. */
  quietName: string
  generating: boolean
  /** 오늘 조건(거점 + 강수 힌트)으로 코스 생성 */
  onGenerate: (sigunguCode: number) => void
}) {
  const { t } = useTranslation()
  const [rain, setRain] = useState<{ chance: number; hint: RainHint } | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchRainChance(DEFAULT_SIGUNGU).then((w) => {
      if (!cancelled) setRain({ chance: w.rainChance, hint: w.hint })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const regionName = findSigungu(DEFAULT_SIGUNGU)?.[lang as 'ko' | 'en' | 'ja' | 'zh'] ?? ''
  const hint: RainHint = rain?.hint ?? 'clear'

  return (
    <section>
      <p className="today__eyebrow">{t('today.eyebrow')}</p>
      {/* topic 은 한국어 문장에서만 쓰인다 — 다른 언어의 문구에는 자리표시자가 없어 무시된다. */}
      <h1 className="today__title">
        {t(`today.title.${hint}`, { region: regionName, topic: josa(regionName, '은', '는') })}
      </h1>

      <div className="today__stats">
        <div className="today__stat">
          <span className="today__stat-label">
            <RainIcon aria-hidden width={15} height={15} />
            {t('today.rainLabel')}
          </span>
          <span className="today__stat-value">
            {rain ? `${Math.round(rain.chance * 100)}%` : '—'}
          </span>
          <span className="today__stat-note">{t(`today.rainNote.${hint}`)}</span>
        </div>

        <Link to="/insights" className="today__stat today__stat--link">
          <span className="today__stat-label">
            <LeafIcon aria-hidden width={15} height={15} />
            {t('today.quietLabel')}
          </span>
          <span className="today__stat-value">{quietName || '—'}</span>
          <span className="today__stat-note">{t('today.quietNote')}</span>
        </Link>
      </div>

      <button
        type="button"
        onClick={() => onGenerate(DEFAULT_SIGUNGU)}
        disabled={generating}
        className="today__cta"
      >
        {generating ? t('today.ctaBusy') : t('today.cta')}
      </button>
    </section>
  )
}
