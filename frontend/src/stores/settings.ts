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

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      lang: 'ko',
      hiddenMode: false,
      profile: undefined,
      setLang: (l) => set({ lang: l }),
      setHiddenMode: (v) => set({ hiddenMode: v }),
      setProfile: (p) => set({ profile: p }),
    }),
    { name: 'shimmaru.settings.v1' },
  ),
)
