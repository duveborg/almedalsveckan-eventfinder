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

  const handleImport = () => {
    const added = bulkAdd(incomingEvents.map((e) => e.id))
    setImportedCount(added)
    clearImportParam()
    setTimeout(() => setImportedCount(null), 3000)
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/schedule?import=${savedIds.join(',')}`
    const shareData = {
      title: 'Mitt schema – Almedalen 2026',
      text: `Här är ${savedIds.length} event jag tänker gå på i Almedalen 2026.`,
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
                <h2 className="text-sm font-semibold">Inga event hittades</h2>
                <p className="mt-1 text-xs text-[var(--color-fg-dim)]">
                  Den delade länken matchade inga event i programmet.
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
              <>
                <h2 className="text-sm font-semibold">
                  Schema från någon annan — {incomingEvents.length} event
                </h2>
                <p className="mt-1 text-xs text-[var(--color-fg-dim)]">
                  {[
                    ...new Set(
                      incomingEvents.map(
                        (e) => DAY_LABEL_BY_DATE[e.date] ?? e.date,
                      ),
                    ),
                  ].join(', ')}
                </p>
                <ul className="mt-3 space-y-1.5">
                  {incomingEvents.slice(0, 12).map((e) => (
                    <li key={e.id} className="flex items-baseline gap-2 text-xs">
                      <span className="w-14 shrink-0 text-[var(--color-fg-dim)]">
                        {DAY_LABEL_BY_DATE[e.date] ?? ''} {formatTime(e.startISO)}
                      </span>
                      <span className="flex-1 truncate">{e.title}</span>
                      {savedIds.includes(e.id) && (
                        <span className="shrink-0 text-[10px] text-[var(--color-fg-dim)]">
                          redan sparad
                        </span>
                      )}
                    </li>
                  ))}
                  {incomingEvents.length > 12 && (
                    <li className="text-xs text-[var(--color-fg-dim)]">
                      + {incomingEvents.length - 12} till
                    </li>
                  )}
                </ul>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={handleImport}
                    className="flex-1 rounded-full bg-[var(--color-accent)] px-4 py-2 text-xs font-medium text-white hover:opacity-90"
                  >
                    Lägg till i mitt schema
                  </button>
                  <button
                    type="button"
                    onClick={clearImportParam}
                    className="rounded-full border border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"
                  >
                    Avbryt
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {importedCount !== null && (
          <div className="mb-4 rounded-xl bg-[var(--color-accent)]/15 px-4 py-3 text-sm text-[var(--color-accent)]">
            {importedCount === 0
              ? 'Alla event fanns redan i ditt schema'
              : `${importedCount} event tillagda i ditt schema`}
          </div>
        )}

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
