import { useEffect } from 'react'
import clsx from 'clsx'
import { useToasts } from '@/stores/toasts'

/**
 * 화면 하단에 토스트를 띄우는 호스트. AppShell 에 1회 마운트한다.
 * 모바일 하단 탭바(5rem) 위에 위치 (bottom-20). 데스크탑은 bottom-6.
 */
export default function ToastHost() {
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
      aria-label="notifications"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={clsx(
            'pointer-events-auto w-full max-w-md rounded-md border px-4 py-3 shadow-lg backdrop-blur-sm',
            'flex items-start gap-3 animate-fade-up',
            t.type === 'success' && 'border-emerald-200 bg-emerald-50/95 text-emerald-900',
            t.type === 'error' && 'border-rose-200 bg-rose-50/95 text-rose-900',
            t.type === 'info' && 'border-hairline-strong bg-card/95 text-ink',
          )}
        >
          <span className="mt-0.5 font-mono text-sm" aria-hidden>
            {t.type === 'success' ? '✓' : t.type === 'error' ? '!' : '·'}
          </span>
          <span className="flex-1 text-sm leading-relaxed break-keep">{t.message}</span>
          {t.actionLabel && t.onAction && (
            <button
              type="button"
              onClick={() => {
                t.onAction?.()
                dismiss(t.id)
              }}
              className="font-mono text-xs font-medium underline-offset-2 hover:underline"
            >
              {t.actionLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="close"
            className="text-muted-soft hover:text-ink"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
