import { create } from 'zustand'
import type { LatLng } from '@/types/domain'

interface LocationState {
  current?: LatLng
  status: 'idle' | 'loading' | 'granted' | 'denied' | 'error'
  request: () => Promise<void>
}

export const useLocation = create<LocationState>()((set) => ({
  current: undefined,
  status: 'idle',
  request: async () => {
    if (!('geolocation' in navigator)) {
      set({ status: 'error' })
      return
    }
    set({ status: 'loading' })
    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          set({
            current: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            status: 'granted',
          })
          resolve()
        },
        () => {
          set({ status: 'denied' })
          resolve()
        },
        { enableHighAccuracy: false, timeout: 6000, maximumAge: 5 * 60 * 1000 },
      )
    })
  },
}))
