import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadEvents } from '../data/load'
import type { EnrichedEvent } from '../data/types'
import { useSchedule } from '../store/schedule'
import { EventCard } from '../components/EventCard'
import { useUrlParam } from '../lib/urlState'
import { haversineMeters } from '../lib/distance'

const WEEK_DAYS = [
  { date: '2026-06-22', label: 'Mån 22/6' },
  { date: '2026-06-23', label: 'Tis 23/6' },
  { date: '2026-06-24', label: 'Ons 24/6' },
  { date: '2026-06-25', label: 'Tor 25/6' },
  { date: '2026-06-26', label: 'Fre 26/6' },
]

function overlaps(a: EnrichedEvent, b: EnrichedEvent): boolean {
  if (a.id === b.id || a.date !== b.date) return false
  const as = new Date(a.startISO).getTime()
  const ae = new Date(a.endISO).getTime()
  const bs = new Date(b.startISO).getTime()
  const be = new Date(b.endISO).getTime()
  return as < be && bs < ae
}

function suggestNext(
  saved: EnrichedEvent[],
  all: EnrichedEvent[],
  date: string,
  savedIds: string[],
): { for: EnrichedEvent; next: EnrichedEvent; gapMin: number; meters: number | null }[] {
  const out: {
    for: EnrichedEvent
    next: EnrichedEvent
    gapMin: number
    meters: number | null
  }[] = []
  for (const s of saved) {
    if (s.date !== date) continue
    const sEnd = new Date(s.endISO).getTime()
    const candidates = all
      .filter(
        (e) =>
          e.date === date &&
          !savedIds.includes(e.id) &&
          e.id !== s.id,
      )
      .map((e) => {
        const eStart = new Date(e.startISO).getTime()
        const gapMin = (eStart - sEnd) / 60000
        return { e, gapMin }
      })
      .filter((c) => c.gapMin >= 0 && c.gapMin <= 30)
    for (const c of candidates.slice(0, 8)) {
      let meters: number | null = null
      if (
        s.location?.latitude != null &&
        s.location?.longitude != null &&
        c.e.location?.latitude != null &&
        c.e.location?.longitude != null
      ) {
        meters = haversineMeters(
          { lat: s.location.latitude, lng: s.location.longitude },
          { lat: c.e.location.latitude, lng: c.e.location.longitude },
        )
        if (meters > 600) continue
      }
      out.push({ for: s, next: c.e, gapMin: c.gapMin, meters })
    }
  }
  return out
    .sort((a, b) => a.gapMin - b.gapMin)
    .slice(0, 10)
}

function buildIcs(events: EnrichedEvent[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//almedalen-app//SE',
    'CALSCALE:GREGORIAN',
  ]
  for (const e of events) {
    const dtStart = new Date(e.startISO).toISOString().replace(/[-:]|\.\d{3}/g, '')
    const dtEnd = new Date(e.endISO).toISOString().replace(/[-:]|\.\d{3}/g, '')
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@almedalen-app`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${e.title.replace(/[\r\n,;]/g, ' ')}`,
      `LOCATION:${(e.location?.name ?? '').replace(/[\r\n,;]/g, ' ')}`,
      `URL:${e.url}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

function downloadIcs(events: EnrichedEvent[]) {
  const blob = new Blob([buildIcs(events)], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'almedalen-mitt-schema.ics'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function ScheduleRoute() {
  const [events, setEvents] = useState<EnrichedEvent[]>([])
  const [day, setDay] = useUrlParam('day', WEEK_DAYS[0].date)
  const savedIds = useSchedule((s) => s.savedIds)

  useEffect(() => {
    loadEvents().then(setEvents)
  }, [])

  const savedEvents = useMemo(
    () => events.filter((e) => savedIds.includes(e.id)),
    [events, savedIds],
  )

  const forDay = useMemo(
    () =>
      savedEvents
        .filter((e) => e.date === day)
        .sort(
          (a, b) =>
            new Date(a.startISO).getTime() - new Date(b.startISO).getTime(),
        ),
    [savedEvents, day],
  )

  const conflictIds = useMemo(() => {
    const out = new Set<string>()
    for (const a of forDay) {
      for (const b of forDay) {
        if (overlaps(a, b)) {
          out.add(a.id)
          out.add(b.id)
        }
      }
    }
    return out
  }, [forDay])

  const suggestions = useMemo(
    () => suggestNext(savedEvents, events, day, savedIds),
    [savedEvents, events, day, savedIds],
  )
  const visibleSuggestions = suggestions.filter(
    (s) => !savedIds.includes(s.next.id),
  )

  return (
    <section className="mx-auto h-full max-w-md overflow-y-auto">
      <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 pb-3 pt-5">
          <h1 className="text-2xl font-semibold">Ditt schema</h1>
          {savedEvents.length > 0 && (
            <button
              type="button"
              onClick={() => downloadIcs(savedEvents)}
              className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"
            >
              Exportera .ics
            </button>
          )}
        </div>
        <div className="flex gap-1 overflow-x-auto px-4 pb-3 text-xs">
          {WEEK_DAYS.map((d) => {
            const count = savedEvents.filter((e) => e.date === d.date).length
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => setDay(d.date)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 whitespace-nowrap ${
                  day === d.date
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-surface)] text-[var(--color-fg-dim)]'
                }`}
              >
                {d.label}
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 text-[10px] ${
                      day === d.date
                        ? 'bg-black/20'
                        : 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </header>

      <div className="p-4">
        {savedEvents.length === 0 ? (
          <div className="rounded-xl bg-[var(--color-surface)] p-8 text-center">
            <p className="text-sm text-[var(--color-fg-dim)]">
              Inga sparade event ännu. Hitta något i{' '}
              <Link to="/now" className="text-[var(--color-accent)] underline">
                Nu
              </Link>{' '}
              eller{' '}
              <Link to="/map" className="text-[var(--color-accent)] underline">
                Karta
              </Link>{' '}
              och tryck stjärnan.
            </p>
          </div>
        ) : forDay.length === 0 ? (
          <div className="rounded-xl bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-fg-dim)]">
            Inga sparade event den här dagen.
          </div>
        ) : (
          <ul className="space-y-2">
            {forDay.map((e) => (
              <li key={e.id} className="relative">
                {conflictIds.has(e.id) && (
                  <span className="absolute -top-1.5 right-14 z-10 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                    krock
                  </span>
                )}
                <EventCard event={e} />
              </li>
            ))}
          </ul>
        )}

        {visibleSuggestions.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
              Förslag — direkt efter
            </h2>
            <ul className="space-y-6">
              {visibleSuggestions.map((s) => (
                <li key={s.for.id + '_' + s.next.id}>
                  <div className="mb-1 px-1 text-[10px] uppercase tracking-wider text-[var(--color-fg-dim)]">
                    {Math.round(s.gapMin)} min efter {s.for.title}
                    {s.meters != null && ` · ${Math.round(s.meters)} m bort`}
                  </div>
                  <EventCard event={s.next} />
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-8 px-1 text-[11px] leading-relaxed text-[var(--color-fg-dim)]">
          Ditt schema sparas bara lokalt på den här enheten. Rensar du
          webbläsardatan försvinner det.
        </p>
      </div>
    </section>
  )
}
