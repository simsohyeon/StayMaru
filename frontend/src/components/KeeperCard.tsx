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
    <section className="rounded-lg border border-amber-200 bg-amber-50/60 px-5 py-5">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <p className="eyebrow text-amber-800">{t('keeper.eyebrow')}</p>
        <span className="font-mono text-[10px] text-amber-700 uppercase tracking-wider">
          {t('keeper.label')}
        </span>
      </div>
      <div className="mt-3 flex items-start gap-4">
        <div className="flex-shrink-0 text-4xl" aria-hidden>
          {keeper.emoji}
        </div>
        <div className="min-w-0">
          <p className="text-title-md text-ink">{keeper.role[lang]}</p>
          <p className="mt-2 text-body-sm text-body whitespace-pre-line break-keep">
            {keeper.bio[lang]}
          </p>
          {keeper.meeting && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-pill bg-amber-100 px-3 py-1 text-xs text-amber-900">
              <span aria-hidden>🤝</span>
              {keeper.meeting[lang]}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
