import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

/**
 * KHS 하위 페이지 상단 — `nav.breadcrumb` 재현.
 *
 * 원본 계측 (digital.khs.go.kr/heri/heri.do):
 *   nav.breadcrumb 1400×77 · padding 32px 0 0 · @y133(고정 헤더 바로 아래)
 *   .breadcrumb-t-wrap : h2.breadcrumb-title 32px/45 (원본의 아이콘 슬롯은 두지 않는다)
 *   ol : 홈 › 상위메뉴 › 현재  — 우측 정렬
 *
 * 데스크톱 전용. 모바일에서는 CSS 로 숨고 각 페이지의 기존 TopBar 가 그대로 쓰인다.
 */
export default function KhsPageHeader({
  title,
  trail,
  action,
}: {
  title: string
  /** 홈 다음에 오는 경로들. 마지막 항목이 현재 위치가 된다. */
  trail: { label: string; to?: string }[]
  /** 제목 바로 옆에 붙는 액션 (상세 페이지의 찜 별 등). */
  action?: React.ReactNode
}) {
  const { t } = useTranslation()
  // '홈 › 현재화면' 뿐인 경로는 바로 위 제목을 되풀이할 뿐이라, 좁은 화면에서는 숨긴다.
  // (상세처럼 상위 화면이 끼어 있는 경로는 위로 올라갈 길이라 그대로 둔다.)
  const echoesTitle = trail.length === 1 && trail[0].label === title
  return (
    <nav className="khs-breadcrumb" aria-label={t('khs.breadcrumb')}>
      <div className="khs-inner khs-breadcrumb__inner">
        <div className="khs-breadcrumb-t-wrap">
          <h2 className="khs-breadcrumb__title">{title}</h2>
          {action}
        </div>
        <ol className={clsx('khs-breadcrumb__trail', echoesTitle && 'khs-breadcrumb__trail--echo')}>
          <li>
            <Link to="/">{t('nav.home')}</Link>
          </li>
          {trail.map((c, i) => (
            <li key={c.label} className={i === trail.length - 1 ? 'is-current' : undefined}>
              {c.to && i !== trail.length - 1 ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}
            </li>
          ))}
        </ol>
      </div>
    </nav>
  )
}
