import { Suspense, useState } from 'react'
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
    <div className="app-shell">
      {/* ───────── Global offline banner (conditional) ───────── */}
      <OfflineBanner />

      {/* ───────── Top nav (Cursor pattern: 64px, canvas bg, wordmark left) ───────── */}
      {!fullscreen && (
        <header className="app-shell__header">
          <div className="app-shell__bar">
            {/* Wordmark — 다국어 워드마크 한 줄 */}
            <NavLink to="/" className="app-shell__wordmark">
              <span className="app-shell__wordmark-name" style={{ fontWeight: 400 }}>
                {t('brand.wordmarkName')}
              </span>
              <span className="app-shell__wordmark-dot" style={{ fontWeight: 400 }}>·</span>
              <span className="app-shell__wordmark-region">
                {t('brand.wordmarkRegion')}
              </span>
            </NavLink>

            {/* Desktop menu */}
            <nav className="app-shell__nav">
              <ul className="app-shell__nav-list">
                {HEADER_MENU.map((m) => (
                  <li key={m.key}>
                    <NavLink
                      to={m.to}
                      className={({ isActive }) =>
                        clsx(
                          'app-shell__nav-link',
                          isActive ? 'text-ink' : 'app-shell__nav-link--inactive',
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
            <div className="app-shell__right">
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
                className="btn-primary app-shell__generate"
              >
                {t('home.generate')}
              </button>
              <button
                type="button"
                aria-label={t('common.menu')}
                onClick={() => setMenuOpen((v) => !v)}
                className="app-shell__menu-btn"
              >
                {menuOpen ? '✕' : '☰'}
              </button>
            </div>
          </div>

          {menuOpen && (
            <div className="app-shell__menu">
              <ul className="app-shell__menu-list">
                {[...MOBILE_TABS, { to: '/journal', key: 'journal', icon: '✎' } as const, { to: '/settings', key: 'settings', icon: '⌥' } as const].map((m) => (
                  <li key={m.key}>
                    <NavLink
                      to={m.to}
                      end={'exact' in m && m.exact}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        clsx(
                          'app-shell__menu-link',
                          isActive ? 'app-shell__menu-link--active' : 'app-shell__menu-link--inactive',
                        )
                      }
                    >
                      <span className="app-shell__menu-icon">{m.icon}</span>
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
      <main className={clsx('app-shell__main', !fullscreen && 'app-shell__main--padded')}>
        <div className="app-shell__content">
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      {/* ───────── Mobile bottom tabs ───────── */}
      {!fullscreen && (
        <nav
          className="app-shell__tabs"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <ul className="app-shell__tabs-list">
            {MOBILE_TABS.map((tab) => (
              <li key={tab.key}>
                <NavLink
                  to={tab.to}
                  end={'exact' in tab && tab.exact}
                  className={({ isActive }) =>
                    clsx(
                      'app-shell__tab-link',
                      isActive ? 'app-shell__tab-link--active' : 'app-shell__tab-link--inactive',
                    )
                  }
                >
                  <span className="app-shell__tab-icon">{tab.icon}</span>
                  <span>{t(`nav.${tab.key}`)}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* ───────── Footer (Cursor 5-col pattern) ───────── */}
      {!fullscreen && (
        <footer className="app-shell__footer">
          <div className="app-shell__footer-grid">
            <div className="app-shell__footer-brand">
              <div className="app-shell__footer-wordmark">
                <span className="app-shell__footer-name" style={{ fontWeight: 400 }}>
                  {t('brand.wordmarkName')}
                </span>
                <span className="app-shell__footer-dot" style={{ fontWeight: 400 }}>·</span>
                <span className="app-shell__footer-region">
                  {t('brand.wordmarkRegion')}
                </span>
              </div>
              <p className="app-shell__footer-tagline">
                {t('footer.tagline')}
              </p>
              <p className="app-shell__footer-copyright">
                {t('footer.copyright')}
              </p>
            </div>
            <FooterCol title={t('footer.service')} links={[
              { to: '/explore', label: t('nav.explore') },
              { to: '/festivals', label: t('nav.festivals') },
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

/** 코드 스플리팅된 라우트 청크 로딩 중 보여줄 가벼운 폴백(셸은 유지된 채 본문만 교체). */
function RouteFallback() {
  const { t } = useTranslation()
  return (
    <div
      className="app-shell__fallback"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="app-shell__spinner" />
      <span className="sr-only">{t('common.loading', '로딩 중…')}</span>
    </div>
  )
}

function FooterCol({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <h4 className="app-shell__footer-col-title">{title}</h4>
      <ul className="app-shell__footer-col-list">
        {links.map((l) => (
          <li key={l.label}>
            <NavLink to={l.to} className="app-shell__footer-col-link">
              {l.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
