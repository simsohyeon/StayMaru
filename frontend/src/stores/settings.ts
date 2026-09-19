import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CourseProfile, Lang } from '@/types/domain'

interface SettingsState {
  lang: Lang
  hiddenMode: boolean
  profile?: CourseProfile
  setLang: (l: Lang) => void
  setHiddenMode: (v: boolean) => void
  setProfile: (p: CourseProfile | undefined) => void
}

const SUPPORTED: Lang[] = ['ko', 'en', 'ja', 'zh']

/** 첫 방문 기본 언어 — 브라우저 언어가 지원 언어면 그것, 아니면 ko. persist 된 값이 있으면 덮어쓴다. */
function detectLang(): Lang {
  if (typeof navigator === 'undefined') return 'ko'
  const code = (navigator.language || '').slice(0, 2).toLowerCase() as Lang
  return SUPPORTED.includes(code) ? code : 'ko'
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      lang: detectLang(),
      hiddenMode: false,
      profile: undefined,
      setLang: (l) => set({ lang: l }),
      setHiddenMode: (v) => set({ hiddenMode: v }),
      setProfile: (p) => set({ profile: p }),
    }),
    { name: 'shimmaru.settings.v1' },
  ),
)
