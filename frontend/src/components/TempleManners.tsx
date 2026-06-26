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
    <section className="temple-manners">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="temple-manners__toggle"
      >
        <div className="temple-manners__head">
          <span className="temple-manners__icon" aria-hidden>🪷</span>
          <div className="temple-manners__titles">
            <p className="eyebrow">{t('manners.eyebrow')}</p>
            <p className="temple-manners__title">{t('manners.title')}</p>
          </div>
        </div>
        <span
          className={clsx(
            'temple-manners__chevron',
            open && 'temple-manners__chevron--open',
          )}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open && (
        <ul className="temple-manners__list">
          {keys.map((k, i) => (
            <li key={k} className="temple-manners__item">
              <span className="temple-manners__num">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="temple-manners__body">
                <p className="temple-manners__item-title">
                  {t(`manners.items.${k}.title`)}
                </p>
                <p className="temple-manners__item-text">
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
