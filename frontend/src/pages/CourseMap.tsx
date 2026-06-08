import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCourses } from '@/stores/courses'
import { useSettings } from '@/stores/settings'
import CategoryBadge from '@/components/CategoryBadge'
import KakaoMap from '@/components/KakaoMap'

export default function CourseMap() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const course = useCourses((s) => s.current)
  const lang = useSettings((s) => s.lang)
  const [highlightedId, setHighlightedId] = useState<string | undefined>()

  // 코스가 없으면 홈으로 — 렌더 중 side-effect 대신 effect 에서 네비게이션.
  useEffect(() => {
    if (!course) nav('/')
  }, [course, nav])

  if (!course) return null

  return (
    <div className="relative h-screen w-full bg-canvas">
      <button
        type="button"
        className="absolute left-4 top-4 z-10 inline-flex h-9 items-center rounded-md border border-hairline-strong bg-card px-3 font-mono text-xs text-ink hover:bg-canvas-soft"
        onClick={() => nav(-1)}
        aria-label={t('common.close')}
      >
        ← {t('common.close')}
      </button>

      <KakaoMap
        course={course}
        highlightedId={highlightedId}
        className="absolute inset-0 h-full w-full !rounded-none !border-0"
      />

      <div className="absolute inset-x-0 bottom-0 z-10 pb-5">
        <div className="-mx-1 flex gap-3 overflow-x-auto px-5 scrollbar-hide">
          {course.items.map((it) => (
            <div
              key={it.place.id}
              role="button"
              tabIndex={0}
              onClick={() => setHighlightedId(it.place.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setHighlightedId(it.place.id)
                }
              }}
              className="card flex w-64 flex-shrink-0 gap-3 p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-ink font-mono text-xs text-canvas">
                {String(it.order).padStart(2, '0')}
              </div>
              <div className="min-w-0 flex-1">
                <CategoryBadge category={it.place.category} lang={lang} />
                <div className="mt-1 text-title-sm text-ink truncate">{it.place.name}</div>
                <p className="text-caption text-muted truncate">{it.place.address}</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    nav(`/place/${it.place.id}`, { state: { place: it.place } })
                  }}
                  className="mt-1.5 font-mono text-[11px] text-primary hover:underline"
                >
                  {t('common.viewDetail')} →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
