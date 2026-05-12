import ngeohash from 'ngeohash'
import type { EnrichedEvent, RawEvent } from '../src/data/types'

/**
 * Parse "HH.MM" or "HH:MM" → minutes from midnight. Returns null if malformed.
 */
function parseTime(s: string | null | undefined): number | null {
  if (!s) return null
  const m = /^(\d{1,2})[.:](\d{2})$/.exec(s.trim())
  if (!m) return null
  const h = Number(m[1])
  const mm = Number(m[2])
  if (h > 23 || mm > 59) return null
  return h * 60 + mm
}

function toISO(date: string, timeMin: number | null): string {
  const [y, mo, d] = date.split('-').map(Number)
  if (!y || !mo || !d) return ''
  const minutes = timeMin ?? 0
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mm = String(minutes % 60).padStart(2, '0')
  return `${date}T${hh}:${mm}:00+02:00`
}

export function enrichEvent(raw: RawEvent): EnrichedEvent {
  const startMin = parseTime(raw.startTime)
  const endMin = parseTime(raw.endTime)
  const durationMin =
    startMin != null && endMin != null
      ? endMin >= startMin
        ? endMin - startMin
        : 24 * 60 - startMin + endMin
      : null

  const startISO = toISO(raw.date, startMin)
  const endISO = toISO(raw.date, endMin ?? startMin)

  const parties = Array.from(
    new Set(
      (raw.persons ?? [])
        .map((p) => (p.party ?? '').trim())
        .filter((p) => p && p.toLowerCase() !== 'none'),
    ),
  )

  const topics = Array.from(
    new Set(
      [raw.topic, raw.topic2, raw.category, raw.eventType]
        .filter((x): x is string => !!x && x.trim() !== '')
        .map((x) => x.trim()),
    ),
  )

  const searchTextParts = [
    raw.title,
    raw.socialIssue,
    raw.description,
    topics.join(' '),
    raw.organizer?.join(' '),
    raw.persons?.map((p) => `${p.name} ${p.organization}`).join(' '),
    raw.location?.name,
  ].filter(Boolean)

  return {
    ...raw,
    startISO,
    endISO,
    durationMin,
    dayBucket: raw.weekDay ?? 0,
    hourBucket: startMin != null ? Math.floor(startMin / 60) : 0,
    parties,
    topics,
    searchText: searchTextParts.join('\n'),
  }
}

export function enrichAll(events: RawEvent[]): EnrichedEvent[] {
  return events.map(enrichEvent)
}

/** Helper used downstream — kept here because enrich emits the canonical geohash. */
export function eventGeohash(e: EnrichedEvent): string | null {
  const lat = e.location?.latitude
  const lng = e.location?.longitude
  if (lat == null || lng == null) return null
  return ngeohash.encode(lat, lng, 7)
}
