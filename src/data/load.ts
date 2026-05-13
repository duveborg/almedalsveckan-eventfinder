import type { EnrichedEvent, EventsFile } from './types'
import eventsUrl from './generated/events.json?url'

let cache: Promise<EnrichedEvent[]> | null = null
let resolved: EnrichedEvent[] | null = null

export function loadEvents(): Promise<EnrichedEvent[]> {
  if (!cache) {
    cache = fetch(eventsUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`events.json: ${r.status}`)
        return r.json() as Promise<EventsFile>
      })
      .then((d) => {
        resolved = d.events
        return d.events
      })
  }
  return cache
}

export function getEventsSync(): EnrichedEvent[] | null {
  return resolved
}
