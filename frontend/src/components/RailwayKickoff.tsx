import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { useSettings } from '@/stores/settings'
import { KTX_STATIONS, type KtxStation } from '@/constants/ktxStations'

/**
 * 빌더 위의 "KTX/SRT 정거장으로 시작하기" 칩 그룹.
 * 역을 누르면 인근 시군구가 자동으로 거점에 채워진다 — 외국인 관광객 첫 결정을 줄이는 장치.
 */
export default function RailwayKickoff({
  onPick,
  activeStation,
}: {
  onPick: (station: KtxStation) => void
  activeStation?: string
}) {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)

  return (
    <section className="card-pad bg-canvas-soft border border-hairline space-y-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <p className="eyebrow">{t('railway.eyebrow')}</p>
          <h3 className="mt-1 text-title-md text-ink">{t('railway.title')}</h3>
        </div>
        <span className="font-mono text-[10px] text-muted-soft uppercase tracking-wider">
          {t('railway.fromSeoul')}
        </span>
      </div>
      <p className="text-caption text-muted max-w-prose">
        {t('railway.subtitle')}
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        {KTX_STATIONS.map((st) => {
          const active = activeStation === st.slug
          return (
            <button
              key={st.slug}
              type="button"
              onClick={() => onPick(st)}
              className={clsx(
                'inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors',
                active
                  ? 'border-ink bg-ink text-canvas'
                  : 'border-hairline-strong bg-card text-ink hover:border-ink',
              )}
            >
              <span aria-hidden>🚄</span>
              <span>{st.label[lang]}</span>
              <span className="font-mono text-[10px] opacity-70">
                {st.fromSeoulMinutes}m
              </span>
              {st.hasSrt && (
                <span className="font-mono text-[9px] rounded-sm bg-primary/15 px-1.5 py-0.5 text-primary">
                  SRT
                </span>
              )}
              {st.isEum && (
                <span className="font-mono text-[9px] rounded-sm bg-sky-100 px-1.5 py-0.5 text-sky-800">
                  EUM
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
