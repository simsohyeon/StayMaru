import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { useCourses } from '@/stores/courses'
import { useSettings } from '@/stores/settings'
import { PROFILE_LABELS } from '@/constants/categories'
import TopBar from '@/components/TopBar'
import CategoryBadge from '@/components/CategoryBadge'
import KakaoMap from '@/components/KakaoMap'
import Thumbnail from '@/components/Thumbnail'
import { encodeShare, shareOrCopy, toastForShareResult } from '@/lib/share'
import { useToasts } from '@/stores/toasts'
import { calcSlowIndex } from '@/lib/slowIndex'
import {
  segmentCarMinutes,
  segmentTransitMinutes,
  totalCarMinutes,
  totalTransitMinutes,
} from '@/lib/travelTime'

export default function CourseResult() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const lang = useSettings((s) => s.lang)
  const course = useCourses((s) => s.current)
  const save = useCourses((s) => s.save)
  const setCurrent = useCourses((s) => s.setCurrent)
  const saved = useCourses((s) => s.saved)
  const isSaved = course ? saved.some((c) => c.id === course.id) : false
  const pushToast = useToasts((s) => s.show)

  if (!course) {
    return (
      <div className="bg-canvas">
        <TopBar back />
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center px-5">
          <p className="text-body-md text-muted">{t('course.empty')}</p>
          <button type="button" className="btn-primary" onClick={() => nav('/')}>
            {t('home.generate')}
          </button>
        </div>
      </div>
    )
  }

  // 빈 결과 — generateCourse 가 emptyCourse 를 반환한 경우. 사용자에게 다음 행동 안내.
  if (course.items.length === 0) {
    return (
      <div className="bg-canvas">
        <TopBar back />
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center px-5 py-16">
          <span className="text-5xl" aria-hidden>
            🗺️
          </span>
          <div className="max-w-md space-y-3">
            <h2 className="font-display text-display-sm text-ink">{t('course.emptyItemsTitle')}</h2>
            <p className="text-body-md text-body break-keep">{t('course.emptyItemsBody')}</p>
          </div>
          <button type="button" className="btn-primary" onClick={() => nav('/')}>
            {t('course.regenerateCta')}
          </button>
        </div>
      </div>
    )
  }

  async function handleShare() {
    if (!course) return
    const url = `${location.origin}/course/shared/${encodeShare(course)}`
    // 카카오 Feed 카드용 — 첫 장소 썸네일을 대표 이미지로, 코스 통계를 설명으로.
    const heroImage = course.items[0]?.place.thumbnail
    const description = `${course.items.length}${t('course.visitedUnit')} · ${course.totalDistanceKm}${t('course.km')} · ${course.estimatedTravelMinutes}${t('course.min')}`
    const r = await shareOrCopy({
      title: course.title,
      text: description,
      url,
      imageUrl: heroImage,
    })
    toastForShareResult(r, t, pushToast)
  }

  return (
    <div className="bg-canvas">
      <TopBar
        back
        right={
          <button
            type="button"
            aria-label="share"
            onClick={() => void handleShare()}
            className="font-mono text-xs text-muted hover:text-ink"
          >
            share
          </button>
        }
      />

      <div className="px-5 py-8 md:px-10 md:py-12 space-y-10">
        <header>
          <p className="eyebrow">{t('course.headerEyebrow')}</p>
          <h1 className="mt-3 text-display-lg text-ink">{course.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {course.profile && (
              <span className="badge">{PROFILE_LABELS[course.profile][lang]}</span>
            )}
            {course.hiddenMode && <span className="badge">{t('regions.hiddenBadge')}</span>}
          </div>
        </header>

        {/* stats — 거리, 자차/대중교통 추정, 방문지 */}
        {(() => {
          const distances = course.items.map((it) => it.distanceFromPrevKm)
          const carMin = totalCarMinutes(distances)
          const transitMin = totalTransitMinutes(distances)
          return (
            <div className="card-pad grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat
                label={t('course.distance')}
                value={`${course.totalDistanceKm}`}
                unit={t('course.km')}
              />
              <Stat
                label={`🚗 ${t('course.byCar')}`}
                value={`${carMin}`}
                unit={t('course.min')}
              />
              <Stat
                label={`🚌 ${t('course.byTransit')}`}
                value={`${transitMin}`}
                unit={t('course.min')}
              />
              <Stat
                label={t('course.visited')}
                value={`${course.items.length}`}
                unit={t('course.visitedUnit')}
              />
            </div>
          )
        })()}

        <SlowIndexCard course={course} />

        {/* Map (IDE-pane analog) + List */}
        <div className="grid gap-6 md:grid-cols-[1fr_1.1fr] md:items-start print-list-only">
          <div className="md:sticky md:top-20 print-hide">
            <KakaoMap course={course} className="h-64 w-full md:h-[480px]" />
          </div>

          <ol className="space-y-3 md:col-span-1 print:col-span-2">
            {course.items.map((it) => (
              <li
                key={it.place.id}
                className="card-hover flex gap-4 overflow-hidden p-4 cursor-pointer"
                onClick={() => nav(`/place/${it.place.id}`, { state: { place: it.place } })}
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-ink font-mono text-sm text-canvas">
                  {String(it.order).padStart(2, '0')}
                </div>
                <div className="h-16 w-20 flex-shrink-0 overflow-hidden rounded-md">
                  <Thumbnail src={it.place.thumbnail} alt={it.place.name} category={it.place.category} compact />
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div>
                    <CategoryBadge category={it.place.category} lang={lang} />
                    <div className="mt-1.5 text-title-sm text-ink truncate">{it.place.name}</div>
                  </div>
                  {it.order > 1 && (
                    <p className="font-mono text-[11px] text-muted whitespace-nowrap">
                      +{it.distanceFromPrevKm}{t('course.km')}
                      <span className="mx-1.5 text-muted-soft">·</span>
                      🚗 {segmentCarMinutes(it.distanceFromPrevKm)}m
                      <span className="mx-1.5 text-muted-soft">·</span>
                      🚌 {segmentTransitMinutes(it.distanceFromPrevKm)}m
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* actions */}
        <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-6 print-hide">
          <button type="button" className="btn-secondary" onClick={() => nav('/course/map')}>
            {t('course.viewMap')}
          </button>
          <button type="button" className="btn-secondary" onClick={() => nav('/course/edit')}>
            {t('course.edit')}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => window.print()}
            title={t('course.pdfHint')}
          >
            📄 {t('course.savePdf')}
          </button>
          <span className="font-mono text-[11px] text-muted-soft hidden md:inline">
            {t('course.pdfHint')}
          </span>
          <button
            type="button"
            className={isSaved ? 'btn-secondary' : 'btn-download'}
            onClick={() => {
              save(course)
              setCurrent(course)
            }}
          >
            {isSaved ? '✓ ' + t('course.saved') : t('course.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="mt-1 flex items-baseline gap-1">
        <span className="font-display text-display-md text-ink" style={{ fontWeight: 400 }}>{value}</span>
        <span className="text-caption text-muted">{unit}</span>
      </p>
    </div>
  )
}

/**
 * Slow Travel Index 카드 — 쉼마루의 정체성을 시각화한다.
 * 머무름 지수와 한적 지수를 0~10 막대로 보여주고, 종합 라벨(쉼형/균형형/활동형)을 함께 노출.
 */
function SlowIndexCard({ course }: { course: import('@/types/domain').Course }) {
  const { t } = useTranslation()
  const idx = calcSlowIndex(course)
  const labelTone: Record<typeof idx.label, string> = {
    slow: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    balanced: 'bg-amber-50 text-amber-800 border-amber-200',
    busy: 'bg-rose-50 text-rose-800 border-rose-200',
  }
  return (
    <section className="card-pad space-y-5">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="eyebrow">{t('course.slow.eyebrow')}</p>
          <h2 className="mt-1 font-display text-display-sm text-ink">
            {t('course.slow.title')}
          </h2>
          <p className="mt-2 text-caption text-muted max-w-md">
            {t('course.slow.body')}
          </p>
        </div>
        <span
          className={clsx(
            'inline-flex items-center gap-2 rounded-pill border px-3 py-1 text-xs font-semibold',
            labelTone[idx.label],
          )}
        >
          <span className="font-mono uppercase tracking-wider">
            {t(`course.slow.${idx.label}`)}
          </span>
        </span>
      </header>
      <div className="grid gap-5 md:grid-cols-2">
        <ScoreBar
          label={t('course.slow.stayLabel')}
          score={idx.stayScore}
          hint={t('course.slow.stayHint', {
            stay: idx.totalStayMinutes,
            travel: idx.totalTravelMinutes,
          })}
          tone="emerald"
        />
        <ScoreBar
          label={t('course.slow.quietLabel')}
          score={idx.quietScore}
          hint={t('course.slow.quietHint')}
          tone="sky"
        />
      </div>
    </section>
  )
}

function ScoreBar({
  label,
  score,
  hint,
  tone,
}: {
  label: string
  score: number
  hint: string
  tone: 'emerald' | 'sky'
}) {
  const barClass = tone === 'emerald' ? 'bg-emerald-500' : 'bg-sky-500'
  const pct = Math.max(2, Math.min(100, score * 10))
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="eyebrow">{label}</span>
        <span className="font-mono text-title-md text-ink">
          {score.toFixed(1)} <span className="text-caption text-muted">/ 10</span>
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-canvas-soft">
        <div
          className={clsx('h-full rounded-full transition-all', barClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-caption text-muted-soft">{hint}</p>
    </div>
  )
}
