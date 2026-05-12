import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadEvents } from '../data/load'
import type { EnrichedEvent } from '../data/types'
import { useSchedule } from '../store/schedule'
import { EventCard } from '../components/EventCard'

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

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
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
    .slice(0, 6)
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
  const [day, setDay] = useState<string>(WEEK_DAYS[0].date)
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

  return (
    <section className="mx-auto h-full max-w-md overflow-y-auto">
      <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 pb-3 pt-5">
          <h1 className="text-2xl font-semibold">Schema</h1>
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
                    ? 'bg-[var(--color-accent)] text-black'
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

        {suggestions.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
              Förslag — direkt efter
            </h2>
            <ul className="space-y-2">
              {suggestions.map((s) => (
                <li
                  key={s.for.id + '_' + s.next.id}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                >
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-fg-dim)]">
                    efter {s.for.title.slice(0, 40)}
                    {s.for.title.length > 40 ? '…' : ''} · {Math.round(s.gapMin)} min gap
                    {s.meters != null && ` · ${Math.round(s.meters)} m bort`}
                  </div>
                  <Link
                    to={`/event/${encodeURIComponent(s.next.id)}`}
                    className="block text-sm font-semibold hover:text-[var(--color-accent)]"
                  >
                    {s.next.title}
                  </Link>
                  <div className="mt-1 text-xs text-[var(--color-fg-dim)]">
                    {s.next.startTime}–{s.next.endTime} · {s.next.location?.name}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
