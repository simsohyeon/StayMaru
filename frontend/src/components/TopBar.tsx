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
    <div className="top-bar print-hide">
      <div className="top-bar__group">
        {back && (
          <button
            type="button"
            onClick={handleBack}
            aria-label={t('common.back')}
            className="top-bar__back"
          >
            ← <span className="top-bar__back-label">{t('common.back')}</span>
          </button>
        )}
        {title && (
          <h1 className="top-bar__title">
            {title}
          </h1>
        )}
      </div>
      {right && <div className="top-bar__right">{right}</div>}
    </div>
  )
}
