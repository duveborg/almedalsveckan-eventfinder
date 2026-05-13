import { readFile, writeFile, mkdir } from 'node:fs/promises'
import OpenAI from 'openai'
import type { EventsFile } from '../src/data/types'

const MODEL = 'text-embedding-3-small' // 1536 dims
const DIMS = 1536
const BATCH = 32

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function embedBatch(client: OpenAI, texts: string[]): Promise<number[][]> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await client.embeddings.create({ model: MODEL, input: texts })
      return res.data.map((d) => d.embedding)
    } catch (err) {
      const e = err as { status?: number; headers?: Record<string, string> }
      if (e.status === 429) {
        const retryAfter = Number(
          (e.headers as { 'retry-after'?: string } | undefined)?.['retry-after'] ?? '',
        )
        const wait = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Math.min(60000, 2000 * 2 ** attempt)
        console.log(`[embed] rate-limited, sleeping ${Math.round(wait / 1000)}s`)
        await sleep(wait)
        continue
      }
      throw err
    }
  }
  throw new Error('embed: exhausted retries')
}

/** Quantize Float32 → Int8 with per-row max scaling (preserves cosine similarity). */
function quantize(vectors: number[][]): { bytes: Int8Array; scales: number[] } {
  const n = vectors.length
  const d = vectors[0].length
  const bytes = new Int8Array(n * d)
  const scales = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    const v = vectors[i]
    let max = 0
    for (let j = 0; j < d; j++) {
      const a = Math.abs(v[j])
      if (a > max) max = a
    }
    const scale = max > 0 ? max / 127 : 1
    scales[i] = scale
    for (let j = 0; j < d; j++) {
      const q = Math.round(v[j] / scale)
      bytes[i * d + j] = Math.max(-128, Math.min(127, q))
    }
  }
  return { bytes, scales }
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error(
      'OPENAI_API_KEY is not set. Run `OPENAI_API_KEY=sk-... npm run embed`.',
    )
    process.exit(1)
  }
  const client = new OpenAI({ apiKey })

  const file = JSON.parse(
    await readFile('src/data/generated/events.json', 'utf8'),
  ) as EventsFile
  console.log(`[embed] embedding ${file.events.length} events with ${MODEL}`)

  const vectors: number[][] = new Array(file.events.length)
  for (let i = 0; i < file.events.length; i += BATCH) {
    const slice = file.events.slice(i, i + BATCH)
    const texts = slice.map((e) =>
      e.searchText.length > 8000 ? e.searchText.slice(0, 8000) : e.searchText,
    )
    const out = await embedBatch(client, texts)
    for (let k = 0; k < out.length; k++) {
      vectors[i + k] = out[k]
      if (out[k].length !== DIMS)
        throw new Error(`unexpected dim ${out[k].length}`)
    }
    console.log(
      `[embed] ${Math.min(i + BATCH, file.events.length)}/${file.events.length}`,
    )
  }

  const { bytes, scales } = quantize(vectors)

  await mkdir('src/data/generated', { recursive: true })
  await writeFile('src/data/generated/embeddings.bin', bytes)
  await writeFile(
    'src/data/generated/embeddings-meta.json',
    JSON.stringify({
      model: MODEL,
      dims: DIMS,
      count: file.events.length,
      ids: file.events.map((e) => e.id),
      scales,
      generatedAt: new Date().toISOString(),
    }),
  )
  const sizeMb = (bytes.byteLength / 1024 / 1024).toFixed(2)
  console.log(
    `[embed] wrote src/data/generated/embeddings.bin (${sizeMb} MB) and embeddings-meta.json`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
