import { useTranslation } from 'react-i18next'
import { useSettings } from '@/stores/settings'
import { findKeeper } from '@/constants/keepers'

/**
 * "이 자리를 지키는 사람" 카드 — Keepers 큐레이션과 placeName 매칭 시 노출.
 * 단순 장소 카탈로그를 넘어 "사람을 만나는 여행" 컨셉을 시각화한다.
 */
export default function KeeperCard({ placeName }: { placeName: string }) {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const keeper = findKeeper(placeName)
  if (!keeper) return null

  return (
    <section className="keeper-card">
      <div className="keeper-card__head">
        <p className="eyebrow keeper-card__eyebrow">{t('keeper.eyebrow')}</p>
        <span className="keeper-card__label">
          {t('keeper.label')}
        </span>
      </div>
      <div className="keeper-card__body">
        <div className="keeper-card__emoji" aria-hidden>
          {keeper.emoji}
        </div>
        <div className="keeper-card__info">
          <p className="keeper-card__role">{keeper.role[lang]}</p>
          <p className="keeper-card__bio">
            {keeper.bio[lang]}
          </p>
          {keeper.meeting && (
            <p className="keeper-card__meeting">
              <span aria-hidden>🤝</span>
              {keeper.meeting[lang]}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
