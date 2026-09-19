import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { router } from './routes'
import { useSettings } from '@/stores/settings'
import './App.css'

export default function App() {
  const { i18n } = useTranslation()
  const lang = useSettings((s) => s.lang)
  // 설정 스토어의 lang 이 단일 출처 — 시작 시(브라우저 감지값과 어긋날 때)와 변경 시 i18n 을 맞춘다.
  useEffect(() => {
    if (i18n.language !== lang) void i18n.changeLanguage(lang)
  }, [i18n, lang])
  return <RouterProvider router={router} />
}
