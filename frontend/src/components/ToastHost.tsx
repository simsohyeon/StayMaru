import { useEffect } from 'react'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import { useToasts } from '@/stores/toasts'
import { CheckIcon, CloseIcon } from '@/components/icons'

/**
 * 화면 상단(헤더 바로 아래 중앙)에 토스트를 띄우는 호스트. AppShell 에 1회 마운트한다.
 * 위치·애니메이션은 comp-1.css 의 .toast — 하단 우측일 때 찜 결과를 놓치기 쉬워 상단으로 올렸다.
 */
export default function ToastHost() {
  const { t } = useTranslation()
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)

  // 각 토스트의 duration 이 지나면 자동 dismiss
  useEffect(() => {
    const timers = toasts
      .filter((t) => t.duration > 0)
      .map((t) => window.setTimeout(() => dismiss(t.id), t.duration))
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [toasts, dismiss])

  if (toasts.length === 0) return null

  return (
    <div
      role="region"
      aria-label={t('common.notifications')}
      aria-live="polite"
      className="toast"
    >
      {toasts.map((item) => (
        <div
          key={item.id}
          role="status"
          className={clsx(
            'toast__item',
            item.type === 'success' && 'toast__item--success',
            item.type === 'error' && 'toast__item--error',
            item.type === 'info' && 'toast__item--info',
          )}
        >
          <span className="toast__icon" aria-hidden>
            {item.type === 'success' ? <CheckIcon width={14} height={14} /> : item.type === 'error' ? '!' : '·'}
          </span>
          <span className="toast__message">{item.message}</span>
          {item.actionLabel && item.onAction && (
            <button
              type="button"
              onClick={() => {
                item.onAction?.()
                dismiss(item.id)
              }}
              className="toast__action"
            >
              {item.actionLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => dismiss(item.id)}
            aria-label={t('common.close')}
            className="toast__close"
          >
            <CloseIcon width={13} height={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
