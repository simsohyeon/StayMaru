import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// KHS 시안 레이어 — index.css(@tailwind 출력) 뒤에 와야 한다.
// views-1.css 의 `@apply section-title` 이 .khs 문맥 규칙까지 복제해
// components 층에 동일 특정도로 재출력하므로, 순서로 이겨야 한다.
import './styles/khs.css'
import './styles/khs-desktop.css' // PC 전용 KHS 레이아웃 클론 (≥1024px)
import './styles/khs-page.css' // PC 전용 KHS 하위 페이지(탭 화면) 레이아웃
import './styles/khs-themes.css' // PC 전용 KHS 테마 콘텐츠 페이지
import './styles/khs-mobile.css' // 모바일(<1024px) KHS 레이아웃 — 맨 뒤에 로드
import './i18n'
import './lib/pwaInstall' // beforeinstallprompt 를 React 마운트 이전부터 캡처
import { useContent } from './stores/content'
import App from './App.tsx'

// 운영자가 /admin 에서 올린 테마 코스를 받아 둔다. 실패해도 기본 코스로 그리므로 기다리지 않는다.
void useContent.getState().hydrate()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
