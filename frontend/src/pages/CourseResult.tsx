import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCourses } from '@/stores/courses'
import { useSettings } from '@/stores/settings'
import { PROFILE_LABELS } from '@/constants/categories'
import TopBar from '@/components/TopBar'
import CategoryBadge from '@/components/CategoryBadge'
import KakaoMap from '@/components/KakaoMap'
import Thumbnail from '@/components/Thumbnail'
import { encodeShare, shareOrCopy } from '@/lib/share'
import { toast } from '@/stores/toasts'

export default function CourseResult() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const lang = useSettings((s) => s.lang)
  const course = useCourses((s) => s.current)
  const save = useCourses((s) => s.save)
  const setCurrent = useCourses((s) => s.setCurrent)
  const saved = useCourses((s) => s.saved)
  const isSaved = course ? saved.some((c) => c.id === course.id) : false

  if (!course) {
    return (
      <div className="bg-canvas">
        <TopBar back />
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <p className="text-body-md text-muted">{t('course.empty')}</p>
          <button type="button" className="btn-primary" onClick={() => nav('/')}>
            {t('home.generate')}
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
    if (r === 'copied') toast(t('place.linkCopied'), { type: 'success' })
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
            {course.hiddenMode && <span className="badge">hidden</span>}
          </div>
        </header>

        {/* stats */}
        <div className="card-pad grid grid-cols-3 gap-4">
          <Stat label={t('course.distance')} value={`${course.totalDistanceKm}`} unit={t('course.km')} />
          <Stat label={t('course.time')} value={`${course.estimatedTravelMinutes}`} unit={t('course.min')} />
          <Stat label={t('course.visited')} value={`${course.items.length}`} unit={t('course.visitedUnit')} />
        </div>

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
                    <p className="font-mono text-[11px] text-muted">
                      +{it.distanceFromPrevKm}{t('course.km')}
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
