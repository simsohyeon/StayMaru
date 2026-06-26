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
      className="offline-banner animate-fade-up"
    >
      <div className="offline-banner__inner">
        <span className="offline-banner__icon" aria-hidden>
          ⚠
        </span>
        <p className="offline-banner__text">
          <span className="offline-banner__title">{t('offline.title')}</span>
          <span className="offline-banner__body">{t('offline.body')}</span>
        </p>
      </div>
    </div>
  )
}
