import { Suspense } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import LangSwitch from './LangSwitch'
import ToastHost from './ToastHost'
import ConfirmHost from './ConfirmHost'
import OfflineBanner from './OfflineBanner'
import { KhsHeader, KhsFooter } from './khs/KhsChrome'
import {
  HomeIcon,
  ExploreIcon,
  FestivalIcon,
  HeartIcon,
  SettingsIcon,
} from './icons'

// 단일 내비게이션 소스 — 상단(데스크탑)·하단(모바일) 메뉴가 항상 동일한 목적지를 쓰도록 한 곳에서 정의.
// 하단 탭바는 4개 전부, 상단 데스크탑 메뉴는 home(워드마크로 대체) 제외 3개를 노출한다.
// 설정(Settings)은 1차 목적지가 아니라 유틸리티 → 헤더 우측 아이콘으로 분리.
// 데이터 인사이트(/insights)는 탭바에서 제외(모바일 6탭 과밀 방지) — 홈 데이터티저·푸터로 진입.
// 아이콘은 유니코드 글리프 대신 인라인 SVG(icons.tsx) — 기기 간 렌더 일관성.
const NAV_ITEMS = [
  { to: '/', key: 'home', Icon: HomeIcon, exact: true },
  { to: '/explore', key: 'explore', Icon: ExploreIcon },
  { to: '/festivals', key: 'festivals', Icon: FestivalIcon },
  { to: '/favorites', key: 'favorites', Icon: HeartIcon },
] as const

// PC 에서 KHS 하위 페이지 레이아웃(고정 헤더 + breadcrumb + 자체 푸터)을 쓰는 라우트.
// 이 목록의 화면은 앱 셸 크롬 대신 KHS 헤더/푸터를 쓴다.
const KHS_PAGE_ROUTES = new Set([
  '/explore',
  '/festivals',
  '/favorites',
  '/my',
  '/insights',
  '/settings',
  '/themes',
])
// 상세 페이지(축제·장소)와 코스 화면(결과·편집·공유·참여)도 같은 크롬 — 동적 세그먼트라 prefix 로 매칭.
// /course/map 은 풀스크린 지도라 제외.
const KHS_PAGE_PREFIX = /^\/(festivals|place)\/.|^\/course(\/(edit|shared\/.+))?$|^\/join\/./
function isKhsPage(pathname: string): boolean {
  return KHS_PAGE_ROUTES.has(pathname) || KHS_PAGE_PREFIX.test(pathname)
}

export default function AppShell() {
  const { t } = useTranslation()
  const location = useLocation()
  const nav = useNavigate()
  const fullscreen = /^\/(course\/map|report)$/.test(location.pathname)

  return (
    // PC 에서 홈은 KHS 클론이 자체 헤더/푸터를 갖는다 → 셸 크롬을 비운다.
    <div
      className={clsx(
        'app-shell',
        location.pathname === '/' && 'app-shell--khs-home',
        isKhsPage(location.pathname) && 'app-shell--khs-page',
      )}
    >
      {/* ───────── Global offline banner (conditional) ───────── */}
      <OfflineBanner />

      {/* ───────── KHS 공용 헤더 (PC 전용 — CSS 가 ≥1024px 에서만 노출) ───────── */}
      {!fullscreen && <KhsHeader />}

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

            {/* Desktop menu — 하단 탭바와 동일한 목적지(home 은 워드마크가 대신하므로 제외) */}
            <nav className="app-shell__nav">
              <ul className="app-shell__nav-list">
                {NAV_ITEMS.filter((m) => m.key !== 'home').map((m) => (
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
              {/* 설정 — 1차 목적지가 아닌 유틸리티라 톱니 아이콘으로. 모바일에선 하단 탭바가 메인 내비게이션. */}
              <NavLink
                to="/settings"
                aria-label={t('nav.settings')}
                className={({ isActive }) =>
                  clsx(
                    'app-shell__settings-btn',
                    isActive && 'app-shell__settings-btn--active',
                  )
                }
              >
                <SettingsIcon className="h-[18px] w-[18px]" />
              </NavLink>
            </div>
          </div>
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
            {NAV_ITEMS.map((tab) => (
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
                  <tab.Icon className="app-shell__tab-icon" />
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
              { to: '/insights', label: t('nav.insights') },
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

      {/* ───────── KHS 공용 푸터 (PC 전용) ───────── */}
      {!fullscreen && <KhsFooter />}

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
