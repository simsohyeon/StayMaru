import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { toast } from '@/stores/toasts'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  url: string
}

type Platform = 'ios' | 'android' | 'desktop'

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

export default function AddToHomeDialog({ open, onClose, title, url }: Props) {
  const { t } = useTranslation()
  const platform = useMemo(detectPlatform, [])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) setCopied(false)
  }, [open])

  if (!open) return null

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast(t('addToHome.copied'), { type: 'success', duration: 2000 })
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      toast(t('addToHome.copyFailed'), { type: 'error' })
    }
  }

  const steps =
    platform === 'ios'
      ? [t('addToHome.iosStep1'), t('addToHome.iosStep2'), t('addToHome.iosStep3')]
      : platform === 'android'
        ? [t('addToHome.androidStep1'), t('addToHome.androidStep2'), t('addToHome.androidStep3')]
        : [t('addToHome.desktopStep1'), t('addToHome.desktopStep2')]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-to-home-title"
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/55 backdrop-blur-sm md:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={clsx(
          'w-full md:max-w-md bg-canvas border-t md:border border-hairline',
          'rounded-t-xl md:rounded-xl shadow-2xl animate-fade-up',
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-4">
          <div className="min-w-0">
            <p className="eyebrow">{t('addToHome.eyebrow')}</p>
            <h2
              id="add-to-home-title"
              className="mt-1 font-display text-display-sm text-ink break-keep"
            >
              {t('addToHome.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex-shrink-0 -mr-2 rounded-md p-2 text-muted hover:text-ink hover:bg-canvas-soft transition-colors"
          >
            ✕
          </button>
        </header>

        <div className="px-5 py-5 space-y-5">
          <div className="rounded-md border border-hairline bg-canvas-soft px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-soft">
              {t('addToHome.previewLabel')}
            </p>
            <p className="mt-1 text-title-sm text-ink truncate">{title}</p>
            <p className="mt-1 font-mono text-caption text-muted truncate">{url}</p>
          </div>

          <div className="flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-hairline" />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-soft whitespace-nowrap">
              {t(`addToHome.platform.${platform}`)}
            </span>
            <span className="h-px flex-1 bg-hairline" />
          </div>

          <ol className="space-y-2.5">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span
                  aria-hidden
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-ink font-mono text-[11px] text-canvas"
                >
                  {i + 1}
                </span>
                <p className="pt-0.5 text-body-sm text-body break-keep">{step}</p>
              </li>
            ))}
          </ol>

          <p className="text-caption text-muted-soft break-keep">{t('addToHome.note')}</p>
        </div>

        <footer
          className="flex items-center gap-2 border-t border-hairline-strong bg-canvas/95 px-5 py-3"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
        >
          <button
            type="button"
            onClick={() => void copyUrl()}
            className="btn-secondary flex-1"
          >
            {copied ? '✓ ' + t('addToHome.copied') : t('addToHome.copyUrl')}
          </button>
          <button type="button" onClick={onClose} className="btn-download">
            {t('common.close')}
          </button>
        </footer>
      </div>
    </div>
  )
}
