import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { useSettings } from '@/stores/settings'
import { PASSES } from '@/constants/passes'
import type { JournalEntry } from '@/stores/journal'
import type { CategoryId } from '@/types/domain'

/**
 * 카테고리별 방문 진척률을 도장판처럼 보여준다.
 * Journal 페이지 상단에 노출되어 "다음에 모을 패스" 동기를 만든다.
 */
export default function PassProgress({ entries }: { entries: JournalEntry[] }) {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)

  const counts: Partial<Record<CategoryId, number>> = {}
  for (const e of entries) {
    counts[e.category] = (counts[e.category] ?? 0) + 1
  }

  const completedCount = PASSES.filter((p) => (counts[p.category] ?? 0) >= p.goal).length

  return (
    <section className="pass-progress">
      <header className="pass-progress__header">
        <div>
          <p className="eyebrow">{t('pass.eyebrow')}</p>
          <h2 className="pass-progress__title">
            {t('pass.title')}
          </h2>
          <p className="pass-progress__subtitle">
            {t('pass.subtitle')}
          </p>
        </div>
        <span className="pass-progress__count">
          {t('pass.completedOf', { done: completedCount, total: PASSES.length })}
        </span>
      </header>

      <ul className="pass-progress__grid">
        {PASSES.map((p) => {
          const done = counts[p.category] ?? 0
          const pct = Math.min(100, (done / p.goal) * 100)
          const completed = done >= p.goal
          return (
            <li
              key={p.id}
              className={clsx(
                'pass-progress__item',
                completed ? 'pass-progress__item--done' : 'pass-progress__item--todo',
              )}
            >
              <div className="pass-progress__item-body">
                <span
                  className={clsx(
                    'pass-progress__emoji',
                    completed ? 'pass-progress__emoji--done' : 'pass-progress__emoji--todo',
                  )}
                  aria-hidden
                >
                  {p.emoji}
                </span>
                <div className="pass-progress__info">
                  <div className="pass-progress__row">
                    <p className="pass-progress__label">{p.label[lang]}</p>
                    <span className="pass-progress__nums">
                      {done}/{p.goal}
                    </span>
                  </div>
                  <p className="pass-progress__caption">
                    {p.caption[lang]}
                  </p>
                  <div className="pass-progress__bar">
                    <div
                      className={clsx(
                        'pass-progress__bar-fill',
                        completed ? 'pass-progress__bar-fill--done' : 'pass-progress__bar-fill--todo',
                      )}
                      style={{ width: `${Math.max(2, pct)}%` }}
                    />
                  </div>
                  {completed && (
                    <p className="pass-progress__complete">
                      ✓ {t('pass.complete')}
                    </p>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
