import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import TopBar from '@/components/TopBar'
import OnboardingTour from '@/components/OnboardingTour'
import { useSettings } from '@/stores/settings'
import { askConfirm } from '@/stores/confirm'
import { toast } from '@/stores/toasts'
import { clearAllCache } from '@/lib/cache'
import { resetOnboarding } from '@/lib/onboarding'
import type { Lang } from '@/types/domain'

const LANGS: { code: Lang; label: string }[] = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
]

export default function Settings() {
  const { t, i18n } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const setLang = useSettings((s) => s.setLang)
  const [replay, setReplay] = useState(false)

  function handleLang(l: Lang) {
    setLang(l)
    void i18n.changeLanguage(l)
  }

  async function handleClearCache() {
    const ok = await askConfirm({ message: t('settings.clearCacheConfirm') })
    if (!ok) return
    await clearAllCache()
    toast(t('settings.cacheCleared'), { type: 'success' })
  }

  function handleReplayOnboarding() {
    resetOnboarding()
    setReplay(true)
  }

  return (
    <div className="page">
      <TopBar title={t('settings.title')} />
      <div className="page-body-narrow settings__body">
        <section className="card-pad">
          <p className="eyebrow">{t('settings.language')}</p>
          <div className="settings__lang-grid">
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => handleLang(l.code)}
                className={clsx(
                  'settings__lang-btn',
                  lang === l.code
                    ? 'settings__lang-btn--active'
                    : 'settings__lang-btn--inactive',
                )}
              >
                {lang === l.code && <span aria-hidden>✓ </span>}
                {l.label}
              </button>
            ))}
          </div>
        </section>

        <section className="card-pad">
          <p className="eyebrow">{t('settings.privacy')}</p>
          <p className="settings__privacy-body">{t('settings.privacyBody')}</p>
        </section>

        <section className="card-pad">
          <p className="eyebrow">{t('settings.data')}</p>
          <div className="settings__data-actions">
            <button type="button" onClick={handleReplayOnboarding} className="btn-secondary">
              ↺ {t('settings.replayOnboarding')}
            </button>
            <button
              type="button"
              onClick={() => void handleClearCache()}
              className="btn-secondary"
            >
              🗑 {t('settings.clearCache')}
            </button>
          </div>
        </section>

        <section className="card settings__about">
          <Row label={t('settings.about')} value={t('appName')} />
          <Row label={t('settings.version')} value={`v${__APP_VERSION__}`} />
        </section>
      </div>

      {/* "온보딩 다시 보기" 강제 노출 */}
      {replay && <OnboardingTour forceOpen onClose={() => setReplay(false)} />}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="settings-row">
      <span className="eyebrow">{label}</span>
      <span className="settings-row__value">{value}</span>
    </div>
  )
}
