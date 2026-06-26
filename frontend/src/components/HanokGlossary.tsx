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
    <section className="hanok-glossary">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="hanok-glossary__toggle"
      >
        <div className="hanok-glossary__head">
          <span className="hanok-glossary__icon" aria-hidden>🏯</span>
          <div className="hanok-glossary__titles">
            <p className="eyebrow">{t('hanokTerms.eyebrow')}</p>
            <p className="hanok-glossary__title">{t('hanokTerms.title')}</p>
          </div>
        </div>
        <span
          className={clsx(
            'hanok-glossary__chevron',
            open && 'hanok-glossary__chevron--open',
          )}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open && (
        <dl className="hanok-glossary__list">
          {TERMS.map((term) => (
            <div key={term} className="hanok-glossary__item">
              <dt className="hanok-glossary__romaji">
                {t(`hanokTerms.items.${term}.romaji`)}
              </dt>
              <dd className="hanok-glossary__def">
                <p className="hanok-glossary__term">
                  {t(`hanokTerms.items.${term}.term`)}
                </p>
                <p className="hanok-glossary__gloss">
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
