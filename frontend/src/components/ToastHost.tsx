import { useEffect } from 'react'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import { useToasts } from '@/stores/toasts'

/**
 * 화면 하단에 토스트를 띄우는 호스트. AppShell 에 1회 마운트한다.
 * 모바일 하단 탭바(5rem) 위에 위치 (bottom-20). 데스크탑은 bottom-6.
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
            {item.type === 'success' ? '✓' : item.type === 'error' ? '!' : '·'}
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
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
