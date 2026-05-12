import type { EnrichedEvent, EventsFile } from './types'

let cache: Promise<EnrichedEvent[]> | null = null

export function loadEvents(): Promise<EnrichedEvent[]> {
  if (!cache) {
    cache = fetch('/events.json')
      .then((r) => {
        if (!r.ok) throw new Error(`events.json: ${r.status}`)
        return r.json() as Promise<EventsFile>
      })
      .then((d) => d.events)
  }
  return cache
}
