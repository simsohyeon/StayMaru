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
  // 폰에서는 화면 이름을 제목 한 줄로만 보인다.
  //  - 위로 올라갈 링크가 없는 경로(= 홈 다음이 전부 현재 위치)는 제목을 되풀이할 뿐이라 통째로 숨긴다.
  //  - 상세처럼 상위 화면 링크가 있으면 경로는 남기되, 제목과 겹치는 마지막 칸만 CSS 로 뺀다.
  //    (KHS 레이아웃은 폰에서 상단바를 숨기므로 그 경로가 위로 가는 유일한 길이다.)
  const hasUpLink = trail.some((c, i) => !!c.to && i !== trail.length - 1)
  return (
    <nav className="khs-breadcrumb" aria-label={t('khs.breadcrumb')}>
      <div className="khs-inner khs-breadcrumb__inner">
        <div className="khs-breadcrumb-t-wrap">
          <h2 className="khs-breadcrumb__title">{title}</h2>
          {action}
        </div>
        <ol className={clsx('khs-breadcrumb__trail', !hasUpLink && 'khs-breadcrumb__trail--flat')}>
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
