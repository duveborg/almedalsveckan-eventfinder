import { useEffect, useMemo, useState } from 'react'
import { loadEvents } from '../data/load'
import type { EnrichedEvent } from '../data/types'
import { EventCard } from '../components/EventCard'

const WEEK_DAYS = [
  { date: '2026-06-22', label: 'Mån' },
  { date: '2026-06-23', label: 'Tis' },
  { date: '2026-06-24', label: 'Ons' },
  { date: '2026-06-25', label: 'Tor' },
  { date: '2026-06-26', label: 'Fre' },
]
const WEEK_START_MS = new Date('2026-06-22T00:00:00+02:00').getTime()
const WEEK_END_MS = new Date('2026-06-26T23:59:00+02:00').getTime()

type WindowMin = 60 | 180 | 360 | 1440

const WINDOWS: { label: string; min: WindowMin }[] = [
  { label: '1 h', min: 60 },
  { label: '3 h', min: 180 },
  { label: '6 h', min: 360 },
  { label: 'Hela dagen', min: 1440 },
]

function chosenCursor(
  selectedDate: string | null,
  hour: number,
  actualNow: Date,
): Date {
  const t = actualNow.getTime()
  if (selectedDate === null) {
    if (t >= WEEK_START_MS && t <= WEEK_END_MS) return actualNow
    return new Date('2026-06-22T08:00:00+02:00')
  }
  return new Date(
    `${selectedDate}T${String(hour).padStart(2, '0')}:00:00+02:00`,
  )
}

export default function NowRoute() {
  const [events, setEvents] = useState<EnrichedEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [hour, setHour] = useState(8)
  const [windowMin, setWindowMin] = useState<WindowMin>(180)
  const [actualNow, setActualNow] = useState(new Date())

  useEffect(() => {
    loadEvents()
      .then(setEvents)
      .catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    const id = setInterval(() => setActualNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const cursor = chosenCursor(selectedDate, hour, actualNow)
  const cursorEnd = new Date(cursor.getTime() + windowMin * 60_000)
  const isLive =
    selectedDate === null &&
    actualNow.getTime() >= WEEK_START_MS &&
    actualNow.getTime() <= WEEK_END_MS

  const visible = useMemo(() => {
    const startMs = cursor.getTime()
    const endMs = cursorEnd.getTime()
    return events
      .filter((e) => {
        const s = new Date(e.startISO).getTime()
        const eEnd = new Date(e.endISO).getTime()
        return eEnd >= startMs && s <= endMs
      })
      .sort(
        (a, b) =>
          new Date(a.startISO).getTime() - new Date(b.startISO).getTime(),
      )
  }, [events, cursor, cursorEnd])

  if (error)
    return (
      <div className="p-6 text-sm text-[var(--color-fg-dim)]">
        <p>Kunde inte ladda events.json — kör scrapern:</p>
        <pre className="mt-2 rounded bg-[var(--color-surface)] p-3 text-xs">
          npm run data
        </pre>
        <p className="mt-3 text-xs">{error}</p>
      </div>
    )

  return (
    <section className="mx-auto h-full max-w-md overflow-y-auto">
      <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur">
        <div className="px-4 pb-3 pt-5">
          <h1 className="text-2xl font-semibold">Nu</h1>
          <p className="mt-1 text-xs text-[var(--color-fg-dim)]">
            {visible.length} event under{' '}
            {selectedDate === null
              ? actualNow.getTime() >= WEEK_START_MS &&
                actualNow.getTime() <= WEEK_END_MS
                ? 'just nu'
                : 'måndag morgon'
              : `${WEEK_DAYS.find((d) => d.date === selectedDate)?.label} ${String(hour).padStart(2, '0')}:00`}
            {' · '}
            nästa {windowMin >= 60 ? `${windowMin / 60} h` : `${windowMin} min`}
          </p>
        </div>
        <div className="flex gap-1 overflow-x-auto px-4 pb-2 text-xs">
          <button
            type="button"
            onClick={() => setSelectedDate(null)}
            className={`rounded-full px-3 py-1.5 whitespace-nowrap ${
              selectedDate === null
                ? 'bg-[var(--color-accent)] text-black'
                : 'bg-[var(--color-surface)] text-[var(--color-fg-dim)]'
            }`}
          >
            Nu
          </button>
          {WEEK_DAYS.map((d) => (
            <button
              key={d.date}
              type="button"
              onClick={() => setSelectedDate(d.date)}
              className={`rounded-full px-3 py-1.5 whitespace-nowrap ${
                selectedDate === d.date
                  ? 'bg-[var(--color-accent)] text-black'
                  : 'bg-[var(--color-surface)] text-[var(--color-fg-dim)]'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        {selectedDate !== null && (
          <div className="px-4 pb-3">
            <input
              type="range"
              min={7}
              max={22}
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
              className="w-full accent-[var(--color-accent)]"
            />
            <div className="mt-1 flex justify-between text-[10px] text-[var(--color-fg-dim)]">
              <span>07</span>
              <span className="text-[var(--color-fg)]">
                {String(hour).padStart(2, '0')}:00
              </span>
              <span>22</span>
            </div>
          </div>
        )}
        <div className="flex gap-1 overflow-x-auto px-4 pb-3 text-[11px]">
          {WINDOWS.map((w) => (
            <button
              key={w.min}
              type="button"
              onClick={() => setWindowMin(w.min)}
              className={`rounded-full border px-2.5 py-1 whitespace-nowrap ${
                windowMin === w.min
                  ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                  : 'border-[var(--color-border)] text-[var(--color-fg-dim)]'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </header>
      <ul className="space-y-2 p-4">
        {visible.slice(0, 50).map((e) => (
          <li key={e.id}>
            <EventCard event={e} now={isLive ? cursor : undefined} />
          </li>
        ))}
        {visible.length === 0 && (
          <li className="rounded-lg bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-fg-dim)]">
            Inga event i fönstret. Prova ett annat tidsspann.
          </li>
        )}
        {visible.length > 50 && (
          <li className="pt-2 text-center text-xs text-[var(--color-fg-dim)]">
            +{visible.length - 50} fler …
          </li>
        )}
      </ul>
    </section>
  )
}
