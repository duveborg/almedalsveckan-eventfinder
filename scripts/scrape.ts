import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { RawEvent } from '../src/data/types'

const BASE =
  'https://almedalsveckan.info/appresource/4.356a004a19b2bf461ebf29b3/12.356a004a19b2bf461ebf29be/items'

const START_DATE = '2026-06-22'
const END_DATE = '2026-06-26'
const PAGE_SIZE = 30

interface ApiResponse {
  items: RawEvent[]
  count: number
}

async function fetchPage(start: number): Promise<ApiResponse> {
  const url = `${BASE}?start=${start}&startDate=${START_DATE}&endDate=${END_DATE}&sortOption=date`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for start=${start}`)
  return res.json()
}

export async function scrapeAll(): Promise<RawEvent[]> {
  const first = await fetchPage(0)
  const total = first.count
  const pages = Math.ceil(total / PAGE_SIZE)
  console.log(`[scrape] total=${total} pages=${pages}`)

  const all: RawEvent[] = [...first.items]
  for (let i = 1; i < pages; i++) {
    const start = i * PAGE_SIZE
    const page = await fetchPage(start)
    all.push(...page.items)
    if (i % 10 === 0 || i === pages - 1) {
      console.log(`[scrape] fetched page ${i + 1}/${pages} (${all.length} events)`)
    }
  }
  const seen = new Set<string>()
  const unique = all.filter((e) => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })
  if (unique.length !== all.length) {
    console.log(`[scrape] de-duped ${all.length - unique.length} duplicate events`)
  }
  return unique
}

async function writeJson(path: string, data: unknown) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(data))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  scrapeAll()
    .then(async (events) => {
      await writeJson('data/events-raw.json', events)
      console.log(`[scrape] wrote data/events-raw.json (${events.length} events)`)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
