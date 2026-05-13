import MiniSearch from 'minisearch'
import type { EnrichedEvent } from './types'

let indexCache: { events: EnrichedEvent[]; ms: MiniSearch<EnrichedEvent> } | null = null

export function buildIndex(events: EnrichedEvent[]): MiniSearch<EnrichedEvent> {
  if (indexCache && indexCache.events === events) return indexCache.ms
  const ms = new MiniSearch<EnrichedEvent>({
    fields: ['title', 'searchText', 'topic', 'topic2'],
    storeFields: ['id'],
    idField: 'id',
    searchOptions: {
      boost: { title: 3, topic: 2, topic2: 2 },
      fuzzy: 0.15,
      prefix: true,
    },
    extractField: (event, field) =>
      (event[field as keyof EnrichedEvent] as string) ?? '',
  })
  ms.addAll(events)
  indexCache = { events, ms }
  return ms
}

export function keywordSearch(
  events: EnrichedEvent[],
  query: string,
): EnrichedEvent[] {
  if (!query.trim()) return events
  const ms = buildIndex(events)
  const hits = ms.search(query)
  const byId = new Map(events.map((e) => [e.id, e]))
  return hits
    .map((h) => byId.get(h.id as string))
    .filter((e): e is EnrichedEvent => !!e)
}
