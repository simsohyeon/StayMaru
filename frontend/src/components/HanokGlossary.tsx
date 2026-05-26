import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

/**
 * 한옥 용어집 — hanok 카테고리 상세에서 노출.
 * "처마/대청/누마루" 같은 전통건축 용어를 4개국어 + 발음으로 안내해
 * 외국인 관광객이 공간을 다르게 보도록 만든다.
 */
const TERMS = [
  'cheoma', 'daecheong', 'numaru', 'sarangchae',
  'anchae', 'madang', 'ondol', 'hanji',
  'giwa', 'munsalji',
] as const

export default function HanokGlossary() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <section className="rounded-lg border border-hairline overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 bg-canvas-soft hover:bg-card transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>🏯</span>
          <div className="text-left">
            <p className="eyebrow">{t('hanokTerms.eyebrow')}</p>
            <p className="mt-0.5 text-title-sm text-ink">{t('hanokTerms.title')}</p>
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
        <dl className="grid gap-3 px-5 py-5 md:grid-cols-2">
          {TERMS.map((term) => (
            <div key={term} className="flex gap-4">
              <dt className="font-mono text-sm text-primary pt-0.5 w-24 flex-shrink-0">
                {t(`hanokTerms.items.${term}.romaji`)}
              </dt>
              <dd className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  {t(`hanokTerms.items.${term}.term`)}
                </p>
                <p className="text-caption text-muted">
                  {t(`hanokTerms.items.${term}.gloss`)}
                </p>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
