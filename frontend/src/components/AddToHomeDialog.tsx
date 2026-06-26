import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/stores/toasts'
import { useCanInstall, promptInstall } from '@/lib/pwaInstall'

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
  const platform = useMemo(() => detectPlatform(), [])
  const canInstall = useCanInstall()
  const [copied, setCopied] = useState(false)

  async function handleInstall() {
    const outcome = await promptInstall()
    if (outcome === 'accepted') {
      toast(t('addToHome.installedToast'), { type: 'success', duration: 2500 })
      onClose()
    }
  }

  // 닫힐 때 copied 리셋 — effect 대신 렌더 중 파생(이전 open 비교).
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (!open) setCopied(false)
  }

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
      className="add-home"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="add-home__panel">
        <header className="add-home__header">
          <div className="add-home__header-text">
            <p className="eyebrow">{t('addToHome.eyebrow')}</p>
            <h2
              id="add-to-home-title"
              className="add-home__title"
            >
              {t('addToHome.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="add-home__close"
          >
            ✕
          </button>
        </header>

        <div className="add-home__body">
          <div className="add-home__preview">
            <p className="add-home__preview-label">
              {t('addToHome.previewLabel')}
            </p>
            <p className="add-home__preview-title">{title}</p>
            <p className="add-home__preview-url">{url}</p>
          </div>

          {canInstall ? (
            // Chromium 계열: 네이티브 원탭 설치. 수동 단계 생략.
            <button type="button" onClick={() => void handleInstall()} className="btn-primary add-home__install">
              ↓ {t('addToHome.installNow')}
            </button>
          ) : (
            <>
              <div className="add-home__divider" aria-hidden>
                <span className="add-home__divider-line" />
                <span className="add-home__divider-label">
                  {t(`addToHome.platform.${platform}`)}
                </span>
                <span className="add-home__divider-line" />
              </div>

              <ol className="add-home__steps">
                {steps.map((step, i) => (
                  <li key={i} className="add-home__step">
                    <span
                      aria-hidden
                      className="add-home__step-num"
                    >
                      {i + 1}
                    </span>
                    <p className="add-home__step-text">{step}</p>
                  </li>
                ))}
              </ol>
            </>
          )}

          <p className="add-home__note">{t('addToHome.note')}</p>
        </div>

        <footer
          className="add-home__footer"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
        >
          <button
            type="button"
            onClick={() => void copyUrl()}
            className="btn-secondary add-home__copy"
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
