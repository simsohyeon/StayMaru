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

export default i18n
