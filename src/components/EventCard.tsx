import { Link } from 'react-router-dom'
import type { EnrichedEvent } from '../data/types'
import { useSchedule } from '../store/schedule'

interface Props {
  event: EnrichedEvent
  now?: Date
}

function relativeMinutes(event: EnrichedEvent, now: Date): string {
  const start = new Date(event.startISO).getTime()
  const end = new Date(event.endISO).getTime()
  const t = now.getTime()
  if (t < start) {
    const min = Math.round((start - t) / 60000)
    if (min < 60) return `om ${min} min`
    const h = Math.round(min / 60)
    if (h < 24) return `om ${h} h`
    const d = Math.round(h / 24)
    return `om ${d} d`
  }
  if (t <= end) {
    const min = Math.max(0, Math.round((end - t) / 60000))
    return `pågår · ${min} min kvar`
  }
  return 'avslutat'
}

export function EventCard({ event, now }: Props) {
  const saved = useSchedule((s) => s.savedIds.includes(event.id))
  const toggle = useSchedule((s) => s.toggle)

  return (
    <article
      className="relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors hover:border-[var(--color-accent)]"
      style={{ borderLeftColor: event.color?.main, borderLeftWidth: 4 }}
    >
      <Link to={`/event/${encodeURIComponent(event.id)}`} className="block p-4 pr-12">
        <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wider text-[var(--color-fg-dim)]">
          <span>{event.weekDayName}</span>
          <span>·</span>
          <span>
            {event.startTime}–{event.endTime}
          </span>
          {now && (
            <>
              <span>·</span>
              <span className="font-semibold text-[var(--color-accent)]">
                {relativeMinutes(event, now)}
              </span>
            </>
          )}
        </div>
        <h3 className="text-sm font-semibold leading-snug text-[var(--color-fg)]">
          {event.title}
        </h3>
        {event.location?.name && (
          <div className="mt-1 text-xs text-[var(--color-fg-dim)]">
            📍 {event.location.name}
          </div>
        )}
        {event.topics.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {event.topics.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5 text-[10px] text-[var(--color-fg-dim)]"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </Link>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          toggle(event.id)
        }}
        aria-label={saved ? 'Ta bort från schema' : 'Spara till schema'}
        className={`absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-lg transition-colors ${
          saved
            ? 'bg-[var(--color-accent)] text-black'
            : 'bg-[var(--color-bg)] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]'
        }`}
      >
        {saved ? '★' : '☆'}
      </button>
    </article>
  )
}
