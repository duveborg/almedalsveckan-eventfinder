import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { EnrichedEvent, EventsFile } from '../src/data/types'

const SITE_URL = 'https://almedalen.app'
const DIST = 'dist'
const EVENTS_PATH = 'src/data/generated/events.json'

const DEFAULT_DESCRIPTION =
  'Hitta evenemang under Almedalsveckan 2026 — karta, schema, rekommendationer, sök och vad som händer just nu.'

interface StaticPage {
  path: string
  title: string
  description: string
}

const STATIC_PAGES: StaticPage[] = [
  {
    path: '/map',
    title: 'Karta — Almedalen 2026',
    description: 'Karta över alla evenemang under Almedalsveckan 2026.',
  },
  {
    path: '/search',
    title: 'Sök — Almedalen 2026',
    description: 'Sök bland alla evenemang under Almedalsveckan 2026.',
  },
  {
    path: '/about',
    title: 'Om — Almedalen 2026',
    description: 'Om appen Almedalen 2026 — ett alternativt sätt att navigera Almedalsveckans program.',
  },
]

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + '…'
}

function eventDescription(e: EnrichedEvent): string {
  const parts: string[] = []
  parts.push(`${e.weekDayName} ${e.shortDate} kl ${e.startTime}–${e.endTime}`)
  if (e.location?.name) parts.push(e.location.name)
  if (e.organizer?.length) parts.push(e.organizer.join(', '))
  const head = parts.join(' · ')
  const body = (e.description || e.socialIssue || '').replace(/\s+/g, ' ').trim()
  return truncate(body ? `${head}. ${body}` : head, 280)
}

function eventJsonLd(e: EnrichedEvent): string {
  const url = `${SITE_URL}/event/${encodeURIComponent(e.id)}`
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.title,
    startDate: e.startISO,
    endDate: e.endISO,
    eventStatus: 'https://schema.org/EventScheduled',
    url,
  }
  if (e.description) ld.description = e.description
  if (e.location?.name) {
    const loc: Record<string, unknown> = {
      '@type': 'Place',
      name: e.location.name,
      address: { '@type': 'PostalAddress', addressLocality: 'Visby', addressCountry: 'SE' },
    }
    if (e.location.latitude != null && e.location.longitude != null) {
      loc.geo = {
        '@type': 'GeoCoordinates',
        latitude: e.location.latitude,
        longitude: e.location.longitude,
      }
    }
    ld.location = loc
  }
  const hasDigital =
    e.digitalStream === 'true' || !!e.digitalStreamUrl || !!e.interactiveLink
  if (e.location?.name && hasDigital) {
    ld.eventAttendanceMode = 'https://schema.org/MixedEventAttendanceMode'
  } else if (hasDigital) {
    ld.eventAttendanceMode = 'https://schema.org/OnlineEventAttendanceMode'
  } else {
    ld.eventAttendanceMode = 'https://schema.org/OfflineEventAttendanceMode'
  }
  if (e.organizer?.length) {
    ld.organizer = e.organizer.map((name) => ({ '@type': 'Organization', name }))
  }
  return `<script type="application/ld+json">${JSON.stringify(ld)
    .replace(/</g, '\\u003c')}</script>`
}

const REPLACERS: Array<{ re: RegExp; build: (v: string) => string }> = [
  { re: /<title>[^<]*<\/title>/, build: (v) => `<title>${escapeHtml(v)}</title>` },
  {
    re: /<meta name="description"[^>]*\/>/,
    build: (v) => `<meta name="description" content="${escapeHtml(v)}" />`,
  },
  {
    re: /<link rel="canonical"[^>]*\/>/,
    build: (v) => `<link rel="canonical" href="${escapeHtml(v)}" />`,
  },
  {
    re: /<meta property="og:title"[^>]*\/>/,
    build: (v) => `<meta property="og:title" content="${escapeHtml(v)}" />`,
  },
  {
    re: /<meta property="og:description"[^>]*\/>/,
    build: (v) => `<meta property="og:description" content="${escapeHtml(v)}" />`,
  },
  {
    re: /<meta property="og:url"[^>]*\/>/,
    build: (v) => `<meta property="og:url" content="${escapeHtml(v)}" />`,
  },
  {
    re: /<meta property="og:type"[^>]*\/>/,
    build: (v) => `<meta property="og:type" content="${escapeHtml(v)}" />`,
  },
  {
    re: /<meta name="twitter:title"[^>]*\/>/,
    build: (v) => `<meta name="twitter:title" content="${escapeHtml(v)}" />`,
  },
  {
    re: /<meta name="twitter:description"[^>]*\/>/,
    build: (v) => `<meta name="twitter:description" content="${escapeHtml(v)}" />`,
  },
]

interface Patch {
  title: string
  description: string
  canonical: string
  ogType: 'website' | 'article'
  jsonLd?: string
}

function applyHead(template: string, p: Patch): string {
  const map: Record<string, string> = {
    '<title>': p.title,
    '<meta name="description"': p.description,
    '<link rel="canonical"': p.canonical,
    '<meta property="og:title"': p.title,
    '<meta property="og:description"': p.description,
    '<meta property="og:url"': p.canonical,
    '<meta property="og:type"': p.ogType,
    '<meta name="twitter:title"': p.title,
    '<meta name="twitter:description"': p.description,
  }
  let out = template
  for (const { re, build } of REPLACERS) {
    const match = re.exec(out)
    if (!match) continue
    const prefix = Object.keys(map).find((k) => match[0].startsWith(k))
    if (!prefix) continue
    out = out.replace(re, build(map[prefix]))
  }
  if (p.jsonLd) out = out.replace('</head>', `  ${p.jsonLd}\n  </head>`)
  return out
}

async function writePage(relPath: string, html: string): Promise<void> {
  const filePath = path.join(DIST, relPath.replace(/^\//, ''), 'index.html')
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, html)
}

async function main(): Promise<void> {
  const template = await readFile(path.join(DIST, 'index.html'), 'utf8')
  const data: EventsFile = JSON.parse(await readFile(EVENTS_PATH, 'utf8'))

  for (const page of STATIC_PAGES) {
    const html = applyHead(template, {
      title: page.title,
      description: page.description,
      canonical: `${SITE_URL}${page.path}`,
      ogType: 'website',
    })
    await writePage(page.path, html)
  }

  let count = 0
  for (const e of data.events) {
    const desc = eventDescription(e) || DEFAULT_DESCRIPTION
    const html = applyHead(template, {
      title: `${e.title} — Almedalen 2026`,
      description: desc,
      canonical: `${SITE_URL}/event/${encodeURIComponent(e.id)}`,
      ogType: 'article',
      jsonLd: eventJsonLd(e),
    })
    await writePage(`/event/${e.id}`, html)
    count++
  }

  console.log(
    `[prerender] wrote ${STATIC_PAGES.length} static + ${count} event pages`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
