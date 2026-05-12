import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { loadEvents } from '../data/load'
import { loadEmbeddings, cosineInt8 } from '../data/galaxy'
import type { EnrichedEvent } from '../data/types'
import { EventCard } from '../components/EventCard'
import { useSchedule } from '../store/schedule'

interface SimilarHit {
  id: string
  score: number
}

function useSimilar(eventId: string | undefined): SimilarHit[] | null {
  const [hits, setHits] = useState<SimilarHit[] | null>(null)
  useEffect(() => {
    if (!eventId) return
    let cancelled = false
    loadEmbeddings().then((data) => {
      if (!data || cancelled) return
      const { meta, bytes } = data
      const target = meta.ids.indexOf(eventId)
      if (target < 0) return
      const tscale = meta.scales[target]
      const scored: SimilarHit[] = []
      for (let i = 0; i < meta.count; i++) {
        if (i === target) continue
        const s = cosineInt8(
          bytes,
          bytes,
          tscale,
          meta.scales[i],
          meta.dims,
          target * meta.dims,
          i * meta.dims,
        )
        scored.push({ id: meta.ids[i], score: s })
      }
      scored.sort((a, b) => b.score - a.score)
      if (!cancelled) setHits(scored.slice(0, 6))
    })
    return () => {
      cancelled = true
    }
  }, [eventId])
  return hits
}

export default function EventDetailRoute() {
  const { id } = useParams()
  const eventId = id ? decodeURIComponent(id) : undefined
  const [events, setEvents] = useState<EnrichedEvent[]>([])
  const saved = useSchedule((s) => (eventId ? s.savedIds.includes(eventId) : false))
  const toggle = useSchedule((s) => s.toggle)
  const similar = useSimilar(eventId)

  useEffect(() => {
    loadEvents().then(setEvents)
  }, [])

  const event = useMemo(
    () => events.find((e) => e.id === eventId) ?? null,
    [events, eventId],
  )

  const similarEvents = useMemo(() => {
    if (!similar) return null
    const byId = new Map(events.map((e) => [e.id, e]))
    return similar
      .map((h) => byId.get(h.id))
      .filter((e): e is EnrichedEvent => !!e)
  }, [similar, events])

  if (!event)
    return (
      <div className="p-6 text-sm text-[var(--color-fg-dim)]">Laddar …</div>
    )

  const speakers = event.persons ?? []

  return (
    <article className="mx-auto h-full max-w-md overflow-y-auto p-4">
      <Link
        to="/now"
        className="mb-3 inline-block text-xs text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"
      >
        ← Tillbaka
      </Link>
      <header className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold leading-tight text-[var(--color-fg)]">
            {event.title}
          </h1>
          <button
            type="button"
            onClick={() => toggle(event.id)}
            aria-label={saved ? 'Ta bort från schema' : 'Spara till schema'}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl ${
              saved
                ? 'bg-[var(--color-accent)] text-black'
                : 'bg-[var(--color-bg)] text-[var(--color-fg-dim)]'
            }`}
          >
            {saved ? '★' : '☆'}
          </button>
        </div>
        <div className="text-xs text-[var(--color-fg-dim)]">
          {event.weekDayName} {event.shortDate} · {event.startTime}–{event.endTime}
        </div>
        {event.location?.name && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${
              event.location.latitude != null && event.location.longitude != null
                ? `${event.location.latitude},${event.location.longitude}`
                : encodeURIComponent(`${event.location.name}, Visby`)
            }`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-xs text-[var(--color-accent)] underline-offset-2 hover:underline"
          >
            📍 {event.location.name}
          </a>
        )}
        {event.topics.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {event.topics.map((t) => (
              <span
                key={t}
                className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5 text-[10px] text-[var(--color-fg-dim)]"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </header>

      {event.socialIssue && (
        <section className="mb-4">
          <h2 className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-fg-dim)]">
            Samhällsfråga
          </h2>
          <p className="text-sm whitespace-pre-line">{event.socialIssue}</p>
        </section>
      )}

      {event.description && (
        <section className="mb-4">
          <h2 className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-fg-dim)]">
            Beskrivning
          </h2>
          <p className="text-sm whitespace-pre-line text-[var(--color-fg)]">
            {event.description}
          </p>
        </section>
      )}

      {event.organizer && event.organizer.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-fg-dim)]">
            Arrangör
          </h2>
          <ul className="text-sm">
            {event.organizer.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </section>
      )}

      {speakers.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-fg-dim)]">
            Medverkande
          </h2>
          <ul className="space-y-1 text-sm">
            {speakers.map((p, i) => (
              <li key={`${p.name}_${i}`}>
                <strong className="font-medium">{p.name}</strong>
                {p.title && (
                  <span className="text-[var(--color-fg-dim)]">
                    {' '}
                    · {p.title}
                  </span>
                )}
                {p.organization && (
                  <span className="text-[var(--color-fg-dim)]">
                    {' '}
                    · {p.organization}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {event.urls?.url1 && (
        <a
          href={event.urls.url1}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-4 inline-block text-xs text-[var(--color-accent)] underline"
        >
          {event.urls.url1.replace(/^https?:\/\//, '').replace(/\/$/, '')}
        </a>
      )}

      {similarEvents && similarEvents.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
            Liknande event
          </h2>
          <ul className="space-y-2">
            {similarEvents.map((e) => (
              <li key={e.id}>
                <EventCard event={e} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
