import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '@/stores/settings'
import type { Lang } from '@/types/domain'

const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: 'ko', label: '한국어', short: 'KO' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'ja', label: '日本語', short: 'JA' },
  { code: 'zh', label: '中文', short: 'ZH' },
]

export default function LangSwitch() {
  const { i18n } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const setLang = useSettings((s) => s.setLang)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0]

  function pick(l: Lang) {
    setLang(l)
    void i18n.changeLanguage(l)
    setOpen(false)
  }

  return (
    <div ref={ref} className="lang-switch">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="lang-switch__toggle"
      >
        <span>{current.short}</span>
        <span className="lang-switch__caret">▾</span>
      </button>
      {open && (
        <div className="lang-switch__menu">
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => pick(l.code)}
              className={`lang-switch__item ${
                lang === l.code ? 'lang-switch__item--active' : 'lang-switch__item--inactive'
              }`}
            >
              <span>{l.label}</span>
              <span className="lang-switch__short">{l.short}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
