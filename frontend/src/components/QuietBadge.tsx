import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { loadVisitorBoost, quietRankFor } from '@/lib/visitorIndex'
import { LeafIcon } from '@/components/icons'

/**
 * 장소 상세 — 해당 시군의 데이터랩 한적 순위 pill.
 * "이 장소가 얼마나 숨은 곳인가"를 실방문자 데이터로 보여주고 /insights 로 연결한다.
 * DataLab 미구독/미로드면 조용히 숨김 (graceful).
 */
export default function QuietBadge({ sigunguCode }: { sigunguCode?: number }) {
  const { t } = useTranslation()
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

  if (!rank) return null
  const isGem = rank.rank <= 3
  return (
    <Link
      to="/insights"
      className={clsx('quiet-badge', isGem && 'quiet-badge--gem')}
      title={t('insights.title')}
    >
      <LeafIcon aria-hidden width={13} height={13} />
      {t('insights.placeQuietRank', { rank: rank.rank, total: rank.total })}
      {isGem && <em className="quiet-badge__gem">{t('insights.gemBadge')}</em>}
    </Link>
  )
}
