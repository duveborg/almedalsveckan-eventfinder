import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ScheduleState {
  savedIds: string[]
  toggle: (id: string) => void
  has: (id: string) => boolean
  clear: () => void
}

export const useSchedule = create<ScheduleState>()(
  persist(
    (set, get) => ({
      savedIds: [],
      has: (id) => get().savedIds.includes(id),
      toggle: (id) =>
        set((s) => ({
          savedIds: s.savedIds.includes(id)
            ? s.savedIds.filter((x) => x !== id)
            : [...s.savedIds, id],
        })),
      clear: () => set({ savedIds: [] }),
    }),
    { name: 'almedalen.schedule' },
  ),
)
