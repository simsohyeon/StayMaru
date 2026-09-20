import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { loadVisitorBoost, quietRankFor } from '@/lib/visitorIndex'
import { findSigungu } from '@/constants/sigungu'
import { useSettings } from '@/stores/settings'
import { LeafIcon } from '@/components/icons'

/**
 * 장소·축제 상세 메타 줄 — "지역 · 한적한 순 N위 / 22" 필(+ 상위 3 시군이면 '숨은 보석' 필).
 * 한적 지수는 장소가 아니라 시·군 단위(데이터랩 실방문자, 미구독이면 인구밀도 근사)라 지역명을 앞에 둔다.
 * 순위가 아직 없으면 지역명만 보인다. 누르면 /insights 로.
 */
export default function QuietBadge({ sigunguCode }: { sigunguCode?: number }) {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const [rank, setRank] = useState<{ rank: number; total: number } | undefined>()

  useEffect(() => {
    if (!sigunguCode) return
    let cancelled = false
    void loadVisitorBoost().then(() => {
      if (!cancelled) setRank(quietRankFor(sigunguCode))
    })
    return () => {
      cancelled = true
    }
  }, [sigunguCode])

  const sg = sigunguCode ? findSigungu(sigunguCode) : undefined
  if (!sg) return null
  const isGem = !!rank && rank.rank <= 3
  return (
    <>
      <Link to="/insights" className="meta-pill meta-pill--soft" title={t('insights.title')}>
        <LeafIcon aria-hidden width={12} height={12} />
        {sg[lang]}
        {rank && (
          <span className="meta-pill__sub">
            · {t('insights.placeQuietRank', { rank: rank.rank, total: rank.total })}
          </span>
        )}
      </Link>
      {isGem && <span className="meta-pill meta-pill--ink">{t('insights.gemBadge')}</span>}
    </>
  )
}
