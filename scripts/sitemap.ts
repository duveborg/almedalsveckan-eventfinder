import { readFile, writeFile } from 'node:fs/promises'
import type { EventsFile } from '../src/data/types'

const SITE_URL = 'https://almedalsveckan-eventfinder.pages.dev'
const EVENTS_PATH = 'public/events.json'
const OUT_PATH = 'public/sitemap.xml'

const STATIC_PATHS: Array<{ path: string; priority: string; changefreq: string }> = [
  { path: '/find', priority: '1.0', changefreq: 'hourly' },
  { path: '/map', priority: '0.8', changefreq: 'daily' },
  { path: '/search', priority: '0.7', changefreq: 'daily' },
  { path: '/about', priority: '0.3', changefreq: 'monthly' },
]

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      default: return '&apos;'
    }
  })
}

async function main() {
  const data: EventsFile = JSON.parse(await readFile(EVENTS_PATH, 'utf8'))
  const today = new Date().toISOString().slice(0, 10)

  const urls: string[] = []

  urls.push(
    `  <url>\n    <loc>${SITE_URL}/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>hourly</changefreq>\n    <priority>1.0</priority>\n  </url>`,
  )

  for (const s of STATIC_PATHS) {
    urls.push(
      `  <url>\n    <loc>${SITE_URL}${s.path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${s.changefreq}</changefreq>\n    <priority>${s.priority}</priority>\n  </url>`,
    )
  }

  for (const e of data.events) {
    const loc = `${SITE_URL}/event/${encodeURIComponent(e.id)}`
    urls.push(
      `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
    )
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`

  await writeFile(OUT_PATH, xml)
  console.log(`[sitemap] wrote ${OUT_PATH} (${urls.length} urls)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
