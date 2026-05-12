import { useEffect, useMemo, useState } from 'react'
import { loadEvents } from '../data/load'
import type { EnrichedEvent } from '../data/types'
import { keywordSearch } from '../data/search'
import { EventCard } from '../components/EventCard'
import { useUrlParam, useUrlSet } from '../lib/urlState'

function topTopics(events: EnrichedEvent[], n: number): string[] {
  const counts = new Map<string, number>()
  for (const e of events) {
    for (const t of e.topics) {
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([t]) => t)
}

export default function SearchRoute() {
  const [events, setEvents] = useState<EnrichedEvent[]>([])
  const [query, setQuery] = useUrlParam('q', '')
  const [activeTopics, setActiveTopics] = useUrlSet('topics')

  useEffect(() => {
    loadEvents().then(setEvents)
  }, [])

  const topicChips = useMemo(() => topTopics(events, 12), [events])

  const results = useMemo(() => {
    const base = keywordSearch(events, query)
    if (activeTopics.size === 0) return base
    return base.filter((e) => e.topics.some((t) => activeTopics.has(t)))
  }, [events, query, activeTopics])

  const toggleTopic = (t: string) => {
    const next = new Set(activeTopics)
    if (next.has(t)) next.delete(t)
    else next.add(t)
    setActiveTopics(next)
  }

  return (
    <section className="mx-auto h-full max-w-md overflow-y-auto">
      <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur">
        <div className="px-4 pb-3 pt-5">
          <h1 className="text-2xl font-semibold">Sök</h1>
          <p className="mt-1 text-xs text-[var(--color-fg-dim)]">
            {events.length > 0 &&
              (query.trim() || activeTopics.size > 0
                ? `${results.length} träffar`
                : `${events.length} event`)}
          </p>
        </div>
        <div className="px-4 pb-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök titel, ämne, talare …"
            className="w-full rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm placeholder:text-[var(--color-fg-dim)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </div>
        {topicChips.length > 0 && (
          <div className="flex gap-1 overflow-x-auto px-4 pb-3 text-xs">
            {topicChips.map((t) => {
              const active = activeTopics.has(t)
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTopic(t)}
                  className={`rounded-full px-3 py-1.5 whitespace-nowrap ${
                    active
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'bg-[var(--color-surface)] text-[var(--color-fg-dim)]'
                  }`}
                >
                  {t}
                </button>
              )
            })}
          </div>
        )}
      </header>

      <ul className="space-y-2 p-4">
        {results.slice(0, 50).map((e) => (
          <li key={e.id}>
            <EventCard event={e} />
          </li>
        ))}
        {events.length > 0 && results.length === 0 && (
          <li className="rounded-lg bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-fg-dim)]">
            Inga träffar. Prova ett annat sökord eller rensa filtren.
          </li>
        )}
        {results.length > 50 && (
          <li className="pt-2 text-center text-xs text-[var(--color-fg-dim)]">
            +{results.length - 50} fler …
          </li>
        )}
      </ul>
    </section>
  )
}
