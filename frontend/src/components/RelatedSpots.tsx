import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  fetchRelatedByArea,
  fetchRelatedByKeyword,
  type BigDataResult,
  type BigDataStatus,
  type RelatedSpot,
} from '@/api/bigdata'
import { useSettings } from '@/stores/settings'

/**
 * 빅데이터 기반 "함께 찾은 곳" 연관 추천 (TarRlteService1).
 *
 *  - keyword 모드: 특정 관광지명으로 함께 본/방문한 관광지 (PlaceDetail).
 *  - sigunguCode 모드: 해당 시군에서 빅데이터가 주목한 관광지.
 *
 * 데이터가 없거나(미구독·빈응답·에러) showWhenEmpty=false 면 아무것도 렌더하지 않아
 * 화면이 깔끔하게 유지된다. 가짜 데이터는 절대 만들지 않는다.
 * (활용신청 후 자동으로 채워진다 — 데이터 활용도 심사 포인트.)
 */
export default function RelatedSpots({
  keyword,
  sigunguCode,
  limit = 8,
  showWhenEmpty = false,
}: {
  keyword?: string
  sigunguCode?: number
  limit?: number
  showWhenEmpty?: boolean
}) {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const [spots, setSpots] = useState<RelatedSpot[]>([])
  const [status, setStatus] = useState<BigDataStatus | 'loading'>('loading')
  const [baseYm, setBaseYm] = useState<string | undefined>()

  useEffect(() => {
    let cancelled = false
    async function run() {
      setStatus('loading')
      const req: Promise<BigDataResult<RelatedSpot>> = keyword
        ? fetchRelatedByKeyword(keyword, lang, limit, sigunguCode)
        : sigunguCode
          ? fetchRelatedByArea(sigunguCode, lang, limit)
          : Promise.resolve({ items: [], status: 'empty' })
      const res = await req
      if (cancelled) return
      setSpots(res.items)
      setStatus(res.status)
      setBaseYm(res.baseYm)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [keyword, sigunguCode, lang, limit])

  if (status === 'loading') {
    return (
      <section className="related-spots">
        <p className="eyebrow">{t('bigdata.relatedTitle')}</p>
        <div className="related-spots__skeletons" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="related-spots__skeleton animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  if (spots.length === 0) {
    if (!showWhenEmpty) return null
    // 인사이트 페이지 등에서는 활용신청 안내를 노출한다.
    return (
      <section className="related-spots">
        <p className="eyebrow">{t('bigdata.relatedTitle')}</p>
        <p className="related-spots__empty">
          {status === 'not-subscribed'
            ? t('bigdata.notSubscribed')
            : t('bigdata.empty')}
        </p>
      </section>
    )
  }

  return (
    <section className="related-spots">
      <div className="related-spots__head">
        <p className="eyebrow">{t('bigdata.relatedTitle')}</p>
        <span className="related-spots__source">
          {t('bigdata.sourceTag')}
          {baseYm ? ` · ${baseYm.slice(0, 4)}.${baseYm.slice(4, 6)}` : ''}
        </span>
      </div>
      <p className="related-spots__hint">{t('bigdata.relatedHint')}</p>
      <ul className="related-spots__list">
        {spots.map((s) => (
          <li key={`${s.rank}-${s.name}`}>
            <Link
              to={`/explore?q=${encodeURIComponent(s.name)}`}
              className="group related-spots__chip"
            >
              <span className="related-spots__rank group-hover:text-primary">
                {String(s.rank).padStart(2, '0')}
              </span>
              <span className="related-spots__name">{s.name}</span>
              {s.categoryName && (
                <span className="related-spots__cat">{s.categoryName}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
