import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { loadEvents } from "../data/load";
import { loadEmbeddings, cosineInt8 } from "../data/galaxy";
import type { EnrichedEvent } from "../data/types";
import { EventCard } from "../components/EventCard";
import { useSchedule } from "../store/schedule";
import { useLocation } from "../store/location";
import { haversineMeters, formatDistance } from "../lib/distance";
import { hasFood } from "../data/food";
import { now } from "../lib/now";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { downloadIcs } from "../lib/ics";

interface SimilarHit {
  id: string;
  score: number;
}

function formatDuration(min: number | null): string | null {
  if (min == null || min <= 0) return null;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function icsFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "event"}.ics`;
}

const SOCIAL_LABELS: Array<
  [
    (
      | "facebookUrl"
      | "twitterUrl"
      | "instagramUrl"
      | "linkedinUrl"
      | "youtubeUrl"
    ),
    string,
  ]
> = [
  ["facebookUrl", "Facebook"],
  ["twitterUrl", "Twitter / X"],
  ["instagramUrl", "Instagram"],
  ["linkedinUrl", "LinkedIn"],
  ["youtubeUrl", "YouTube"],
];

function useSimilar(eventId: string | undefined): SimilarHit[] | null {
  const [hits, setHits] = useState<SimilarHit[] | null>(null);
  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    loadEmbeddings().then((data) => {
      if (!data || cancelled) return;
      const { meta, bytes } = data;
      const target = meta.ids.indexOf(eventId);
      if (target < 0) return;
      const tscale = meta.scales[target];
      const scored: SimilarHit[] = [];
      for (let i = 0; i < meta.count; i++) {
        if (meta.ids[i] === eventId) continue;
        const s = cosineInt8(
          bytes,
          bytes,
          tscale,
          meta.scales[i],
          meta.dims,
          target * meta.dims,
          i * meta.dims,
        );
        scored.push({ id: meta.ids[i], score: s });
      }
      scored.sort((a, b) => b.score - a.score);
      if (!cancelled) setHits(scored.slice(0, 50));
    });
    return () => {
      cancelled = true;
    };
  }, [eventId]);
  return hits;
}

export default function EventDetailRoute() {
  const { id } = useParams();
  const navigate = useNavigate();
  const eventId = id ? decodeURIComponent(id) : undefined;
  const [events, setEvents] = useState<EnrichedEvent[]>([]);
  const saved = useSchedule((s) =>
    eventId ? s.savedIds.includes(eventId) : false,
  );
  const toggle = useSchedule((s) => s.toggle);
  const userCoords = useLocation((s) => s.coords);
  const locationStatus = useLocation((s) => s.status);
  const requestLocation = useLocation((s) => s.request);
  const similar = useSimilar(eventId);
  const scrollRef = useRef<HTMLElement>(null);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [eventId]);

  const event = useMemo(
    () => events.find((e) => e.id === eventId) ?? null,
    [events, eventId],
  );
  useDocumentTitle(event?.title ?? null);

  const share = useCallback(async () => {
    if (!event) return;
    const url = window.location.href;
    const shareData = { title: event.title, url };
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus("copied");
      setTimeout(() => setShareStatus("idle"), 2000);
    } catch {
      window.prompt("Kopiera länk:", url);
    }
  }, [event]);

  const goBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate("/find");
    }
  };

  useEffect(() => {
    loadEvents().then(setEvents);
  }, []);

  const similarEvents = useMemo(() => {
    if (!similar) return null;
    const byId = new Map(events.map((e) => [e.id, e]));
    const cutoff = now().getTime();
    return similar
      .map((h) => byId.get(h.id))
      .filter(
        (e): e is EnrichedEvent => !!e && new Date(e.endISO).getTime() > cutoff,
      )
      .slice(0, 6);
  }, [similar, events]);

  if (!event)
    return (
      <div className="p-6 text-sm text-[var(--color-fg-dim)]">Laddar …</div>
    );

  const speakers = event.persons ?? [];
  const duration = formatDuration(event.durationMin);
  const metaLine = [event.category, event.eventType, event.languages]
    .filter((v): v is string => !!v && v.length > 0)
    .join(" · ");
  const extraUrls = [
    event.urls?.url2,
    event.urls?.url3,
    event.urls?.url4,
  ].filter((u): u is string => !!u);
  const socials = SOCIAL_LABELS.flatMap(([key, label]) => {
    const url = event.urls?.[key];
    return url ? [{ key, label, url }] : [];
  });
  const showEmail = event.showEmail === "true";
  const showPhone = event.showPhone === "true";
  const contacts = [event.contactPerson1, event.contactPerson2].filter(
    (c): c is NonNullable<typeof c> => !!c,
  );
  const hasDigital =
    event.digitalStream === "true" ||
    !!event.digitalStreamUrl ||
    !!event.digitalArchiveUrl ||
    !!event.interactiveLink;
  const foodServed = hasFood(event);

  const eventLat = event.location?.latitude;
  const eventLng = event.location?.longitude;
  const hasCoords = eventLat != null && eventLng != null;
  const distanceMeters =
    hasCoords && userCoords
      ? haversineMeters(
          { lat: userCoords.lat, lng: userCoords.lng },
          { lat: eventLat, lng: eventLng },
        )
      : null;

  return (
    <article
      ref={scrollRef}
      className="mx-auto h-full max-w-md overflow-y-auto p-4 pb-16 md:max-w-2xl"
    >
      <button
        type="button"
        onClick={goBack}
        className="mb-3 inline-block text-xs text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"
      >
        ← Tillbaka
      </button>
      <header className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold leading-tight text-[var(--color-fg)]">
            {event.title}
          </h1>
          <button
            type="button"
            onClick={() => toggle(event.id)}
            aria-label={saved ? "Ta bort från schema" : "Spara till schema"}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl ${
              saved
                ? "bg-[var(--color-accent)] text-white"
                : "bg-[var(--color-bg)] text-[var(--color-fg-dim)]"
            }`}
          >
            {saved ? "★" : "☆"}
          </button>
        </div>
        {event.parties.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {event.parties.map((p) => (
              <Link
                key={p}
                to={`/find?parties=${encodeURIComponent(p)}`}
                className="rounded-full bg-[var(--color-accent)]/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-accent)] hover:bg-[var(--color-accent)]/30"
              >
                {p}
              </Link>
            ))}
          </div>
        )}
        <div className="text-xs text-[var(--color-fg-dim)]">
          {event.weekDayName} {event.shortDate} · {event.startTime}–
          {event.endTime}
          {duration && ` · ${duration}`}
        </div>

        {metaLine && (
          <div className="mt-1 text-xs text-[var(--color-fg-dim)]">
            {metaLine}
          </div>
        )}
        {event.location?.name && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${
              event.location.latitude != null &&
              event.location.longitude != null
                ? `${event.location.latitude},${event.location.longitude}`
                : encodeURIComponent(`${event.location.name}, Visby`)
            }`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-xs text-[var(--color-accent)] underline-offset-2 hover:underline"
          >
            📍 {event.location.name} - hitta hit!
          </a>
        )}
        {event.location?.description && (
          <div className="mt-0.5 text-xs text-[var(--color-fg-dim)]">
            {event.location.description}
          </div>
        )}
        {hasCoords && (
          <div className="mt-1 text-xs text-[var(--color-fg-dim)]">
            {distanceMeters != null ? (
              <span>📏 {formatDistance(distanceMeters)}</span>
            ) : locationStatus === "requesting" ? (
              <span>📏 Hämtar din plats …</span>
            ) : locationStatus === "denied" ? (
              <span>
                📏 Plats nekad – tillåt i webbläsaren för att se avstånd
              </span>
            ) : locationStatus === "unsupported" ? (
              <span>📏 Plats stöds inte i denna webbläsare</span>
            ) : (
              <button
                type="button"
                onClick={requestLocation}
                className="text-[var(--color-accent)] underline-offset-2 hover:underline"
              >
                📏 Visa avstånd från mig
              </button>
            )}
          </div>
        )}
        {event.topics.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {event.topics.map((t) => (
              <Link
                key={t}
                to={`/find?topics=${encodeURIComponent(t)}`}
                className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5 text-[10px] text-[var(--color-fg-dim)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
              >
                {t}
              </Link>
            ))}
          </div>
        )}
        {foodServed && (
          <div className="mt-3 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)]/20 px-2 py-0.5 text-[var(--color-accent)]">
              🍽 Mat serveras
            </span>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <button
            type="button"
            onClick={() => downloadIcs([event], icsFilename(event.title))}
            className="text-[var(--color-accent)] underline-offset-2 hover:underline"
          >
            📅 Lägg till i kalender
          </button>
          <button
            type="button"
            onClick={share}
            className="text-[var(--color-accent)] underline-offset-2 hover:underline"
          >
            {shareStatus === "copied" ? "✓ Länk kopierad" : "🔗 Dela"}
          </button>
        </div>
      </header>

      {hasDigital && (
        <section className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <h2 className="mb-2 text-[10px] uppercase tracking-wider text-[var(--color-fg-dim)]">
            Digitalt
          </h2>
          <ul className="space-y-1 text-sm">
            {event.digitalStreamUrl ? (
              <li>
                <a
                  href={event.digitalStreamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-accent)] hover:underline"
                >
                  ▶ Se direktsändning
                  {event.streamService && (
                    <span className="text-[var(--color-fg-dim)]">
                      {" "}
                      ({event.streamService})
                    </span>
                  )}
                </a>
              </li>
            ) : event.digitalStream === "true" ? (
              <li className="text-[var(--color-fg-dim)]">
                Sänds digitalt
                {event.streamService && ` via ${event.streamService}`}
              </li>
            ) : null}
            {event.digitalArchiveUrl && (
              <li>
                <a
                  href={event.digitalArchiveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-accent)] hover:underline"
                >
                  📼 Se i efterhand
                </a>
              </li>
            )}
            {event.interactiveLink && (
              <li>
                <a
                  href={event.interactiveLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-accent)] hover:underline"
                >
                  {event.interactiveLinkDescription ||
                    prettyUrl(event.interactiveLink)}
                </a>
              </li>
            )}
          </ul>
        </section>
      )}

      {event.accessibility && (
        <section className="mb-4">
          <h2 className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-fg-dim)]">
            Tillgänglighet
          </h2>
          <p className="text-sm whitespace-pre-line">{event.accessibility}</p>
        </section>
      )}

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
            {speakers.map((p, i) => {
              const party =
                p.party && p.party.toLowerCase() !== "none"
                  ? p.party.trim()
                  : null;
              return (
                <li key={`${p.name}_${i}`}>
                  <strong className="font-medium">{p.name}</strong>
                  {party && (
                    <Link
                      to={`/find?parties=${encodeURIComponent(party)}`}
                      className="ml-1 rounded-full bg-[var(--color-accent)]/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-accent)] hover:bg-[var(--color-accent)]/30"
                    >
                      {party}
                    </Link>
                  )}
                  {p.title && (
                    <span className="text-[var(--color-fg-dim)]">
                      {" "}
                      · {p.title}
                    </span>
                  )}
                  {p.organization && (
                    <span className="text-[var(--color-fg-dim)]">
                      {" · "}
                      <Link
                        to={`/find?organizations=${encodeURIComponent(p.organization)}`}
                        className="text-[var(--color-accent)] underline-offset-2 hover:underline"
                      >
                        {p.organization}
                      </Link>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {(event.urls?.url1 || extraUrls.length > 0) && (
        <section className="mb-4">
          <h2 className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-fg-dim)]">
            Länkar
          </h2>
          <ul className="space-y-1 text-sm">
            {event.urls?.url1 && (
              <li>
                <a
                  href={event.urls.url1}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-accent)] underline"
                >
                  {prettyUrl(event.urls.url1)}
                </a>
              </li>
            )}
            {extraUrls.map((u) => (
              <li key={u}>
                <a
                  href={u}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-accent)] underline"
                >
                  {prettyUrl(u)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {socials.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-fg-dim)]">
            Sociala medier
          </h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {socials.map((s) => (
              <li key={s.key}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-xs text-[var(--color-accent)] hover:underline"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {contacts.length > 0 && (showEmail || showPhone) && (
        <section className="mb-4">
          <h2 className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-fg-dim)]">
            Kontakt
          </h2>
          <ul className="space-y-2 text-sm">
            {contacts.map((c, i) => (
              <li key={`${c.name}_${i}`}>
                <div>
                  <strong className="font-medium">{c.name}</strong>
                  {c.title && (
                    <span className="text-[var(--color-fg-dim)]">
                      {" "}
                      · {c.title}
                    </span>
                  )}
                  {c.org && (
                    <span className="text-[var(--color-fg-dim)]">
                      {" "}
                      · {c.org}
                    </span>
                  )}
                </div>
                {showPhone && c.phone && (
                  <div>
                    <a
                      href={`tel:${c.phone}`}
                      className="text-[var(--color-accent)] hover:underline"
                    >
                      {c.phone}
                    </a>
                  </div>
                )}
                {showEmail && c.email && (
                  <div>
                    <a
                      href={`mailto:${c.email}`}
                      className="text-[var(--color-accent)] hover:underline"
                    >
                      {c.email}
                    </a>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
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
  );
}
