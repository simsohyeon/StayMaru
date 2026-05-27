import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import LangSwitch from './LangSwitch'
import ToastHost from './ToastHost'
import ConfirmHost from './ConfirmHost'
import OfflineBanner from './OfflineBanner'

const MOBILE_TABS = [
  { to: '/', key: 'home', icon: '○', exact: true },
  { to: '/explore', key: 'explore', icon: '◇' },
  { to: '/festivals', key: 'festivals', icon: '✦' },
  { to: '/journal', key: 'journal', icon: '✎' },
  { to: '/favorites', key: 'favorites', icon: '♡' },
] as const

const HEADER_MENU = [
  { to: '/explore', key: 'explore' },
  { to: '/festivals', key: 'festivals' },
  { to: '/journal', key: 'journal' },
  { to: '/favorites', key: 'favorites' },
] as const

export default function AppShell() {
  const { t } = useTranslation()
  const location = useLocation()
  const nav = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const fullscreen = /^\/course\/map$/.test(location.pathname)

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      {/* ───────── Global offline banner (conditional) ───────── */}
      <OfflineBanner />

      {/* ───────── Top nav (Cursor pattern: 64px, canvas bg, wordmark left) ───────── */}
      {!fullscreen && (
        <header className="sticky top-0 z-30 border-b border-hairline bg-canvas">
          <div className="mx-auto flex h-16 w-full max-w-content items-center gap-6 px-4 md:h-20 md:px-10">
            {/* Wordmark — 다국어 워드마크 한 줄 */}
            <NavLink to="/" className="flex items-baseline gap-1.5">
              <span className="font-display text-[20px] tracking-tight text-ink md:text-[22px]" style={{ fontWeight: 400 }}>
                {t('brand.wordmarkName')}
              </span>
              <span className="text-primary font-display text-[20px] md:text-[22px]" style={{ fontWeight: 400 }}>·</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                {t('brand.wordmarkRegion')}
              </span>
            </NavLink>

            {/* Desktop menu */}
            <nav className="hidden flex-1 md:flex">
              <ul className="flex items-center gap-1">
                {HEADER_MENU.map((m) => (
                  <li key={m.key}>
                    <NavLink
                      to={m.to}
                      className={({ isActive }) =>
                        clsx(
                          'inline-flex items-center px-3 h-9 text-sm font-medium transition-colors',
                          isActive ? 'text-ink' : 'text-body hover:text-ink',
                        )
                      }
                    >
                      {t(`nav.${m.key}`)}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Right cluster */}
            <div className="ml-auto flex items-center gap-2 md:gap-3">
              <LangSwitch />
              <button
                type="button"
                onClick={() => {
                  // 홈의 빌더 리스너가 받아 모달 오픈. 홈이 아니면 먼저 이동.
                  if (location.pathname !== '/') nav('/')
                  window.setTimeout(() => {
                    window.dispatchEvent(new Event('shimmaru:open-builder'))
                  }, 60)
                }}
                className="hidden md:inline-flex btn-primary !h-9 !px-4 !text-xs"
              >
                {t('home.generate')}
              </button>
              <button
                type="button"
                aria-label="menu"
                onClick={() => setMenuOpen((v) => !v)}
                className="grid h-9 w-9 place-items-center rounded-md border border-hairline-strong bg-card text-ink md:hidden"
              >
                {menuOpen ? '✕' : '☰'}
              </button>
            </div>
          </div>

          {menuOpen && (
            <div className="border-t border-hairline bg-card md:hidden">
              <ul className="px-4 py-2">
                {[...MOBILE_TABS, { to: '/settings', key: 'settings', icon: '⌥' } as const].map((m) => (
                  <li key={m.key}>
                    <NavLink
                      to={m.to}
                      end={'exact' in m && m.exact}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium',
                          isActive ? 'bg-canvas-soft text-ink' : 'text-body',
                        )
                      }
                    >
                      <span className="font-mono text-base">{m.icon}</span>
                      {t(`nav.${m.key}`)}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </header>
      )}

      {/* ───────── Main ───────── */}
      <main className={clsx('flex-1', !fullscreen && 'pb-20 md:pb-0')}>
        <div className="mx-auto w-full max-w-content">
          <Outlet />
        </div>
      </main>

      {/* ───────── Mobile bottom tabs ───────── */}
      {!fullscreen && (
        <nav
          className="fixed inset-x-0 bottom-0 z-20 border-t border-hairline bg-canvas md:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <ul className="grid grid-cols-5">
            {MOBILE_TABS.map((tab) => (
              <li key={tab.key}>
                <NavLink
                  to={tab.to}
                  end={'exact' in tab && tab.exact}
                  className={({ isActive }) =>
                    clsx(
                      'flex flex-col items-center justify-center gap-1 py-2.5 text-[12px] font-medium',
                      isActive ? 'text-ink' : 'text-muted',
                    )
                  }
                >
                  <span className="font-mono text-lg leading-none">{tab.icon}</span>
                  <span>{t(`nav.${tab.key}`)}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* ───────── Footer (Cursor 5-col pattern) ───────── */}
      {!fullscreen && (
        <footer className="hidden border-t border-hairline bg-canvas md:block">
          <div className="mx-auto grid w-full max-w-content gap-8 px-10 py-16 md:grid-cols-5">
            <div className="md:col-span-2">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-[22px] text-ink" style={{ fontWeight: 400 }}>
                  {t('brand.wordmarkName')}
                </span>
                <span className="text-primary font-display text-[22px]" style={{ fontWeight: 400 }}>·</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                  {t('brand.wordmarkRegion')}
                </span>
              </div>
              <p className="mt-4 max-w-sm text-body-sm text-body">
                {t('footer.tagline')}
              </p>
              <p className="mt-6 text-caption text-muted-soft">
                {t('footer.copyright')}
              </p>
            </div>
            <FooterCol title={t('footer.service')} links={[
              { to: '/explore', label: t('nav.explore') },
              { to: '/explore?cat=festival', label: t('nav.festivals') },
              { to: '/favorites', label: t('nav.favorites') },
              { to: '/settings', label: t('nav.settings') },
            ]} />
            <FooterCol title={t('footer.data')} links={[
              { to: '#', label: t('footer.apiSource') },
              { to: '#', label: t('footer.mapSource') },
              // 운영 대시보드는 개발자 전용 — 프로덕션(공모전 심사) 빌드에서는 노출하지 않음.
              ...(import.meta.env.DEV
                ? [{ to: '/admin', label: t('footer.adminDashboard') }]
                : []),
            ]} />
            <FooterCol title={t('footer.about')} links={[
              { to: '/settings', label: t('footer.aboutLink') },
              { to: '/settings', label: t('footer.privacyLink') },
              { to: '/settings', label: t('footer.languageLink') },
            ]} />
          </div>
        </footer>
      )}

      <ToastHost />
      <ConfirmHost />
    </div>
  )
}

function FooterCol({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <h4 className="text-eyebrow uppercase text-muted">{title}</h4>
      <ul className="mt-4 space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <NavLink to={l.to} className="text-body-sm text-body hover:text-ink">
              {l.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
