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
    <div className="course-map">
      <button
        type="button"
        className="course-map__close"
        onClick={() => nav(-1)}
        aria-label={t('common.close')}
      >
        ← {t('common.close')}
      </button>

      <KakaoMap
        course={course}
        highlightedId={highlightedId}
        className="course-map__map"
      />

      <div className="course-map__dock">
        <div className="course-map__strip scrollbar-hide">
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
              className="card course-map__card"
            >
              <div className="course-map__num">
                {String(it.order).padStart(2, '0')}
              </div>
              <div className="course-map__info">
                <CategoryBadge category={it.place.category} lang={lang} />
                <div className="course-map__name">{it.place.name}</div>
                <p className="course-map__addr">{it.place.address}</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    nav(`/place/${it.place.id}`, { state: { place: it.place } })
                  }}
                  className="course-map__detail"
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
