import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LangSwitch from '../LangSwitch'
import { SearchIcon, MenuIcon } from '../icons'
import { useSettings } from '@/stores/settings'
import { findSigungu } from '@/constants/sigungu'
import { CATEGORY_MAP } from '@/constants/categories'

/**
 * KHS 공용 크롬 — 고정 헤더(134px) + 푸터(316px).
 *
 * 홈뿐 아니라 탭 화면(탐색·축제·찜·인사이트·설정)도 같은 크롬을 쓰므로
 * AppShell 에서 한 번만 렌더한다. 표시 여부는 CSS(≥1024px) 가 제어한다.
 *
 * 브랜드 슬롯에는 쉼마루 아이덴티티를 넣는다 — 국가유산청 로고·기관명은 쓰지 않는다.
 * 앱 셸 헤더가 KHS 라우트에서 숨겨지므로 언어 전환(LangSwitch)은 여기서 제공한다.
 */

/* ═══════════════════════════════════════════════════════════════════
 * HEADER — 134px (header-top 76 + navigation 58)
 * ═══════════════════════════════════════════════════════════════════ */
export function KhsHeader() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  // 홈 이동은 좌측 로고가 담당하므로 GNB 에 홈 항목을 두지 않는다.
  // match: 현재 위치 표시용 — 하위 화면(장소 상세·축제 상세·찜·코스 등)도 상위 메뉴에 귀속시킨다.
  const GNB = [
    { label: t('khs.gnb.explore'), to: '/explore', match: /^\/(explore|place)(\/|$)/ },
    { label: t('khs.gnb.theme'), to: '/themes', match: /^\/themes(\/|$)/ },
    { label: t('khs.gnb.festival'), to: '/festivals', match: /^\/festivals(\/|$)/ },
    { label: t('khs.gnb.insights'), to: '/insights', match: /^\/insights(\/|$)/ },
    { label: t('khs.gnb.my'), to: '/my', match: /^\/(my|settings|favorites)(\/|$)/ },
  ]
  return (
    <header className="khs-header">
      <div className="khs-header-top">
        <div className="khs-inner khs-header-top__inner">
          <Link to="/" className="khs-logo">
            <span className="khs-logo__mark" aria-hidden />
            <span className="khs-logo__text">{t('appName')}</span>
          </Link>
          {/* 로그인은 쉼마루가 지원하지 않으므로 원본의 로그인 버튼 자리는 두지 않는다. */}
          <div className="khs-header-util">
            <LangSwitch />
            <span className="khs-header-util__divider" aria-hidden />
            <button
              type="button"
              className="khs-btn-all-search"
              aria-label={t('khs.header.searchAria')}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((v) => !v)}
            >
              <SearchIcon className="khs-btn-all-search__icon" />
              <p>{t('khs.header.search')}</p>
            </button>

            {/* 모바일 햄버거 — 원본 .mobile-menu 48×52. PC 에서는 CSS 로 숨는다. */}
            <button
              type="button"
              className="khs-mobile-menu"
              aria-label={t('khs.header.menu')}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MenuIcon className="khs-mobile-menu__icon" />
              <p>{t('khs.header.menu')}</p>
            </button>
          </div>
        </div>
      </div>

      <nav className={menuOpen ? 'khs-navigation is-open' : 'khs-navigation'}>
        <div className="khs-inner khs-navigation__inner">
          <button
            type="button"
            className="khs-navigation__close"
            aria-label={t('khs.header.closeMenu')}
            onClick={() => setMenuOpen(false)}
          >
            ✕
          </button>
          <ul className="khs-gnb">
            {GNB.map((m) => {
              const active = m.match.test(pathname)
              return (
                <li key={m.to}>
                  <Link
                    to={m.to}
                    className={active ? 'khs-gnb__link is-active' : 'khs-gnb__link'}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    {m.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </nav>

      {/* 모바일 드로어 스크림 */}
      <div
        className={menuOpen ? 'khs-nav-scrim is-open' : 'khs-nav-scrim'}
        aria-hidden
        onClick={() => setMenuOpen(false)}
      />

      <KhsSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  )
}

/* ═══════════════════════════════════════════════════════════════════
 * 통합 검색 오버레이 — 원본 `.search-page-wrap.top-search` 재현
 *
 * 계측값 (digital.khs.go.kr, 1440):
 *   wrap      position fixed · inset 0 · z-index 100 · bg rgba(0,0,0,.5)
 *   container bg #fff · padding 60 0 48 · flex column · align center · gap 24
 *             닫힘 상태 transform translateY(-100%)
 *             transition 0.6s cubic-bezier(0.46, 0.01, 0.17, 0.99)
 *   .s-p-top  880×64 · flex gap 12
 *      .input        733×64 · radius 8 · border 1px #3D8B81 · padding 0 16 · input fs 22
 *      .detail-search 135×64 · bg #3D8B81 · #fff · radius 8 · fs 18
 *   .recommend 880×34 · flex gap 24 — title fs18/500 + ul gap 12
 *      li  bg #F4F5F6 · radius 100px · padding 4 12 · button fs 16
 *   .search-close 250×48 · margin-top 24 · radius 8 · border 1px #1E2124 · fs18/500
 *   합계 60+64+24+34+24+24+48+48 = 326
 * ═══════════════════════════════════════════════════════════════════ */

function KhsSearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  // 원본의 추천 검색조건 자리 — 쉼마루 키워드(현재 언어의 지역·카테고리명)로 교체.
  const recommended = [
    findSigungu(11)?.[lang] ?? '',
    CATEGORY_MAP.hanok.label[lang],
    CATEGORY_MAP.templestay.label[lang],
    CATEGORY_MAP.seowon.label[lang],
    CATEGORY_MAP.festival.label[lang],
  ].filter(Boolean)

  // 열릴 때 입력창으로 포커스, Esc 로 닫기 (원본과 동일한 조작감).
  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const submit = (keyword: string) => {
    const k = keyword.trim()
    if (!k) return
    onClose()
    nav(`/explore?q=${encodeURIComponent(k)}`)
  }

  return (
    <div
      className={clsxOpen('khs-search-wrap', open)}
      // 닫힌 동안에는 포커스가 들어가지 않도록 완전히 비활성화
      aria-hidden={!open}
      inert={!open}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="khs-search-container">
        <div className="khs-search-top">
          <div className="khs-search-input">
            <SearchIcon className="khs-search-input__icon" />
            <label htmlFor="khs-search-field" className="sr-only">
              {t('khs.header.searchAria')}
            </label>
            <input
              id="khs-search-field"
              ref={inputRef}
              type="search"
              className="khs-search-field"
              placeholder={t('khs.search.placeholder')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                // 한글 IME 조합 중 Enter 는 state(q) 반영보다 먼저 올 수 있어 DOM 값으로 제출
                if (e.key === 'Enter') submit(e.currentTarget.value)
              }}
            />
            <button
              type="button"
              className="khs-search-go"
              aria-label={t('khs.search.go')}
              onClick={() => submit(q)}
            >
              <SearchIcon className="khs-search-go__icon" />
            </button>
          </div>
          {/* 상세검색 = 카테고리·지역·반경 필터가 있는 탐색 목록.
             코스 생성 모달을 띄우면 "검색"이라는 기대와 어긋나므로 목록으로 보낸다. */}
          <button
            type="button"
            className="khs-detail-search"
            onClick={() => {
              onClose()
              nav('/explore')
            }}
          >
            {t('khs.search.detail')}
          </button>
        </div>

        <div className="khs-recommend">
          <p className="khs-recommend__title">{t('khs.search.recommend')}</p>
          <ul className="khs-recommend__list">
            {recommended.map((r) => (
              <li key={r}>
                <button type="button" onClick={() => submit(r)}>
                  #{r}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <button type="button" className="khs-search-close" onClick={onClose}>
          {t('khs.search.close')}
        </button>
      </div>
    </div>
  )
}

/** clsx 를 새로 끌어오지 않기 위한 2-상태 전용 헬퍼. */
function clsxOpen(base: string, open: boolean) {
  return open ? `${base} is-open` : base
}

/* ═══════════════════════════════════════════════════════════════════
 * FOOTER — 316px
 * ═══════════════════════════════════════════════════════════════════ */
export function KhsFooter() {
  const { t } = useTranslation()
  return (
    <footer className="khs-footer">
      <div className="khs-inner khs-footer__inner">
        {/* 원본 푸터 구성(기관 로고 → 구분선 → 정책 링크 · 저작권)을 쉼마루 아이덴티티로 */}
        <div className="khs-footer__brand">
          <span className="khs-logo__mark" aria-hidden />
          <span className="khs-footer__name">{t('appName')}</span>
        </div>
        <div className="khs-footer__bottom">
          <ul className="khs-footer__links">
            <li>
              <Link to="/settings#about">{t('footer.policy.about')}</Link>
            </li>
            <li>
              <Link to="/settings#privacy">{t('footer.policy.privacy')}</Link>
            </li>
          </ul>
          <p className="khs-footer__copy">{t('footer.copyright', '© StayMaru')}</p>
        </div>
      </div>
    </footer>
  )
}
