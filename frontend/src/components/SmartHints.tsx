import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { useSettings } from '@/stores/settings'
import { findSigungu } from '@/constants/sigungu'
import { bestMarketForBases, type MarketHit } from '@/constants/markets5day'
import { climatologyRainChance, toRainHint, type RainHint } from '@/api/weather'

/**
 * 빌더 옆의 "오늘 거점 인텔리전스" 카드.
 * 거점 시군구가 선택되면 두 가지를 보여준다:
 *  1) 강수 확률 힌트 — 비 오는 날이면 "실내 가중치 ON" 안내
 *  2) 가장 임박한 5일장 — "내일 풍기장" 같은 발견의 단서
 *
 * 단순 정보 패널이지만 "다른 코스앱과 다르다" 는 첫인상을 만든다.
 */
export default function SmartHints({
  sigunguCodes,
  startDate,
}: {
  sigunguCodes: number[]
  startDate?: string
}) {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const [rain, setRain] = useState<{ chance: number; hint: RainHint } | null>(null)
  const [market, setMarket] = useState<MarketHit | undefined>(undefined)

  useEffect(() => {
    if (sigunguCodes.length === 0) {
      setRain(null)
      setMarket(undefined)
      return
    }
    const date = startDate ? new Date(startDate) : new Date()
    const chance = climatologyRainChance(date)
    setRain({ chance, hint: toRainHint(chance) })
    setMarket(bestMarketForBases(sigunguCodes, date))
  }, [sigunguCodes.join(','), startDate])

  if (sigunguCodes.length === 0) return null

  const firstName = (() => {
    const sg = findSigungu(sigunguCodes[0])
    return sg ? sg[lang as 'ko' | 'en' | 'ja' | 'zh'] : ''
  })()

  return (
    <div className="card-pad bg-canvas-soft border border-hairline space-y-4">
      <div className="flex items-center justify-between">
        <span className="eyebrow">{t('smart.eyebrow')}</span>
        <span className="font-mono text-[10px] text-muted-soft uppercase tracking-wider">
          {firstName}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {rain && (
          <div
            className={clsx(
              'rounded-md border px-4 py-3',
              rain.hint === 'rain-likely'
                ? 'bg-sky-50 border-sky-200 text-sky-900'
                : rain.hint === 'unstable'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900',
            )}
          >
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider opacity-70">
                {t('smart.rainEyebrow')}
              </span>
              <span className="font-mono text-xs">
                {Math.round(rain.chance * 100)}%
              </span>
            </div>
            <p className="mt-1 text-sm font-medium">
              {t(`smart.rain.${rain.hint}`)}
            </p>
            {rain.hint !== 'clear' && (
              <p className="mt-1 text-[11px] opacity-80">
                {t('smart.rainBoostHint')}
              </p>
            )}
          </div>
        )}

        {market && (
          <div className="rounded-md border border-rose-200 bg-rose-50 text-rose-900 px-4 py-3">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider opacity-70">
                {t('smart.marketEyebrow')}
              </span>
              <span className="font-mono text-xs">
                {market.daysAhead === 0
                  ? t('smart.marketToday')
                  : t('smart.marketInDays', { n: market.daysAhead })}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium">
              {market.market.label[lang]}
            </p>
            <p className="mt-1 text-[11px] opacity-80">
              {market.market.items[lang]}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
