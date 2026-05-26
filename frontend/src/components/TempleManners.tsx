import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

/**
 * 사찰 방문 매너 가이드 — temple/templestay 카테고리 상세에서 노출.
 * 외국인 관광객이 사찰 진입 시 가장 자주 부딪히는 5가지 페인포인트를
 * 다국어로 정리한다. (한국관광공사 OpenAPI 에는 없는 차별 가치)
 */
export default function TempleManners() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const keys = ['greet', 'shoes', 'photo', 'dress', 'donate', 'meal', 'dawn'] as const

  return (
    <section className="rounded-lg border border-hairline overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 bg-canvas-soft hover:bg-card transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>🪷</span>
          <div className="text-left">
            <p className="eyebrow">{t('manners.eyebrow')}</p>
            <p className="mt-0.5 text-title-sm text-ink">{t('manners.title')}</p>
          </div>
        </div>
        <span
          className={clsx(
            'inline-flex h-7 w-7 items-center justify-center rounded-full bg-card border border-hairline-strong text-xs transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open && (
        <ul className="divide-y divide-hairline">
          {keys.map((k, i) => (
            <li key={k} className="flex gap-4 px-5 py-4">
              <span className="font-mono text-eyebrow text-muted-soft pt-1">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-title-sm text-ink">
                  {t(`manners.items.${k}.title`)}
                </p>
                <p className="mt-1 text-body-sm text-body">
                  {t(`manners.items.${k}.body`)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
