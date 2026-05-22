import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import ko from './locales/ko'
import en from './locales/en'
import ja from './locales/ja'
import zh from './locales/zh'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { ko, en, ja, zh },
    fallbackLng: 'ko',
    supportedLngs: ['ko', 'en', 'ja', 'zh'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'shimmaru-lang',
    },
  })

// 다국어 전환 시 <html lang>을 함께 갱신 — 스크린리더 발음 + SEO hreflang 영향.
function syncDocumentLang(l: string) {
  if (typeof document === 'undefined') return
  // ja → ja, zh → zh-CN (간체 명시) 등 표준 매핑
  const mapped = l === 'zh' ? 'zh-CN' : l
  document.documentElement.lang = mapped
}
syncDocumentLang(i18n.language || 'ko')
i18n.on('languageChanged', syncDocumentLang)

export default i18n
