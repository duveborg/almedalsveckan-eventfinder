import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadEvents } from '../data/load'
import type { EnrichedEvent } from '../data/types'
import { useSchedule } from '../store/schedule'
import { EventCard } from '../components/EventCard'
import { useUrlParam } from '../lib/urlState'
import { haversineMeters } from '../lib/distance'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { downloadIcs } from '../lib/ics'
import { overlaps } from '../lib/overlap'
import { PageSection } from '../components/PageSection'

const WEEK_DAYS = [
  { date: '2026-06-22', label: 'Mån' },
  { date: '2026-06-23', label: 'Tis' },
  { date: '2026-06-24', label: 'Ons' },
  { date: '2026-06-25', label: 'Tor' },
  { date: '2026-06-26', label: 'Fre' },
]

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
  const savedForDay = saved.filter((e) => e.date === date)
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
      .filter((c) => !savedForDay.some((sv) => overlaps(sv, c.e)))
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

export default function ScheduleRoute() {
  useDocumentTitle('Ditt schema')
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

  const routeUrl = useMemo(() => {
    const points = forDay
      .filter(
        (e) => e.location?.latitude != null && e.location?.longitude != null,
      )
      .map((e) => `${e.location!.latitude},${e.location!.longitude}`)
    if (points.length < 2) return null
    return `https://www.google.com/maps/dir/${points.join('/')}?travelmode=walking`
  }, [forDay])

  return (
    <PageSection>
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 pb-3 pt-5">
          <h1 className="text-2xl font-semibold">Ditt schema</h1>
          {savedEvents.length > 0 && (
            <button
              type="button"
              onClick={() => downloadIcs(savedEvents, 'almedalen-mitt-schema.ics')}
              className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"
            >
              Exportera till kalender
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
        <p className="px-4 pb-3  text-[11px] leading-relaxed text-[var(--color-fg-dim)]">
          Ditt schema sparas bara lokalt på den här enheten. Rensar du
          webbläsardatan försvinner det.
        </p>
      </header>

      <div className="p-4">
        {savedEvents.length === 0 ? (
          <div className="rounded-xl bg-[var(--color-surface)] p-8 text-center">
            <p className="text-sm text-[var(--color-fg-dim)]">
              Inga sparade event ännu. Hitta något i{' '}
              <Link to="/" className="text-[var(--color-accent)] underline">
                Hitta
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

        {routeUrl && (
          <a
            href={routeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-medium text-[var(--color-fg)] hover:bg-[var(--color-border)]"
          >
            Visa dagens rutt i Google Maps
          </a>
        )}

        {visibleSuggestions.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-md font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
              Andra förslag — direkt efter...
            </h2>
            <ul className="space-y-6">
              {visibleSuggestions.map((s) => (
                <li key={s.for.id + '_' + s.next.id}>
                  <div className="mb-1 px-1 text-[10px] uppercase tracking-wider text-[var(--color-fg-dim)]">
                    {Math.round(s.gapMin) === 0 ? 'direkt efter' : `${Math.round(s.gapMin)} min efter`} <span className="text-red-600">{s.for.title}</span>
                    {s.meters != null && ` · ${Math.round(s.meters)} m bort`}
                  </div>
                  <EventCard event={s.next} />
                </li>
              ))}
            </ul>
          </div>
        )}


      </div>
    </PageSection>
  )
}
