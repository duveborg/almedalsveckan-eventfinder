import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { scrapeAll } from './scrape'
import { enrichAll } from './enrich'
import type { EventsFile, RawEvent } from '../src/data/types'

const RAW_PATH = 'data/events-raw.json'
const OUT_PATH = 'public/events.json'

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function main() {
  const useCache = process.argv.includes('--cache')
  let raw: RawEvent[]
  if (useCache && (await fileExists(RAW_PATH))) {
    console.log(`[build] using cached ${RAW_PATH}`)
    raw = JSON.parse(await readFile(RAW_PATH, 'utf8'))
  } else {
    raw = await scrapeAll()
    await mkdir('data', { recursive: true })
    await writeFile(RAW_PATH, JSON.stringify(raw))
    console.log(`[build] wrote ${RAW_PATH} (${raw.length} events)`)
  }

  const events = enrichAll(raw)
  const out: EventsFile = {
    generatedAt: new Date().toISOString(),
    count: events.length,
    events,
  }
  await mkdir('public', { recursive: true })
  await writeFile(OUT_PATH, JSON.stringify(out))
  const sizeKb = Math.round(
    Buffer.byteLength(JSON.stringify(out)) / 1024,
  )
  console.log(`[build] wrote ${OUT_PATH} (${events.length} events, ${sizeKb} KB)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
