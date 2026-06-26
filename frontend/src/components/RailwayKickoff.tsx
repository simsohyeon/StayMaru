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
    <section className="card-pad railway">
      <div className="railway__head">
        <div>
          <p className="eyebrow">{t('railway.eyebrow')}</p>
          <h3 className="railway__title">{t('railway.title')}</h3>
        </div>
        <span className="railway__from">
          {t('railway.fromSeoul')}
        </span>
      </div>
      <p className="railway__subtitle">
        {t('railway.subtitle')}
      </p>
      <div className="railway__stations">
        {KTX_STATIONS.map((st) => {
          const active = activeStation === st.slug
          return (
            <button
              key={st.slug}
              type="button"
              onClick={() => onPick(st)}
              className={clsx(
                'railway__station',
                active
                  ? 'railway__station--active'
                  : 'railway__station--idle',
              )}
            >
              <span aria-hidden>🚄</span>
              <span>{st.label[lang]}</span>
              <span className="railway__minutes">
                {st.fromSeoulMinutes}m
              </span>
              {st.hasSrt && (
                <span className="railway__tag railway__tag--srt">
                  SRT
                </span>
              )}
              {st.isEum && (
                <span className="railway__tag railway__tag--eum">
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
