import type { EnrichedEvent } from '../data/types'

export function buildIcs(events: EnrichedEvent[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//almedalen-app//SE',
    'CALSCALE:GREGORIAN',
  ]
  for (const e of events) {
    const dtStart = new Date(e.startISO).toISOString().replace(/[-:]|\.\d{3}/g, '')
    const dtEnd = new Date(e.endISO).toISOString().replace(/[-:]|\.\d{3}/g, '')
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@almedalen-app`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${e.title.replace(/[\r\n,;]/g, ' ')}`,
      `LOCATION:${(e.location?.name ?? '').replace(/[\r\n,;]/g, ' ')}`,
      `URL:${e.url}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadIcs(events: EnrichedEvent[], filename: string) {
  const blob = new Blob([buildIcs(events)], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
