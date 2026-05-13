import type { EnrichedEvent } from '../data/types'

export function overlaps(a: EnrichedEvent, b: EnrichedEvent): boolean {
  if (a.id === b.id || a.date !== b.date) return false
  const as = new Date(a.startISO).getTime()
  const ae = new Date(a.endISO).getTime()
  const bs = new Date(b.startISO).getTime()
  const be = new Date(b.endISO).getTime()
  return as < be && bs < ae
}
