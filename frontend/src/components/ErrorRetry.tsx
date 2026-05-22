import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

interface Props {
  /** 추가 안내 텍스트 — 없으면 generic 에러 메시지 표시 */
  message?: string
  /** "다시 시도" 버튼 핸들러. 미지정 시 location.reload() */
  onRetry?: () => void
  /** 카드 vs 인라인 톤 */
  variant?: 'card' | 'inline'
  className?: string
}

/**
 * API 실패 후 빈 화면 대신 띄우는 카드.
 * 시스템 프롬프트의 "API 실패 fallback 제공"을 충족하기 위한 공통 위젯.
 */
export default function ErrorRetry({ message, onRetry, variant = 'card', className }: Props) {
  const { t } = useTranslation()
  const finalMessage = message ?? t('error.apiFailed')
  return (
    <div
      role="alert"
      className={clsx(
        variant === 'card'
          ? 'card-pad text-center'
          : 'inline-flex items-center gap-3 rounded-md border border-hairline bg-canvas-soft px-4 py-3',
        className,
      )}
    >
      <p className={clsx('text-body-md text-body break-keep', variant === 'card' && 'mt-1')}>
        {finalMessage}
      </p>
      <button
        type="button"
        onClick={onRetry ?? (() => window.location.reload())}
        className={clsx('btn-secondary', variant === 'card' && 'mt-4')}
      >
        ↻ {t('common.retry')}
      </button>
    </div>
  )
}
