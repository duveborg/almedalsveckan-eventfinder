export interface GalaxyPoint {
  id: string
  x: number
  y: number
  cluster: number
  label: string
  color: string
}

export interface GalaxyFile {
  count: number
  generatedAt: string
  points: GalaxyPoint[]
}

let cache: Promise<GalaxyFile | null> | null = null

export function loadGalaxy(): Promise<GalaxyFile | null> {
  if (!cache) {
    cache = fetch('/umap.json')
      .then((r) => (r.ok ? (r.json() as Promise<GalaxyFile>) : null))
      .catch(() => null)
  }
  return cache
}

export interface EmbeddingsMeta {
  dims: number
  count: number
  ids: string[]
  scales: number[]
}

let embedCache: Promise<{ meta: EmbeddingsMeta; bytes: Int8Array } | null> | null =
  null

export function loadEmbeddings(): Promise<{
  meta: EmbeddingsMeta
  bytes: Int8Array
} | null> {
  if (!embedCache) {
    embedCache = (async () => {
      try {
        const [metaRes, binRes] = await Promise.all([
          fetch('/embeddings-meta.json'),
          fetch('/embeddings.bin'),
        ])
        if (!metaRes.ok || !binRes.ok) return null
        const meta = (await metaRes.json()) as EmbeddingsMeta
        const buf = await binRes.arrayBuffer()
        return { meta, bytes: new Int8Array(buf) }
      } catch {
        return null
      }
    })()
  }
  return embedCache
}

export function cosineInt8(
  a: Int8Array,
  b: Int8Array,
  ascale: number,
  bscale: number,
  dims: number,
  aOffset = 0,
  bOffset = 0,
): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < dims; i++) {
    const ai = a[aOffset + i] * ascale
    const bi = b[bOffset + i] * bscale
    dot += ai * bi
    na += ai * ai
    nb += bi * bi
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1)
}

export interface Ranked {
  id: string
  score: number
}

export function rankByCentroid(
  meta: EmbeddingsMeta,
  bytes: Int8Array,
  seedIds: string[],
  exclude: Set<string> = new Set(),
): Ranked[] {
  const { dims, count, ids, scales } = meta
  const seedIdx: number[] = []
  for (const id of seedIds) {
    const i = ids.indexOf(id)
    if (i >= 0) seedIdx.push(i)
  }
  if (seedIdx.length === 0) return []

  const centroid = new Float64Array(dims)
  for (const i of seedIdx) {
    const scale = scales[i]
    const base = i * dims
    for (let j = 0; j < dims; j++) centroid[j] += bytes[base + j] * scale
  }
  let cnorm = 0
  for (let j = 0; j < dims; j++) {
    centroid[j] /= seedIdx.length
    cnorm += centroid[j] * centroid[j]
  }
  cnorm = Math.sqrt(cnorm) || 1

  const skip = new Set(exclude)
  for (const id of seedIds) skip.add(id)
  const out: Ranked[] = []
  for (let i = 0; i < count; i++) {
    const id = ids[i]
    if (skip.has(id)) continue
    const scale = scales[i]
    const base = i * dims
    let dot = 0
    let nb = 0
    for (let j = 0; j < dims; j++) {
      const v = bytes[base + j] * scale
      dot += centroid[j] * v
      nb += v * v
    }
    out.push({ id, score: dot / (cnorm * (Math.sqrt(nb) || 1)) })
  }
  out.sort((a, b) => b.score - a.score)
  return out
}
