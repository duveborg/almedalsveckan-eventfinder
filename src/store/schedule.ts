import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ScheduleState {
  savedIds: string[]
  toggle: (id: string) => void
  has: (id: string) => boolean
  clear: () => void
  bulkAdd: (ids: string[]) => number
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
      bulkAdd: (ids) => {
        const existing = new Set(get().savedIds)
        const fresh: string[] = []
        for (const id of ids) {
          if (!existing.has(id)) {
            existing.add(id)
            fresh.push(id)
          }
        }
        if (fresh.length === 0) return 0
        set((s) => ({ savedIds: [...s.savedIds, ...fresh] }))
        return fresh.length
      },
    }),
    { name: 'almedalen.schedule' },
  ),
)
