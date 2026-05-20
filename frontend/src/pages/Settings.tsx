import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import TopBar from '@/components/TopBar'
import { useSettings } from '@/stores/settings'
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

  function handleLang(l: Lang) {
    setLang(l)
    void i18n.changeLanguage(l)
  }

  return (
    <div className="bg-canvas">
      <TopBar title={t('settings.title')} />
      <div className="px-5 py-8 md:px-10 md:py-12 md:max-w-2xl space-y-6">
        <section className="card-pad">
          <p className="eyebrow">{t('settings.language')}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => handleLang(l.code)}
                className={clsx(
                  'rounded-md border h-11 text-sm font-medium transition-colors',
                  lang === l.code
                    ? 'border-ink bg-ink text-canvas'
                    : 'border-hairline-strong bg-card text-ink hover:bg-canvas-soft',
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
        </section>

        <section className="card-pad">
          <p className="eyebrow">{t('settings.privacy')}</p>
          <p className="mt-3 text-body-md text-body">{t('settings.privacyBody')}</p>
        </section>

        <section className="card divide-y divide-hairline text-sm">
          <Row label={t('settings.about')} value={t('appName')} />
          <Row label={t('settings.version')} value="v2.1" />
        </section>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-5 py-4">
      <span className="text-eyebrow uppercase text-muted">{label}</span>
      <span className="text-body-md text-ink">{value}</span>
    </div>
  )
}
