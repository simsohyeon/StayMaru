import { useEffect, useRef } from 'react'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import { useConfirmStore } from '@/stores/confirm'

/**
 * 글로벌 confirm 모달 호스트. AppShell 에 1회 마운트.
 * `askConfirm({ message })` 호출 → Promise<boolean> 으로 결과 반환.
 */
export default function ConfirmHost() {
  const { t } = useTranslation()
  const current = useConfirmStore((s) => s.current)
  const resolve = useConfirmStore((s) => s.resolve)
  const confirmBtnRef = useRef<HTMLButtonElement>(null)

  // 열림: 확정 버튼 포커스 + ESC 처리 + body scroll lock
  useEffect(() => {
    if (!current) return
    confirmBtnRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolve(false)
      else if (e.key === 'Enter') resolve(true)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [current, resolve])

  if (!current) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={current.title ? 'confirm-title' : undefined}
      onClick={() => resolve(false)}
      className="confirm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="confirm__card"
      >
        {current.title && (
          <h2 id="confirm-title" className="confirm__title">
            {current.title}
          </h2>
        )}
        <p className="confirm__message">{current.message}</p>
        <div className="confirm__actions">
          <button
            type="button"
            onClick={() => resolve(false)}
            className="btn-secondary confirm__cancel"
          >
            {current.cancelLabel ?? t('common.cancel')}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={() => resolve(true)}
            className={clsx(
              'confirm__ok',
              current.danger
                ? 'confirm__ok--danger'
                : 'btn-primary',
            )}
          >
            {current.confirmLabel ?? t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
