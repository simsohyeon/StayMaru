import { CATEGORY_MAP } from '@/constants/categories'
import type { CategoryId, Lang } from '@/types/domain'

interface Props {
  category: CategoryId
  lang: Lang
}

export default function CategoryBadge({ category, lang }: Props) {
  const c = CATEGORY_MAP[category]
  return (
    <span className="badge-soft">
      <span
        className="category-badge__dot"
        style={{ backgroundColor: c.markerColor }}
        aria-hidden
      />
      <span>{c.label[lang]}</span>
    </span>
  )
}
