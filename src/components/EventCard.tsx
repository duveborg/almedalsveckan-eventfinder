import { Link } from "react-router-dom";
import type { EnrichedEvent } from "../data/types";
import { useSchedule } from "../store/schedule";
import { useSavedEvents } from "../lib/useSavedEvents";
import { overlaps } from "../lib/overlap";
import { now } from "../lib/now";
interface Props {
  event: EnrichedEvent;
}

function formatDuration(totalMin: number): string {
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (h < 24) return min === 0 ? `${h} h` : `${h} h ${min} min`;
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return remH === 0 ? `${d} d` : `${d} d ${remH} h`;
}

function relativeMinutes(event: EnrichedEvent, now: Date): string | null {
  const start = new Date(event.startISO).getTime();
  const end = new Date(event.endISO).getTime();
  const t = now.getTime();
  const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
  if (t < start) {
    if (start - t >= TWELVE_HOURS_MS) return null;
    const min = Math.round((start - t) / 60000);
    return `om ${formatDuration(min)}`;
  }
  if (t <= end) {
    const min = Math.max(0, Math.round((end - t) / 60000));
    return `pågår · ${formatDuration(min)} kvar`;
  }
  return "avslutat";
}

export function EventCard({ event }: Props) {
  const saved = useSchedule((s) => s.savedIds.includes(event.id));
  const toggle = useSchedule((s) => s.toggle);
  const savedEvents = useSavedEvents();
  const relative = relativeMinutes(event, now());
  const conflict = saved
    ? null
    : (savedEvents.find((s) => overlaps(event, s)) ?? null);

  return (
    <article
      className="relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors hover:border-[var(--color-accent)]"
      style={{ borderLeftColor: event.color?.main, borderLeftWidth: 4 }}
    >
      <Link
        to={`/event/${encodeURIComponent(event.id)}`}
        className="block p-4 pr-12"
      >
        {relative && (
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">
            {relative}
          </div>
        )}
        <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wider text-[var(--color-fg-dim)]">
          <span>{event.weekDayName}</span>
          <span>·</span>
          <span>
            {event.startTime}–{event.endTime}
          </span>
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

        {conflict && (
          <div className="mt-2 line-clamp-1 text-[11px] font-semibold uppercase tracking-wider">
            ⚠️ Samtidigt som{" "}
            <span className="text-red-600">{conflict.title}</span>
          </div>
        )}
      </Link>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          toggle(event.id);
        }}
        aria-label={saved ? "Ta bort från schema" : "Spara till schema"}
        className={`absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-lg transition-colors ${
          saved
            ? "bg-[var(--color-accent)] text-white"
            : "bg-[var(--color-bg)] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"
        }`}
      >
        {saved ? "★" : "☆"}
      </button>
    </article>
  );
}
