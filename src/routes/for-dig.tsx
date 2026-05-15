import { useEffect, useMemo, useState } from 'react'
import { getEventsSync, loadEvents } from '../data/load'
import { loadEmbeddings, rankByCentroid, type Ranked } from '../data/galaxy'
import type { EnrichedEvent } from '../data/types'
import { useSchedule } from '../store/schedule'
import { EventCard } from '../components/EventCard'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { now } from '../lib/now'
import { PageSection } from '../components/PageSection'

const TOP_N = 30

export default function ForDigRoute() {
  useDocumentTitle('För dig')
  const [events, setEvents] = useState<EnrichedEvent[] | null>(() => getEventsSync())
  const [ranked, setRanked] = useState<Ranked[] | null>(null)
  const [embeddingsMissing, setEmbeddingsMissing] = useState(false)
  const savedIds = useSchedule((s) => s.savedIds)

  useEffect(() => {
    if (events) return
    loadEvents().then(setEvents)
  }, [events])

  useEffect(() => {
    if (savedIds.length === 0) {
      setRanked(null)
      return
    }
    let cancelled = false
    loadEmbeddings().then((data) => {
      if (cancelled) return
      if (!data) {
        setEmbeddingsMissing(true)
        return
      }
      const r = rankByCentroid(data.meta, data.bytes, savedIds)
      if (!cancelled) setRanked(r)
    })
    return () => {
      cancelled = true
    }
  }, [savedIds])

  const items = useMemo(() => {
    if (!ranked || !events) return []
    const byId = new Map(events.map((e) => [e.id, e]))
    const cutoff = now().getTime()
    const out: { event: EnrichedEvent; score: number }[] = []
    for (const r of ranked) {
      const e = byId.get(r.id)
      if (e && new Date(e.endISO).getTime() > cutoff) {
        out.push({ event: e, score: r.score })
      }
      if (out.length >= TOP_N) break
    }
    return out
  }, [ranked, events])

  if (!events) {
    return (
      <PageSection>
        <LoadingSpinner message="Laddar evenemang…" />
      </PageSection>
    )
  }

  return (
    <PageSection>
      <header className="border-b border-[var(--color-border)] px-4 pb-3 pt-5">
        <h1 className="text-2xl font-semibold">Rekommendationer för dig</h1>
        <p className="mt-1 text-xs text-[var(--color-fg-dim)]">
          {savedIds.length === 0
            ? 'Spara evenemang i schemat så hittar vi liknande åt dig.'
            : `Baserat på ${savedIds.length} evenemang i ditt schema`}
        </p>
      </header>

      <div className="p-4">
        {savedIds.length === 0 ? (
          <div className="rounded-xl bg-[var(--color-surface)] p-8 text-center text-sm text-[var(--color-fg-dim)]">
            Lägg till några evenemang i schemat så får du förslag här.
          </div>
        ) : embeddingsMissing ? (
          <div className="rounded-xl bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-fg-dim)]">
            Förslagen kräver embeddings. Kör <code>npm run embed</code>.
          </div>
        ) : ranked === null ? (
          <LoadingSpinner message="Räknar fram förslag…" />
        ) : items.length === 0 ? (
          <div className="rounded-xl bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-fg-dim)]">
            Inga förslag att visa.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.event.id}>
                <EventCard event={it.event} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageSection>
  )
}
