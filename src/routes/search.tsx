import { useEffect, useMemo, useState } from 'react'
import { getEventsSync, loadEvents } from '../data/load'
import type { EnrichedEvent } from '../data/types'
import { keywordSearch } from '../data/search'
import { EventCard } from '../components/EventCard'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useUrlParam } from '../lib/urlState'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { PageSection } from '../components/PageSection'

export default function SearchRoute() {
  useDocumentTitle('Sök')
  const [events, setEvents] = useState<EnrichedEvent[] | null>(() => getEventsSync())
  const [query, setQuery] = useUrlParam('q', '')

  useEffect(() => {
    if (events) return
    loadEvents().then(setEvents)
  }, [events])

  const results = useMemo(
    () => (events && query.trim() ? keywordSearch(events, query) : []),
    [events, query],
  )

  if (!events) {
    return (
      <PageSection>
        <LoadingSpinner message="Laddar evenemang…" />
      </PageSection>
    )
  }

  return (
    <PageSection>
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur">
        <div className="px-4 pb-3 pt-5">
          <h1 className="text-2xl font-semibold">Sök</h1>
          <p className="mt-1 text-xs text-[var(--color-fg-dim)]">
            {query.trim() && `${results.length} träffar`}
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
      </header>

      <ul className="space-y-2 p-4">
        {results.slice(0, 50).map((e) => (
          <li key={e.id}>
            <EventCard event={e} />
          </li>
        ))}
        {query.trim() && results.length === 0 && (
          <li className="rounded-lg bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-fg-dim)]">
            Inga träffar. Prova ett annat sökord.
          </li>
        )}
        {results.length > 50 && (
          <li className="pt-2 text-center text-xs text-[var(--color-fg-dim)]">
            +{results.length - 50} fler …
          </li>
        )}
      </ul>
    </PageSection>
  )
}
