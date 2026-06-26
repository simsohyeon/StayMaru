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
    <div className="page">
      <TopBar back />

      {/* ── Hero ── */}
      <section className="insights__hero">
        <div className="insights__hero-inner">
          <p className="eyebrow">{t('bigdata.insightsEyebrow')}</p>
          <h1 className="insights__title">
            {t('bigdata.insightsTitle')}
          </h1>
          <p className="insights__subtitle">
            {t('bigdata.insightsSubtitle')}
          </p>
        </div>
      </section>

      {/* ── ① 빅데이터가 주목한 관광지 (시군 선택) ── */}
      <section className="insights__section">
        <p className="eyebrow">{t('bigdata.popularSpotsTitle')}</p>
        <p className="insights__hint">{t('bigdata.popularSpotsHint')}</p>

        <div className="insights__chips">
          {SIGUNGUS.map((sg) => (
            <button
              key={sg.code}
              type="button"
              onClick={() => setPickedSigungu(sg.code)}
              aria-pressed={pickedSigungu === sg.code}
              className={clsx(
                'insights__chip',
                pickedSigungu === sg.code
                  ? 'insights__chip--active'
                  : 'insights__chip--inactive',
              )}
            >
              {sg[lang as Lang]}
            </button>
          ))}
        </div>

        <div className="insights__related">
          <RelatedSpots key={pickedSigungu} sigunguCode={pickedSigungu} limit={12} showWhenEmpty />
        </div>
      </section>

      {/* ── ② 경북의 절경 — 사진으로 미리 보는 경북 (데이터 있을 때만 노출) ── */}
      {photos.length > 0 && (
        <section className="insights__section">
          <div>
            <p className="eyebrow">{t('bigdata.awardsTitle')}</p>
            <p className="insights__hint">{t('bigdata.awardsHint')}</p>
          </div>

          <ul className="insights__awards-grid">
            {photos.map((p) => (
              <li key={p.id} className="card insights__award">
                <div className="insights__award-thumb">
                  <Thumbnail src={p.thumbnail} alt={p.title} category="attraction" />
                </div>
                <div className="insights__award-body">
                  <p className="insights__award-title">{p.title}</p>
                  <p className="insights__award-place">{p.place}</p>
                  {p.photographer && (
                    <p className="insights__award-photog">ⓒ {p.photographer}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <p className="insights__awards-source">
            {t('bigdata.awardsSource')}
          </p>
        </section>
      )}
    </div>
  )
}
