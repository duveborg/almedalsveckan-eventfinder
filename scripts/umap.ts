import { readFile, writeFile } from 'node:fs/promises'
import { UMAP } from 'umap-js'
import type { EventsFile } from '../src/data/types'

interface EmbeddingsMeta {
  dims: number
  count: number
  ids: string[]
  scales: number[]
}

function dequantize(bytes: Int8Array, dims: number, scales: number[]): number[][] {
  const n = scales.length
  const out: number[][] = new Array(n)
  for (let i = 0; i < n; i++) {
    const v = new Array<number>(dims)
    const scale = scales[i]
    for (let j = 0; j < dims; j++) {
      v[j] = bytes[i * dims + j] * scale
    }
    out[i] = v
  }
  return out
}

interface ClusterAssignment {
  cluster: number
  label: string
}

function assignClustersByTopic(
  events: EventsFile['events'],
): ClusterAssignment[] {
  const topicToCluster = new Map<string, number>()
  const labels: string[] = []
  return events.map((e) => {
    const topic = e.topic ?? e.category ?? 'Övrigt'
    let id = topicToCluster.get(topic)
    if (id == null) {
      id = labels.length
      topicToCluster.set(topic, id)
      labels.push(topic)
    }
    return { cluster: id, label: labels[id] }
  })
}

async function main() {
  const meta: EmbeddingsMeta = JSON.parse(
    await readFile('public/embeddings-meta.json', 'utf8'),
  )
  const bytes = new Int8Array(
    (await readFile('public/embeddings.bin')).buffer,
  )
  const file: EventsFile = JSON.parse(
    await readFile('public/events.json', 'utf8'),
  )

  console.log(`[umap] dequantizing ${meta.count}×${meta.dims}`)
  const vectors = dequantize(bytes, meta.dims, meta.scales)

  console.log('[umap] running UMAP to 2D (~30-60s)')
  const umap = new UMAP({
    nComponents: 2,
    nNeighbors: 15,
    minDist: 0.1,
    spread: 1.0,
  })
  const embedding = umap.fit(vectors)

  const clusters = assignClustersByTopic(file.events)

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity
  for (const [x, y] of embedding) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const w = maxX - minX || 1
  const h = maxY - minY || 1

  const points = file.events.map((e, i) => ({
    id: e.id,
    x: (embedding[i][0] - minX) / w,
    y: (embedding[i][1] - minY) / h,
    cluster: clusters[i].cluster,
    label: clusters[i].label,
    color: e.color?.main ?? '#f8651f',
  }))

  await writeFile(
    'public/umap.json',
    JSON.stringify({
      count: points.length,
      generatedAt: new Date().toISOString(),
      points,
    }),
  )
  console.log(`[umap] wrote public/umap.json (${points.length} points)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
