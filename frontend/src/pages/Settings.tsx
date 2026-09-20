import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import clsx from 'clsx'
import TopBar from '@/components/TopBar'
import KhsPageHeader from '@/components/khs/KhsPageHeader'
import MySubNav from '@/components/khs/MySubNav'
import OnboardingTour from '@/components/OnboardingTour'
import { useSettings } from '@/stores/settings'
import { askConfirm } from '@/stores/confirm'
import { toast } from '@/stores/toasts'
import { clearAllCache } from '@/lib/cache'
import { resetOnboarding } from '@/lib/onboarding'
import { CheckIcon, ChevronDownIcon, TrashIcon } from '@/components/icons'
import type { Lang } from '@/types/domain'

const LANGS: { code: Lang; label: string }[] = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
]

/** 이용 안내 — 기본은 접혀 있고, 푸터의 /settings#privacy 같은 링크로 오면 해당 항목만 펼친다. */
const NOTICES = ['about', 'privacy', 'location', 'license'] as const
type NoticeId = (typeof NOTICES)[number]

function noticeFromHash(hash: string): NoticeId | null {
  const id = hash.replace('#', '')
  return (NOTICES as readonly string[]).includes(id) ? (id as NoticeId) : null
}

export default function Settings() {
  const { t, i18n } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const setLang = useSettings((s) => s.setLang)
  const [replay, setReplay] = useState(false)
  const { hash } = useLocation()
  const [open, setOpen] = useState<NoticeId | null>(() => noticeFromHash(hash))

  // 해시가 바뀌면 그 항목을 펼친다 — effect 대신 렌더 중 파생(이전 값 비교) 패턴.
  const [prevHash, setPrevHash] = useState(hash)
  if (hash !== prevHash) {
    setPrevHash(hash)
    const next = noticeFromHash(hash)
    if (next) setOpen(next)
  }

  // 펼친 항목으로 이동 — lazy 라우트라 네이티브 해시 점프가 안 된다.
  useEffect(() => {
    const id = noticeFromHash(hash)
    if (!id) return
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'start' })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [hash])

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
    <div className="page khs-page">
      <TopBar title={t('settings.title')} />
      <KhsPageHeader title={t('nav.settings')} trail={[{ label: t('khs.gnb.my') }, { label: t('nav.settings') }]} />

      <div className="page-body settings__body khs-page__body">
        <MySubNav />
        <div className="khs-result-col settings__col">
          <section className="settings__group">
            <h2 className="settings__group-head">{t('settings.groupPrefs')}</h2>

            <div className="settings__row">
              <span className="settings__row-label">{t('settings.language')}</span>
              <div className="settings__row-body">
                <div className="settings__lang-grid">
                  {LANGS.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => handleLang(l.code)}
                      className={clsx(
                        'settings__lang-btn',
                        lang === l.code ? 'settings__lang-btn--active' : 'settings__lang-btn--inactive',
                      )}
                    >
                      {lang === l.code && <CheckIcon aria-hidden width={13} height={13} />}
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="settings__row settings__row--last">
              <span className="settings__row-label">{t('settings.data')}</span>
              <div className="settings__row-body">
                <div className="settings__data-actions">
                  <button type="button" onClick={handleReplayOnboarding} className="btn-secondary">
                    ↺ {t('settings.replayOnboarding')}
                  </button>
                  <button type="button" onClick={() => void handleClearCache()} className="btn-secondary">
                    <TrashIcon aria-hidden width={14} height={14} /> {t('settings.clearCache')}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="settings__group">
            <h2 className="settings__group-head">{t('settings.groupNotice')}</h2>
            {NOTICES.map((id) => (
              <div key={id} id={id} className="settings__notice">
                <button
                  type="button"
                  className="settings__notice-head"
                  aria-expanded={open === id}
                  onClick={() => setOpen((cur) => (cur === id ? null : id))}
                >
                  <span className={clsx('settings__notice-title', open === id && 'is-open')}>
                    {t(`settings.notice.${id}.title`)}
                  </span>
                  <ChevronDownIcon
                    aria-hidden
                    width={16}
                    height={16}
                    className={clsx('settings__notice-caret', open === id && 'is-open')}
                  />
                </button>
                {open === id && <p className="settings__notice-body">{t(`settings.notice.${id}.body`)}</p>}
              </div>
            ))}
          </section>
        </div>
      </div>

      {/* "온보딩 다시 보기" 강제 노출 */}
      {replay && <OnboardingTour forceOpen onClose={() => setReplay(false)} />}
    </div>
  )
}
