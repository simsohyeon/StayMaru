import { useTranslation } from 'react-i18next'
import { useOnline } from '@/lib/useOnline'

/**
 * 전역 오프라인 안내. AppShell 에 한 번 마운트.
 * 화면 상단에 슬라이드인 띠 — 닫기 버튼 없음(연결 복구되면 자동 사라짐).
 */
export default function OfflineBanner() {
  const { t } = useTranslation()
  const online = useOnline()
  if (online) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-40 border-b border-rose-200 bg-rose-50 text-rose-900 animate-fade-up"
    >
      <div className="mx-auto flex max-w-content items-center gap-3 px-4 py-2 md:px-10">
        <span className="font-mono text-xs" aria-hidden>
          ⚠
        </span>
        <p className="text-caption">
          <span className="font-semibold">{t('offline.title')}</span>
          <span className="ml-2 text-rose-800/80">{t('offline.body')}</span>
        </p>
      </div>
    </div>
  )
}
