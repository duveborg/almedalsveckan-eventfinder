import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getEventsSync, loadEvents } from '../data/load'
import type { EnrichedEvent } from '../data/types'
import { useSchedule } from '../store/schedule'
import { EventCard } from '../components/EventCard'
import { LoadingSpinner } from '../components/LoadingSpinner'
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

const DAY_LABEL_BY_DATE: Record<string, string> = Object.fromEntries(
  WEEK_DAYS.map((d) => [d.date, d.label]),
)

function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
  const [events, setEvents] = useState<EnrichedEvent[] | null>(() => getEventsSync())
  const [day, setDay] = useUrlParam('day', WEEK_DAYS[0].date)
  const savedIds = useSchedule((s) => s.savedIds)
  const bulkAdd = useSchedule((s) => s.bulkAdd)
  const [searchParams, setSearchParams] = useSearchParams()
  const [copied, setCopied] = useState(false)
  const [importedCount, setImportedCount] = useState<number | null>(null)

  useEffect(() => {
    if (events) return
    loadEvents().then(setEvents)
  }, [events])

  const incomingIds = useMemo(() => {
    const raw = searchParams.get('import')
    if (!raw) return [] as string[]
    return [...new Set(raw.split(',').filter(Boolean))]
  }, [searchParams])

  const incomingEvents = useMemo(() => {
    if (!events || incomingIds.length === 0) return [] as EnrichedEvent[]
    const byId = new Map(events.map((e) => [e.id, e]))
    return incomingIds
      .map((id) => byId.get(id))
      .filter((e): e is EnrichedEvent => e != null)
      .sort(
        (a, b) =>
          new Date(a.startISO).getTime() - new Date(b.startISO).getTime(),
      )
  }, [events, incomingIds])

  const clearImportParam = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('import')
        return next
      },
      { replace: true },
    )
  }

  const handleImport = (ids: string[]) => {
    const added = bulkAdd(ids)
    setImportedCount(added)
    clearImportParam()
    setTimeout(() => setImportedCount(null), 3000)
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/schedule?import=${savedIds.join(',')}`
    const shareData = {
      title: 'Mitt schema – Almedalen 2026',
      text: `Här är ${savedIds.length} evenemang jag tänker gå på i Almedalen 2026.`,
      url,
    }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
        return
      } catch {
        // user cancelled — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const savedEvents = useMemo(
    () => (events ? events.filter((e) => savedIds.includes(e.id)) : []),
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
    () => (events ? suggestNext(savedEvents, events, day, savedIds) : []),
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
        <div className="flex items-center justify-between px-4 pb-3 pt-5">
          <h1 className="text-2xl font-semibold">Ditt schema</h1>
          {savedEvents.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleShare}
                className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"
              >
                {copied ? 'Länk kopierad' : 'Dela schema'}
              </button>
              <button
                type="button"
                onClick={() => downloadIcs(savedEvents, 'almedalen-mitt-schema.ics')}
                className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"
              >
                Exportera till kalender
              </button>
            </div>
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
        {incomingIds.length > 0 && (
          <div className="mb-4 rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-surface)] p-4">
            {incomingEvents.length === 0 ? (
              <>
                <h2 className="text-sm font-semibold">Inga evenemang hittades</h2>
                <p className="mt-1 text-xs text-[var(--color-fg-dim)]">
                  Den delade länken matchade inga evenemang i programmet.
                </p>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={clearImportParam}
                    className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"
                  >
                    Avbryt
                  </button>
                </div>
              </>
            ) : (
              <ImportPanel
                key={incomingIds.join(',')}
                incomingEvents={incomingEvents}
                savedIds={savedIds}
                onImport={handleImport}
                onCancel={clearImportParam}
              />
            )}
          </div>
        )}

        {importedCount !== null && (
          <div className="mb-4 rounded-xl bg-[var(--color-accent)]/15 px-4 py-3 text-sm text-[var(--color-accent)]">
            {importedCount === 0
              ? 'Alla evenemang fanns redan i ditt schema'
              : `${importedCount} evenemang tillagda i ditt schema`}
          </div>
        )}

        {savedEvents.length === 0 ? (
          <div className="rounded-xl bg-[var(--color-surface)] p-8 text-center">
            <p className="text-sm text-[var(--color-fg-dim)]">
              Inga sparade evenemang ännu. Hitta något i{' '}
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
            Inga sparade evenemang den här dagen.
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

function ImportPanel({
  incomingEvents,
  savedIds,
  onImport,
  onCancel,
}: {
  incomingEvents: EnrichedEvent[]
  savedIds: string[]
  onImport: (ids: string[]) => void
  onCancel: () => void
}) {
  const selectableIds = useMemo(
    () =>
      incomingEvents
        .filter((e) => !savedIds.includes(e.id))
        .map((e) => e.id),
    [incomingEvents, savedIds],
  )
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(selectableIds),
  )

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(selectableIds))
  }

  const days = [
    ...new Set(incomingEvents.map((e) => DAY_LABEL_BY_DATE[e.date] ?? e.date)),
  ].join(', ')

  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">
          Schema från någon annan — {incomingEvents.length} event
        </h2>
        {selectableIds.length > 1 && (
          <button
            type="button"
            onClick={toggleAll}
            className="shrink-0 text-[11px] text-[var(--color-accent)] hover:underline"
          >
            {allSelected ? 'Avmarkera alla' : 'Markera alla'}
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-[var(--color-fg-dim)]">{days}</p>
      <ul className="mt-3 space-y-1">
        {incomingEvents.map((e) => {
          const alreadySaved = savedIds.includes(e.id)
          const isChecked = !alreadySaved && selected.has(e.id)
          return (
            <li key={e.id}>
              <label
                className={`flex items-center gap-2 rounded-md px-1 py-1 text-xs ${
                  alreadySaved
                    ? 'cursor-default opacity-50'
                    : 'cursor-pointer hover:bg-[var(--color-border)]/30'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={alreadySaved}
                  onChange={() => toggle(e.id)}
                  className="size-4 shrink-0 accent-[var(--color-accent)]"
                />
                <span className="shrink-0 whitespace-nowrap text-[var(--color-fg-dim)]">
                  {DAY_LABEL_BY_DATE[e.date] ?? ''} {formatTime(e.startISO)}
                </span>
                <span className="flex-1 truncate">{e.title}</span>
                {alreadySaved && (
                  <span className="shrink-0 text-[10px] text-[var(--color-fg-dim)]">
                    redan sparad
                  </span>
                )}
              </label>
            </li>
          )
        })}
      </ul>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => onImport([...selected])}
          disabled={selected.size === 0}
          className="flex-1 rounded-full bg-[var(--color-accent)] px-4 py-2 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {selected.size === 0
            ? 'Välj minst ett evenemang'
            : `Lägg till ${selected.size} evenemang i mitt schema`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"
        >
          Avbryt
        </button>
      </div>
    </>
  )
}
