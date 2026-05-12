import { create } from 'zustand'

export type LocationStatus =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unsupported'
  | 'error'

interface LocationState {
  coords: { lat: number; lng: number; accuracy: number } | null
  status: LocationStatus
  error: string | null
  request: () => void
}

export const useLocation = create<LocationState>()((set, get) => ({
  coords: null,
  status: 'idle',
  error: null,
  request: () => {
    if (get().status === 'requesting') return
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      set({ status: 'unsupported' })
      return
    }
    set({ status: 'requesting', error: null })
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        set({
          coords: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
          status: 'granted',
          error: null,
        }),
      (err) => {
        set({
          status: err.code === err.PERMISSION_DENIED ? 'denied' : 'error',
          error: err.message,
        })
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
  },
}))
