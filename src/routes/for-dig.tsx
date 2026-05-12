import { useEffect, useMemo, useState } from 'react'
import { loadEvents } from '../data/load'
import { loadEmbeddings, rankByCentroid, type Ranked } from '../data/galaxy'
import type { EnrichedEvent } from '../data/types'
import { useSchedule } from '../store/schedule'
import { EventCard } from '../components/EventCard'
import { useDocumentTitle } from '../lib/useDocumentTitle'

const TOP_N = 30

export default function ForDigRoute() {
  useDocumentTitle('För dig')
  const [events, setEvents] = useState<EnrichedEvent[]>([])
  const [ranked, setRanked] = useState<Ranked[] | null>(null)
  const [embeddingsMissing, setEmbeddingsMissing] = useState(false)
  const savedIds = useSchedule((s) => s.savedIds)

  useEffect(() => {
    loadEvents().then(setEvents)
  }, [])

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
    if (!ranked) return []
    const byId = new Map(events.map((e) => [e.id, e]))
    const out: { event: EnrichedEvent; score: number }[] = []
    for (const r of ranked) {
      const e = byId.get(r.id)
      if (e) out.push({ event: e, score: r.score })
      if (out.length >= TOP_N) break
    }
    return out
  }, [ranked, events])

  return (
    <section className="mx-auto h-full max-w-md overflow-y-auto md:max-w-2xl">
      <header className="border-b border-[var(--color-border)] px-4 pb-3 pt-5">
        <h1 className="text-2xl font-semibold">Rekommendationer för dig</h1>
        <p className="mt-1 text-xs text-[var(--color-fg-dim)]">
          {savedIds.length === 0
            ? 'Spara event i schemat så hittar vi liknande åt dig.'
            : `Baserat på ${savedIds.length} spara${savedIds.length === 1 ? 't' : 'de'} event`}
        </p>
      </header>

      <div className="p-4">
        {savedIds.length === 0 ? (
          <div className="rounded-xl bg-[var(--color-surface)] p-8 text-center text-sm text-[var(--color-fg-dim)]">
            Lägg till några event i schemat så får du förslag här.
          </div>
        ) : embeddingsMissing ? (
          <div className="rounded-xl bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-fg-dim)]">
            Förslagen kräver embeddings. Kör <code>npm run embed</code>.
          </div>
        ) : ranked === null ? (
          <div className="text-sm text-[var(--color-fg-dim)]">Laddar …</div>
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
    </section>
  )
}
