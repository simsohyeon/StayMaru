import { useTranslation } from 'react-i18next'
import { CURATED_COURSES, type CuratedCourse } from '@/constants/curatedCourses'
import { CATEGORIES, PROFILE_LABELS } from '@/constants/categories'
import { SIGUNGUS } from '@/constants/sigungu'
import { useSettings } from '@/stores/settings'

interface Props {
  /** 카드 클릭 시 호출 — Home 의 빌더 상태를 채우고 #builder 로 스크롤한다. */
  onPick: (c: CuratedCourse) => void
}

/**
 * VisitKorea 의 "추천 여행코스" 대응 섹션.
 * 정적 큐레이션 데이터(constants/curatedCourses.ts) 를 카드 그리드로 노출.
 */
export default function CuratedCourses({ onPick }: Props) {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)

  return (
    <section className="curated-courses">
      <header className="curated-courses__header">
        <div>
          <p className="eyebrow">{t('curated.eyebrow')}</p>
          <h2 className="curated-courses__title">
            {t('curated.title')}
          </h2>
          <p className="curated-courses__subtitle">{t('curated.subtitle')}</p>
        </div>
      </header>

      <ul className="curated-courses__grid">
        {CURATED_COURSES.map((c) => {
          const tr = c.i18n[lang]
          const sgNames = c.sigunguCodes
            .map((code) => SIGUNGUS.find((s) => s.code === code)?.[lang])
            .filter(Boolean)
            .join(' · ')
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPick(c)}
                className="group card-hover curated-courses__card"
              >
                <div
                  className="curated-courses__accent"
                  style={{ backgroundColor: c.accent }}
                  aria-hidden
                />
                <div className="curated-courses__body">
                  <div className="curated-courses__themes">
                    {c.themes.slice(0, 3).map((tid) => {
                      const def = CATEGORIES.find((x) => x.id === tid)
                      if (!def) return null
                      return (
                        <span
                          key={tid}
                          title={def.label[lang]}
                          className="curated-courses__theme"
                          aria-label={def.label[lang]}
                        >
                          {def.emoji}
                        </span>
                      )
                    })}
                    <span className="curated-courses__badge">
                      {c.badge}
                    </span>
                  </div>

                  <h3 className="curated-courses__name group-hover:text-primary">
                    {tr.title}
                  </h3>
                  <p className="curated-courses__desc">{tr.desc}</p>

                  <div className="curated-courses__meta">
                    <span className="badge-soft">{PROFILE_LABELS[c.profile][lang]}</span>
                    <span className="badge-soft">{t(`duration.${durKey(c.duration)}`)}</span>
                    {sgNames && (
                      <span className="curated-courses__sg">{sgNames}</span>
                    )}
                    <span className="curated-courses__apply group-hover:text-primary">
                      {t('curated.apply')} →
                    </span>
                  </div>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function durKey(d: CuratedCourse['duration']): string {
  return d === '1n2d' ? 'n1d2' : d === '2n3d' ? 'n2d3' : d
}
