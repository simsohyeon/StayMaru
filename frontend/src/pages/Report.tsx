import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { useJournal } from '@/stores/journal'
import { useSettings } from '@/stores/settings'
import { useToasts } from '@/stores/toasts'
import { computeReport } from '@/lib/report'
import { renderReportCardBlob } from '@/lib/reportCard'
import { loadVisitorBoost, quietRankFor } from '@/lib/visitorIndex'
import { CATEGORY_MAP } from '@/constants/categories'
import { SIGUNGUS } from '@/constants/sigungu'
import { GiftIcon, CloseIcon, ExploreIcon, LeafIcon, ImageIcon } from '@/components/icons'
import type { Lang } from '@/types/domain'

/**
 * SCR — 쉼마루 Wrapped (/report). 풀스크린 스토리 5장.
 *
 * 여행 기록을 분석해 정복·취향·페르소나를 연출한다. 탭(오른쪽 2/3)=다음,
 * 탭(왼쪽 1/3)=이전, 상단 IG 스타일 진행 바. 마지막 장에서 공유 카드 저장.
 * 기록이 없으면 안내 + Journal 링크.
 */
const SLIDES = ['intro', 'conquest', 'taste', 'persona', 'finale'] as const
type Slide = (typeof SLIDES)[number]

export default function Report() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const lang = useSettings((s) => s.lang) as Lang
  const entries = useJournal((s) => s.entries)
  const pushToast = useToasts((s) => s.show)
  const [idx, setIdx] = useState(0)
  const [gemReady, setGemReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadVisitorBoost().then(() => {
      if (!cancelled) setGemReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const report = useMemo(
    () => computeReport(entries, gemReady ? quietRankFor : undefined),
    [entries, gemReady],
  )

  const topDef = report.topCategory ? CATEGORY_MAP[report.topCategory] : undefined
  const personaTitle = t(`report.persona.${report.persona}.title`)
  const personaBody = t(`report.persona.${report.persona}.body`)
  const visitedNames = useMemo(
    () =>
      SIGUNGUS.filter((sg) => report.sigunguCodes.includes(sg.code))
        .map((sg) => sg[lang as 'ko' | 'en' | 'ja' | 'zh'])
        .slice(0, 8),
    [report.sigunguCodes, lang],
  )

  // 키보드 내비 (←/→/ESC)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(SLIDES.length - 1, i + 1))
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1))
      if (e.key === 'Escape') nav('/journal')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nav])

  async function handleSaveCard() {
    try {
      const blob = await renderReportCardBlob(
        report,
        {
          brand: t('appName'),
          region: t('brand.wordmarkRegion'),
          personaTitle,
          personaBody,
          statEntries: t('report.statEntries'),
          statConquered: t('report.statConquered'),
          statGems: t('report.statGems'),
          statTop: t('report.statTop'),
          footer: t('report.footer'),
        },
        topDef ? `${topDef.emoji} ${topDef.label[lang as 'ko' | 'en' | 'ja' | 'zh']}` : undefined,
      )
      const file = new File([blob], 'shimmaru-wrapped.png', { type: 'image/png' })
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: personaTitle })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'shimmaru-wrapped.png'
        a.click()
        URL.revokeObjectURL(url)
      }
      pushToast(t('course.cardSaved'), { type: 'success' })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      pushToast(t('course.cardFailed'), { type: 'error' })
    }
  }

  // 기록 없음 — 스토리 대신 안내
  if (entries.length === 0) {
    return (
      <div className="report report--empty">
        <p className="report__empty-emoji" aria-hidden><GiftIcon width={32} height={32} /></p>
        <h1 className="report__empty-title">{t('report.emptyTitle')}</h1>
        <p className="report__empty-body">{t('report.emptyBody')}</p>
        <Link to="/explore" className="btn-primary">{t('journal.exploreCta')} →</Link>
      </div>
    )
  }

  const slide: Slide = SLIDES[idx]
  const isLast = idx === SLIDES.length - 1

  return (
    <div className={clsx('report', `report--${slide}`)}>
      {/* IG 스타일 진행 바 */}
      <div className="report__progress" aria-hidden>
        {SLIDES.map((s, i) => (
          <span key={s} className={clsx('report__seg', i <= idx && 'report__seg--on')} />
        ))}
      </div>
      <button type="button" className="report__close" aria-label={t('common.close')} onClick={() => nav('/journal')}>
        <CloseIcon width={16} height={16} />
      </button>

      {/* 탭 존 — 좌 1/3 이전, 우 2/3 다음 */}
      <button
        type="button"
        className="report__zone report__zone--prev"
        aria-label={t('home.chatbot.back')}
        onClick={() => setIdx((i) => Math.max(0, i - 1))}
      />
      <button
        type="button"
        className="report__zone report__zone--next"
        aria-label={t('home.chatbot.next')}
        onClick={() => !isLast && setIdx((i) => i + 1)}
      />

      <div key={slide} className="report__body animate-fade-up">
        {slide === 'intro' && (
          <>
            <p className="report__eyebrow">{t('report.introEyebrow')}</p>
            <h1 className="report__display">{t('report.introTitle')}</h1>
            <p className="report__big-num">{report.totalEntries}</p>
            <p className="report__caption">{t('report.introCaption', { n: report.totalEntries })}</p>
          </>
        )}

        {slide === 'conquest' && (
          <>
            <p className="report__eyebrow">{t('journal.conquestEyebrow')}</p>
            <p className="report__big-num">
              {report.conquered}
              <span className="report__big-sub">/ {report.totalSigungu}</span>
            </p>
            <h2 className="report__display">{t('report.conquestTitle')}</h2>
            {visitedNames.length > 0 && (
              <p className="report__chips">{visitedNames.join(' · ')}</p>
            )}
          </>
        )}

        {slide === 'taste' && (
          <>
            <p className="report__eyebrow">{t('report.tasteEyebrow')}</p>
            <p className="report__emoji" aria-hidden>
              {(() => { const Icon = topDef?.icon ?? ExploreIcon; return <Icon width={28} height={28} /> })()}
            </p>
            <h2 className="report__display">
              {topDef ? topDef.label[lang as 'ko' | 'en' | 'ja' | 'zh'] : '—'}
            </h2>
            <p className="report__caption">
              {t('report.tasteCaption', { n: report.topCategoryCount })}
            </p>
          </>
        )}

        {slide === 'persona' && (
          <>
            <p className="report__eyebrow">{t('report.personaEyebrow')}</p>
            <h2 className="report__display report__display--accent">{personaTitle}</h2>
            <p className="report__caption">{personaBody}</p>
            {report.gemVisits > 0 && (
              <p className="report__gems"><LeafIcon aria-hidden width={14} height={14} /> {t('journal.conquestGems', { n: report.gemVisits })}</p>
            )}
          </>
        )}

        {slide === 'finale' && (
          <>
            <p className="report__eyebrow">{t('report.finaleEyebrow')}</p>
            <h2 className="report__display">{personaTitle}</h2>
            <p className="report__caption">{t('report.finaleCaption')}</p>
            <div className="report__actions">
              <button type="button" className="btn-primary" onClick={() => void handleSaveCard()}>
                <ImageIcon aria-hidden width={15} height={15} /> {t('report.saveCard')}
              </button>
              <Link to="/insights" className="report__link">
                {t('journal.conquestNext')} →
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
