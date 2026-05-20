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
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline-strong bg-card px-3 font-mono text-xs text-ink hover:bg-canvas-soft"
      >
        <span>{current.short}</span>
        <span className="text-muted-soft">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-40 rounded-md border border-hairline bg-card py-1">
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => pick(l.code)}
              className={`flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-canvas-soft ${
                lang === l.code ? 'text-ink font-medium' : 'text-body'
              }`}
            >
              <span>{l.label}</span>
              <span className="font-mono text-[10px] text-muted-soft">{l.short}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
