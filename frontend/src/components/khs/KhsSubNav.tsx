import { Link, useLocation } from 'react-router-dom'

type Item = { label: string; to: string; count?: number; end?: boolean }

/**
 * KHS 하위 페이지 좌측 레일의 소메뉴 — 같은 GNB 그룹(예: 내 여행 = 내 여행 홈·찜·저장 코스·설정)의
 * 화면들을 나열하고 현재 화면을 강조한다. 필터가 없는 화면에서 300px 레일을 비워 두지 않기 위한 것.
 *
 * 활성 판정은 NavLink 대신 직접 한다 — 같은 경로에 쿼리만 다른 항목(/favorites, /favorites?tab=courses)이
 * 있을 때 둘 다 켜지지 않도록, 쿼리가 있는 항목은 쿼리까지 일치해야 하고 없는 항목은 형제가 못 잡은 경우만 켜진다.
 */
export default function KhsSubNav({ title, items }: { title: string; items: Item[] }) {
  const { pathname, search } = useLocation()
  const parsed = items.map((it) => {
    const [path, query = ''] = it.to.split('?')
    const pathHit = it.end ? pathname === path : pathname === path || pathname.startsWith(path + '/')
    return { it, path, query: query ? `?${query}` : '', pathHit }
  })
  const active = parsed.map(({ path, query, pathHit }) =>
    pathHit && (query ? search === query : !parsed.some((o) => o.path === path && o.query && o.query === search)),
  )
  return (
    <aside className="khs-filter-rail">
      <div className="khs-filter-rail__group">
        <span className="khs-filter-rail__label">{title}</span>
        <ul className="khs-subnav">
          {items.map((it, i) => (
            <li key={it.to}>
              <Link to={it.to} className={active[i] ? 'is-active' : undefined} aria-current={active[i] ? 'page' : undefined}>
                {it.label}
                {it.count !== undefined && <span className="khs-subnav__count">{it.count}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
