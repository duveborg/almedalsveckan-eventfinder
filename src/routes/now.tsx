import { useEffect, useMemo, useState } from 'react'
import { loadEvents } from '../data/load'
import type { EnrichedEvent } from '../data/types'
import { hasFood } from '../data/food'
import { EventCard } from '../components/EventCard'
import { useUrlParam } from '../lib/urlState'
import { now } from '../lib/now'

const WEEK_DAYS = [
  { date: '2026-06-22', label: 'Mån' },
  { date: '2026-06-23', label: 'Tis' },
  { date: '2026-06-24', label: 'Ons' },
  { date: '2026-06-25', label: 'Tor' },
  { date: '2026-06-26', label: 'Fre' },
]
const WEEK_START_MS = new Date('2026-06-22T00:00:00+02:00').getTime()
const WEEK_END_MS = new Date('2026-06-26T23:59:00+02:00').getTime()

const HOUR_MIN = 7
const HOUR_MAX = 23

function hourToDate(date: string, hour: number): Date {
  return new Date(
    `${date}T${String(hour).padStart(2, '0')}:00:00+02:00`,
  )
}

function chosenWindow(
  selectedDate: string | null,
  hourStart: number,
  hourEnd: number,
  actualNow: Date,
): { start: Date; end: Date } {
  const t = actualNow.getTime()
  if (selectedDate === null) {
    const base =
      t >= WEEK_START_MS && t <= WEEK_END_MS
        ? actualNow
        : new Date('2026-06-22T08:00:00+02:00')
    return {
      start: base,
      end: new Date(base.getTime() + 3 * 60 * 60_000),
    }
  }
  return {
    start: hourToDate(selectedDate, hourStart),
    end: hourToDate(selectedDate, hourEnd),
  }
}

export default function NowRoute() {
  const [events, setEvents] = useState<EnrichedEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dateParam, setDateParam] = useUrlParam('date', '')
  const [hourParam, setHourParam] = useUrlParam('h', String(HOUR_MIN))
  const [hourEndParam, setHourEndParam] = useUrlParam('h2', String(HOUR_MAX))
  const [foodParam, setFoodParam] = useUrlParam('food', '0')
  const [actualNow, setActualNow] = useState(now())

  const selectedDate: string | null = dateParam || null
  const hourStart = Number(hourParam) || HOUR_MIN
  const hourEnd = Number(hourEndParam) || HOUR_MAX
  const foodOnly = foodParam === '1'
  const setSelectedDate = (v: string | null) => setDateParam(v ?? '')
  const setHourStart = (v: number) => {
    const clamped = Math.max(HOUR_MIN, Math.min(v, hourEnd - 1))
    setHourParam(String(clamped))
  }
  const setHourEnd = (v: number) => {
    const clamped = Math.min(HOUR_MAX, Math.max(v, hourStart + 1))
    setHourEndParam(String(clamped))
  }
  const setFoodOnly = (v: boolean) => setFoodParam(v ? '1' : '0')

  useEffect(() => {
    loadEvents()
      .then(setEvents)
      .catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    const id = setInterval(() => setActualNow(now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const { start: cursor, end: cursorEnd } = chosenWindow(
    selectedDate,
    hourStart,
    hourEnd,
    actualNow,
  )
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
        if (s < startMs || eEnd > endMs) return false
        if (foodOnly && !hasFood(e)) return false
        return true
      })
      .sort(
        (a, b) =>
          new Date(a.startISO).getTime() - new Date(b.startISO).getTime(),
      )
  }, [events, cursor, cursorEnd, foodOnly])

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
      <header className="border-b border-[var(--color-border)]">
        <div className="px-4 pb-3 pt-5">
          <h1 className="text-2xl font-semibold">Nu</h1>
          <p className="mt-1 text-xs text-[var(--color-fg-dim)]">
            {visible.length} event {' · '}
            {selectedDate === null
              ? actualNow.getTime() >= WEEK_START_MS &&
                actualNow.getTime() <= WEEK_END_MS
                ? 'just nu'
                : 'första dagen'
              : `${WEEK_DAYS.find((d) => d.date === selectedDate)?.label} ${String(hourStart).padStart(2, '0')}:00–${String(hourEnd).padStart(2, '0')}:00`}
          </p>
        </div>
        <div className="flex gap-1 overflow-x-auto px-4 pb-2 text-xs">
          <button
            type="button"
            onClick={() => setSelectedDate(null)}
            className={`rounded-full px-3 py-1.5 whitespace-nowrap ${
              selectedDate === null
                ? 'bg-[var(--color-accent)] text-white'
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
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-surface)] text-[var(--color-fg-dim)]'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        {selectedDate !== null && (
          <div className="px-4 pb-3">
            <div className="mb-1 flex items-baseline justify-between text-[11px]">
              <span className="text-[var(--color-fg-dim)]">Tidsspann</span>
              <span className="font-medium text-[var(--color-fg)]">
                {String(hourStart).padStart(2, '0')}:00–
                {String(hourEnd).padStart(2, '0')}:00
              </span>
            </div>
            <div className="relative h-6">
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded bg-[var(--color-border)]" />
              <div
                className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded bg-[var(--color-accent)]"
                style={{
                  left: `${((hourStart - HOUR_MIN) / (HOUR_MAX - HOUR_MIN)) * 100}%`,
                  right: `${100 - ((hourEnd - HOUR_MIN) / (HOUR_MAX - HOUR_MIN)) * 100}%`,
                }}
              />
              <input
                type="range"
                min={HOUR_MIN}
                max={HOUR_MAX}
                value={hourStart}
                onChange={(e) => setHourStart(Number(e.target.value))}
                className="range-dual absolute inset-0 w-full"
              />
              <input
                type="range"
                min={HOUR_MIN}
                max={HOUR_MAX}
                value={hourEnd}
                onChange={(e) => setHourEnd(Number(e.target.value))}
                className="range-dual absolute inset-0 w-full"
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-[var(--color-fg-dim)]">
              <span>{String(HOUR_MIN).padStart(2, '0')}</span>
              <span>{String(HOUR_MAX).padStart(2, '0')}</span>
            </div>
          </div>
        )}
        <div className="px-4 pb-3 text-[11px]">
          <label className="inline-flex cursor-pointer items-center gap-2 text-[var(--color-fg-dim)]">
            <input
              type="checkbox"
              checked={foodOnly}
              onChange={(e) => setFoodOnly(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--color-accent)]"
            />
            Endast med mat
          </label>
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
