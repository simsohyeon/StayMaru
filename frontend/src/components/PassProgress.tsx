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
    <section className="mt-8 rounded-lg border border-hairline bg-canvas-soft px-5 py-5 md:px-7 md:py-7">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="eyebrow">{t('pass.eyebrow')}</p>
          <h2 className="mt-1 font-display text-display-sm text-ink">
            {t('pass.title')}
          </h2>
          <p className="mt-2 text-caption text-muted max-w-prose">
            {t('pass.subtitle')}
          </p>
        </div>
        <span className="font-mono text-xs text-muted-soft">
          {t('pass.completedOf', { done: completedCount, total: PASSES.length })}
        </span>
      </header>

      <ul className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {PASSES.map((p) => {
          const done = counts[p.category] ?? 0
          const pct = Math.min(100, (done / p.goal) * 100)
          const completed = done >= p.goal
          return (
            <li
              key={p.id}
              className={clsx(
                'rounded-md border bg-card px-4 py-3 transition-colors',
                completed ? 'border-emerald-300 bg-emerald-50/40' : 'border-hairline-strong',
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={clsx(
                    'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xl',
                    completed ? 'bg-emerald-100' : 'bg-canvas-soft',
                  )}
                  aria-hidden
                >
                  {p.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-title-sm text-ink truncate">{p.label[lang]}</p>
                    <span className="font-mono text-xs text-muted">
                      {done}/{p.goal}
                    </span>
                  </div>
                  <p className="mt-0.5 text-caption text-muted-soft line-clamp-1">
                    {p.caption[lang]}
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-canvas-soft">
                    <div
                      className={clsx(
                        'h-full rounded-full transition-all',
                        completed ? 'bg-emerald-500' : 'bg-ink',
                      )}
                      style={{ width: `${Math.max(2, pct)}%` }}
                    />
                  </div>
                  {completed && (
                    <p className="mt-2 inline-flex items-center gap-1 rounded-pill bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
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
