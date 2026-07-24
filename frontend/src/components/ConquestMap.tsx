import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import GyeongbukSvg from '@/components/IllustratedMap/GyeongbukSvg'
import { MAINLAND_VIEWBOX, SIGUNGU_GEO } from '@/components/IllustratedMap/sigunguGeo'
import { projectMainland } from '@/components/IllustratedMap/mapProjection'
import { SIGUNGUS } from '@/constants/sigungu'
import { loadVisitorBoost, quietRankFor } from '@/lib/visitorIndex'
import { useSettings } from '@/stores/settings'
import type { JournalEntry } from '@/stores/journal'
import type { Lang } from '@/types/domain'
import { WaveIcon, CheckIcon, LeafIcon } from '@/components/icons'

/**
 * 나의 경북 정복 지도 — 여행 기록이 남은 시군에 도장을 찍는 게이미피케이션.
 *
 * - 방문 시군: 주황 도장(✓) + 시군명 라벨 / 미방문: 회색 점.
 * - 진행률 "n / 22 시군" + 숨은 보석(데이터랩 한적 상위 3) 정복 수를 함께 보여
 *   "다음엔 어디를 채울까"라는 재방문 동기를 만든다.
 * - 구 기록(sigunguCode 없음)은 주소 문자열의 시군명 매칭으로 소급 인식.
 * - 울릉군은 본토 밖 — 지도의 점 대신 캡션 칩으로 표시.
 */
const W = MAINLAND_VIEWBOX.width
const H = MAINLAND_VIEWBOX.height

export default function ConquestMap({ entries }: { entries: JournalEntry[] }) {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang) as Lang

  // 방문 시군 집합 — sigunguCode 우선, 없으면 주소에서 시군명 매칭.
  const visited = useMemo(() => {
    const set = new Set<number>()
    for (const e of entries) {
      if (e.sigunguCode) {
        set.add(e.sigunguCode)
        continue
      }
      const hit = SIGUNGUS.find((sg) => e.address?.includes(sg.ko))
      if (hit) set.add(hit.code)
    }
    return set
  }, [entries])

  // 숨은 보석 정복 수 — DataLab 로드 후 계산 (미구독이면 0 → 라인 숨김).
  const [gemDone, setGemDone] = useState(0)
  useEffect(() => {
    let cancelled = false
    void loadVisitorBoost().then(() => {
      if (cancelled) return
      let n = 0
      for (const code of visited) {
        const r = quietRankFor(code)
        if (r && r.rank <= 3) n++
      }
      setGemDone(n)
    })
    return () => {
      cancelled = true
    }
  }, [visited])

  const total = SIGUNGUS.length
  const done = visited.size
  const pct = Math.round((done / total) * 100)
  const ulleungVisited = visited.has(17)

  return (
    <section className="conquest">
      <header className="conquest__header">
        <div>
          <p className="eyebrow">{t('journal.conquestEyebrow')}</p>
          <h2 className="conquest__title">{t('journal.conquestTitle')}</h2>
          <p className="conquest__hint">{t('journal.conquestHint')}</p>
        </div>
        <div className="conquest__score">
          <span className="conquest__score-num">{done}</span>
          <span className="conquest__score-total">/ {total}</span>
        </div>
      </header>

      <div className="conquest__bar-track" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total}>
        <div className="conquest__bar-fill" style={{ width: `${Math.max(2, pct)}%` }} />
      </div>

      <figure className="conquest__map">
        <svg viewBox={`0 0 ${W} ${H}`} className="conquest__svg" role="img" aria-label={t('journal.conquestTitle')}>
          {/* 후퇴형 베이스맵 — 도장(데이터)이 주인공. 일러스트 화풍과의 충돌 제거. */}
          <GyeongbukSvg variant="quiet" />
          {SIGUNGU_GEO.filter((g) => g.code !== 17).map((g) => {
            const { x, y } = projectMainland(g.center)
            const sg = SIGUNGUS.find((s) => s.code === g.code)
            const isVisited = visited.has(g.code)
            return isVisited ? (
              <g key={g.code}>
                <circle cx={x} cy={y} r={22} className="conquest__stamp" />
                <path
                  d={`M${x - 7} ${y} l4.5 4.5 L${x + 8} ${y - 7}`}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <text x={x} y={y - 34} textAnchor="middle" className="conquest__stamp-label">
                  {sg?.[lang as 'ko' | 'en' | 'ja' | 'zh'] ?? ''}
                </text>
              </g>
            ) : (
              <circle key={g.code} cx={x} cy={y} r={9} className="conquest__dot" />
            )
          })}
        </svg>
        <figcaption className="conquest__caption">
          {ulleungVisited && (
            <span className="conquest__ulleung">
              <WaveIcon aria-hidden width={13} height={13} /> {SIGUNGUS.find((s) => s.code === 17)?.[lang as 'ko' | 'en' | 'ja' | 'zh']} <CheckIcon aria-hidden width={13} height={13} />
            </span>
          )}
          {gemDone > 0 && (
            <span className="conquest__gems"><LeafIcon aria-hidden width={13} height={13} /> {t('journal.conquestGems', { n: gemDone })}</span>
          )}
          {done < total && (
            <Link to="/insights" className="conquest__next">
              {t('journal.conquestNext')} →
            </Link>
          )}
        </figcaption>
      </figure>
    </section>
  )
}
