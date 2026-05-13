import { useEffect, useMemo, useState } from 'react'
import { loadEvents } from '../data/load'
import type { EnrichedEvent } from '../data/types'
import { useSchedule } from '../store/schedule'

export function useSavedEvents(): EnrichedEvent[] {
  const [events, setEvents] = useState<EnrichedEvent[]>([])
  const savedIds = useSchedule((s) => s.savedIds)

  useEffect(() => {
    loadEvents().then(setEvents)
  }, [])

  return useMemo(
    () => events.filter((e) => savedIds.includes(e.id)),
    [events, savedIds],
  )
}
