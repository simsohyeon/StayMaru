import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import TopBar from '@/components/TopBar'
import RelatedSpots from '@/components/RelatedSpots'
import Thumbnail from '@/components/Thumbnail'
import { fetchGyeongbukAwardPhotos, type AwardPhoto } from '@/api/photoAwards'
import { SIGUNGUS } from '@/constants/sigungu'
import { useSettings } from '@/stores/settings'
import type { Lang } from '@/types/domain'

/**
 * 경북 발견 페이지.
 *  ① 빅데이터가 주목한 관광지 (TarRlteService1, 시군 선택)
 *  ② 경북의 절경 — 사진으로 미리 보는 경북 풍경 (PhokoAwrdService, 경북만 필터)
 *
 * 방문자 통계는 화면에 표로 노출하지 않는다 — 해당 데이터(DataLab)는 코스 자동 생성의
 * 숨은지역 점수(lib/visitorIndex)로 직접 사용되어, 표가 아니라 추천 결과에 녹아든다.
 */
export default function Insights() {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const [pickedSigungu, setPickedSigungu] = useState<number>(11) // 안동 기본
  const [photos, setPhotos] = useState<AwardPhoto[]>([])

  useEffect(() => {
    let cancelled = false
    void fetchGyeongbukAwardPhotos(lang).then((list) => {
      if (!cancelled) setPhotos(list)
    })
    return () => {
      cancelled = true
    }
  }, [lang])

  return (
    <div className="bg-canvas">
      <TopBar back />

      {/* ── Hero ── */}
      <section className="px-5 pt-10 pb-8 md:px-10 md:pt-16 md:pb-10">
        <div className="max-w-3xl">
          <p className="eyebrow">{t('bigdata.insightsEyebrow')}</p>
          <h1 className="mt-4 font-display text-display-lg md:text-display-mega text-ink break-keep">
            {t('bigdata.insightsTitle')}
          </h1>
          <p className="mt-5 max-w-2xl text-body-md text-body break-keep">
            {t('bigdata.insightsSubtitle')}
          </p>
        </div>
      </section>

      {/* ── ① 빅데이터가 주목한 관광지 (시군 선택) ── */}
      <section className="px-5 pb-section md:px-10 border-t border-hairline pt-10">
        <p className="eyebrow">{t('bigdata.popularSpotsTitle')}</p>
        <p className="mt-2 text-body-sm text-muted break-keep">{t('bigdata.popularSpotsHint')}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {SIGUNGUS.map((sg) => (
            <button
              key={sg.code}
              type="button"
              onClick={() => setPickedSigungu(sg.code)}
              aria-pressed={pickedSigungu === sg.code}
              className={clsx(
                'rounded-pill border px-3 h-8 text-sm transition-colors',
                pickedSigungu === sg.code
                  ? 'border-ink bg-ink text-canvas'
                  : 'border-hairline-strong bg-card text-ink hover:bg-canvas-soft',
              )}
            >
              {sg[lang as Lang]}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <RelatedSpots key={pickedSigungu} sigunguCode={pickedSigungu} limit={12} showWhenEmpty />
        </div>
      </section>

      {/* ── ② 경북의 절경 — 사진으로 미리 보는 경북 (데이터 있을 때만 노출) ── */}
      {photos.length > 0 && (
        <section className="px-5 pb-section md:px-10 border-t border-hairline pt-10">
          <div>
            <p className="eyebrow">{t('bigdata.awardsTitle')}</p>
            <p className="mt-2 text-body-sm text-muted break-keep">{t('bigdata.awardsHint')}</p>
          </div>

          <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {photos.map((p) => (
              <li key={p.id} className="card overflow-hidden">
                <div className="aspect-[4/3] w-full overflow-hidden">
                  <Thumbnail src={p.thumbnail} alt={p.title} category="attraction" />
                </div>
                <div className="space-y-1 p-3.5">
                  <p className="truncate text-sm font-medium text-ink">{p.title}</p>
                  <p className="truncate text-caption text-muted">{p.place}</p>
                  {p.photographer && (
                    <p className="truncate text-caption text-muted-soft">ⓒ {p.photographer}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-caption text-muted-soft break-keep">
            {t('bigdata.awardsSource')}
          </p>
        </section>
      )}
    </div>
  )
}
