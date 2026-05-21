import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
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
    <section className="px-5 pb-section md:px-10">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{t('curated.eyebrow')}</p>
          <h2 className="mt-1 font-display text-display-sm text-ink md:text-display-md">
            {t('curated.title')}
          </h2>
          <p className="mt-2 max-w-xl text-body-sm text-body">{t('curated.subtitle')}</p>
        </div>
      </header>

      <ul className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
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
                className="group card-hover h-full w-full text-left overflow-hidden"
              >
                <div
                  className="h-2 w-full"
                  style={{ backgroundColor: c.accent }}
                  aria-hidden
                />
                <div className="p-5 md:p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    {c.themes.slice(0, 3).map((tid) => {
                      const def = CATEGORIES.find((x) => x.id === tid)
                      if (!def) return null
                      return (
                        <span
                          key={tid}
                          title={def.label[lang]}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-canvas-soft text-base"
                          aria-label={def.label[lang]}
                        >
                          {def.emoji}
                        </span>
                      )
                    })}
                    <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.16em] text-muted-soft">
                      {c.badge}
                    </span>
                  </div>

                  <h3 className="text-title-md text-ink break-keep group-hover:text-primary transition-colors">
                    {tr.title}
                  </h3>
                  <p className="text-body-sm text-body line-clamp-3 break-keep">{tr.desc}</p>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-hairline">
                    <span className="badge-soft">{PROFILE_LABELS[c.profile][lang]}</span>
                    <span className="badge-soft">{t(`duration.${durKey(c.duration)}`)}</span>
                    {sgNames && (
                      <span className="font-mono text-caption text-muted truncate">{sgNames}</span>
                    )}
                    <span
                      className={clsx(
                        'ml-auto font-mono text-caption text-muted-soft group-hover:text-primary transition-colors',
                      )}
                    >
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
