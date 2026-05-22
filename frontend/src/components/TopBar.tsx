import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface Props {
  title?: string
  back?: boolean
  right?: React.ReactNode
}

/**
 * 상단 바. back=true 일 때 ← 버튼.
 *
 * 안전한 back: 직링크(공유/북마크)로 들어와서 히스토리가 없는 경우
 * nav(-1) 은 외부 사이트로 튕긴다. window.history.length<=1 이거나
 * referrer 가 같은 origin 이 아닐 때는 홈으로 fallback.
 */
export default function TopBar({ title, back, right }: Props) {
  const nav = useNavigate()
  const { t } = useTranslation()

  function handleBack() {
    const sameOriginReferrer =
      typeof document !== 'undefined' &&
      document.referrer &&
      document.referrer.startsWith(window.location.origin)
    if (window.history.length > 1 && sameOriginReferrer) {
      nav(-1)
    } else if (window.history.length > 1) {
      // history 가 있지만 외부에서 진입 — 일단 한 번 뒤로 가본다
      nav(-1)
    } else {
      // 직링크 진입 — 홈으로
      nav('/', { replace: true })
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-6 md:px-10 md:pt-10 print-hide">
      <div className="flex items-center gap-3">
        {back && (
          <button
            type="button"
            onClick={handleBack}
            aria-label={t('common.back')}
            className="inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-ink"
          >
            ← <span className="hidden md:inline">{t('common.back')}</span>
          </button>
        )}
        {title && (
          <h1 className="font-display text-display-md text-ink md:text-display-lg">
            {title}
          </h1>
        )}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  )
}
