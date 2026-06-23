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
    title: 'Karta — Almedalsveckan 2026',
    description: 'Karta över alla evenemang under Almedalsveckan 2026.',
  },
  {
    path: '/search',
    title: 'Sök — Almedalsveckan 2026',
    description: 'Sök bland alla evenemang under Almedalsveckan 2026.',
  },
  {
    path: '/about',
    title: 'Om — Almedalsveckan 2026',
    description: 'Om appen Almedalsveckan 2026 — ett alternativt sätt att navigera Almedalsveckans program.',
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
    // Every event shares the site's social image — better than omitting `image`,
    // which Google flags as a missing recommended field.
    image: `${SITE_URL}/og.jpg`,
  }
  // Always emit a description: fall back to socialIssue, then the generated
  // head line, so no event is missing this recommended field.
  const description = (e.description || e.socialIssue || eventDescription(e))
    .replace(/\s+/g, ' ')
    .trim()
  if (description) ld.description = description
  // Google requires `location` on Event — fall back to location.description
  // (often the venue name) and, failing that, to Visby where all events are held.
  const desc = e.location?.description
  const venueName =
    e.location?.name ?? (typeof desc === 'string' && desc.trim() ? desc.trim() : null)
  const hasDigital =
    e.digitalStream === 'true' || !!e.digitalStreamUrl || !!e.interactiveLink
  const streamUrl = e.digitalStreamUrl || e.interactiveLink
  if (!venueName && hasDigital && streamUrl) {
    ld.location = { '@type': 'VirtualLocation', url: streamUrl }
    ld.eventAttendanceMode = 'https://schema.org/OnlineEventAttendanceMode'
  } else {
    const loc: Record<string, unknown> = {
      '@type': 'Place',
      name: venueName ?? 'Visby',
      address: { '@type': 'PostalAddress', addressLocality: 'Visby', addressCountry: 'SE' },
    }
    if (e.location?.latitude != null && e.location?.longitude != null) {
      loc.geo = {
        '@type': 'GeoCoordinates',
        latitude: e.location.latitude,
        longitude: e.location.longitude,
      }
    }
    ld.location = loc
    ld.eventAttendanceMode = hasDigital
      ? 'https://schema.org/MixedEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode'
  }
  if (e.organizer?.length) {
    // Best-effort organizer website: prefer the event's primary external link,
    // then social links, so the recommended `organizer.url` field is present.
    const orgUrl =
      e.urls?.url1 ||
      e.urls?.facebookUrl ||
      e.urls?.linkedinUrl ||
      e.urls?.instagramUrl ||
      null
    ld.organizer = e.organizer.map((name, i) =>
      i === 0 && orgUrl
        ? { '@type': 'Organization', name, url: orgUrl }
        : { '@type': 'Organization', name },
    )
  }
  // Speakers → performers.
  const performers = (e.persons ?? [])
    .filter((p) => p.name?.trim())
    .map((p) => ({ '@type': 'Person', name: p.name.trim() }))
  if (performers.length) ld.performer = performers
  // Almedalsveckan events are free and open to the public.
  ld.offers = {
    '@type': 'Offer',
    price: 0,
    priceCurrency: 'SEK',
    availability: 'https://schema.org/InStock',
    url,
    validFrom: e.startISO,
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
      title: `${e.title} — Almedalsveckan 2026`,
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
