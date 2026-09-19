import { NavLink } from 'react-router-dom'

/**
 * KHS 하위 페이지 좌측 레일의 소메뉴 — 같은 GNB 그룹(예: 지원&소식 = 찜·설정)의 화면들을
 * 나열하고 현재 화면을 강조한다. 필터가 없는 화면에서 300px 레일을 비워 두지 않기 위한 것.
 */
export default function KhsSubNav({
  title,
  items,
}: {
  title: string
  items: { label: string; to: string }[]
}) {
  return (
    <aside className="khs-filter-rail">
      <div className="khs-filter-rail__group">
        <span className="khs-filter-rail__label">{title}</span>
        <ul className="khs-subnav">
          {items.map((it) => (
            <li key={it.to}>
              <NavLink to={it.to} className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
                {it.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
