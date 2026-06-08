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
      <section className="border-t border-hairline pt-6">
        <p className="eyebrow">{t('bigdata.relatedTitle')}</p>
        <div className="mt-4 flex flex-wrap gap-2" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="h-8 w-24 animate-pulse rounded-pill bg-canvas-soft" />
          ))}
        </div>
      </section>
    )
  }

  if (spots.length === 0) {
    if (!showWhenEmpty) return null
    // 인사이트 페이지 등에서는 활용신청 안내를 노출한다.
    return (
      <section className="border-t border-hairline pt-6">
        <p className="eyebrow">{t('bigdata.relatedTitle')}</p>
        <p className="mt-3 text-body-sm text-muted break-keep">
          {status === 'not-subscribed'
            ? t('bigdata.notSubscribed')
            : t('bigdata.empty')}
        </p>
      </section>
    )
  }

  return (
    <section className="border-t border-hairline pt-6">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <p className="eyebrow">{t('bigdata.relatedTitle')}</p>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-soft">
          {t('bigdata.sourceTag')}
          {baseYm ? ` · ${baseYm.slice(0, 4)}.${baseYm.slice(4, 6)}` : ''}
        </span>
      </div>
      <p className="mt-2 text-caption text-muted break-keep">{t('bigdata.relatedHint')}</p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {spots.map((s) => (
          <li key={`${s.rank}-${s.name}`}>
            <Link
              to={`/explore?q=${encodeURIComponent(s.name)}`}
              className="group inline-flex items-center gap-2 rounded-pill border border-hairline-strong bg-card px-3.5 h-9 text-sm text-ink hover:border-primary hover:text-primary transition-colors"
            >
              <span className="font-mono text-[10px] text-muted-soft group-hover:text-primary">
                {String(s.rank).padStart(2, '0')}
              </span>
              <span className="truncate max-w-[12rem]">{s.name}</span>
              {s.categoryName && (
                <span className="text-[10px] text-muted-soft">{s.categoryName}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
