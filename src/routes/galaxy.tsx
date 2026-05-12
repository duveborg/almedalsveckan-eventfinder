import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadEvents } from '../data/load'
import type { EnrichedEvent } from '../data/types'
import { loadGalaxy, type GalaxyPoint } from '../data/galaxy'
import { keywordSearch } from '../data/search'

interface Viewport {
  scale: number
  tx: number
  ty: number
}

const DEFAULT_VIEWPORT: Viewport = { scale: 1, tx: 0, ty: 0 }

function pointInWorld(p: GalaxyPoint, w: number, h: number) {
  const pad = 24
  return {
    x: pad + p.x * (w - pad * 2),
    y: pad + p.y * (h - pad * 2),
  }
}

function topClusterLabels(points: GalaxyPoint[], n: number): string[] {
  const counts = new Map<string, number>()
  for (const p of points) {
    counts.set(p.label, (counts.get(p.label) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label]) => label)
}

export default function GalaxyRoute() {
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [events, setEvents] = useState<EnrichedEvent[]>([])
  const [galaxy, setGalaxy] = useState<GalaxyPoint[] | null>(null)
  const [missing, setMissing] = useState(false)
  const [query, setQuery] = useState('')
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT)
  const [hovered, setHovered] = useState<GalaxyPoint | null>(null)
  const [activeClusters, setActiveClusters] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadEvents().then(setEvents)
    loadGalaxy().then((g) => {
      if (!g) setMissing(true)
      else setGalaxy(g.points)
    })
  }, [])

  const matchIds = useMemo(() => {
    if (!query.trim()) return null
    return new Set(keywordSearch(events, query).map((e) => e.id))
  }, [events, query])

  const clusterLabels = useMemo(
    () => (galaxy ? topClusterLabels(galaxy, 8) : []),
    [galaxy],
  )

  const eventById = useMemo(
    () => new Map(events.map((e) => [e.id, e])),
    [events],
  )

  useEffect(() => {
    if (!galaxy || !canvasRef.current || !containerRef.current) return
    const canvas = canvasRef.current
    const container = containerRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = container.clientWidth
    const h = container.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    ctx.translate(viewport.tx, viewport.ty)
    ctx.scale(viewport.scale, viewport.scale)

    const radius = 3 / viewport.scale
    for (const p of galaxy) {
      const dim =
        (matchIds && !matchIds.has(p.id)) ||
        (activeClusters.size > 0 && !activeClusters.has(p.label))
      const { x, y } = pointInWorld(p, w, h)
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fillStyle = dim ? 'rgba(120, 110, 130, 0.15)' : p.color
      ctx.fill()
    }
  }, [galaxy, viewport, matchIds, activeClusters])

  useEffect(() => {
    if (!galaxy || !canvasRef.current || !containerRef.current) return
    const canvas = canvasRef.current
    const container = containerRef.current

    let dragging = false
    let lastX = 0
    let lastY = 0
    let startX = 0
    let startY = 0
    let moved = false

    const onPointerDown = (e: PointerEvent) => {
      dragging = true
      moved = false
      lastX = e.clientX
      lastY = e.clientY
      startX = e.clientX
      startY = e.clientY
      canvas.setPointerCapture(e.pointerId)
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) > 4)
        moved = true
      setViewport((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }))
    }
    const onPointerUp = (e: PointerEvent) => {
      dragging = false
      canvas.releasePointerCapture(e.pointerId)
      if (moved) return
      const rect = canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const w = container.clientWidth
      const h = container.clientHeight
      const wx = (cx - viewport.tx) / viewport.scale
      const wy = (cy - viewport.ty) / viewport.scale
      let nearest: GalaxyPoint | null = null
      let nearestDist = Infinity
      for (const p of galaxy) {
        const pt = pointInWorld(p, w, h)
        const d = (pt.x - wx) ** 2 + (pt.y - wy) ** 2
        if (d < nearestDist) {
          nearestDist = d
          nearest = p
        }
      }
      if (nearest && nearestDist < 144 / viewport.scale ** 2) {
        navigate(`/event/${encodeURIComponent(nearest.id)}`)
      }
    }
    const onMove = (e: PointerEvent) => {
      if (dragging) return
      const rect = canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const w = container.clientWidth
      const h = container.clientHeight
      const wx = (cx - viewport.tx) / viewport.scale
      const wy = (cy - viewport.ty) / viewport.scale
      let nearest: GalaxyPoint | null = null
      let nearestDist = Infinity
      for (const p of galaxy) {
        const pt = pointInWorld(p, w, h)
        const d = (pt.x - wx) ** 2 + (pt.y - wy) ** 2
        if (d < nearestDist) {
          nearestDist = d
          nearest = p
        }
      }
      setHovered(
        nearest && nearestDist < 100 / viewport.scale ** 2 ? nearest : null,
      )
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      setViewport((v) => {
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
        const newScale = Math.max(0.4, Math.min(20, v.scale * factor))
        const ratio = newScale / v.scale
        return {
          scale: newScale,
          tx: cx - (cx - v.tx) * ratio,
          ty: cy - (cy - v.ty) * ratio,
        }
      })
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [galaxy, navigate, viewport])

  const toggleCluster = (label: string) =>
    setActiveClusters((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })

  if (missing)
    return (
      <section className="mx-auto h-full max-w-md overflow-y-auto p-6">
        <h1 className="mb-2 text-2xl font-semibold">Galax</h1>
        <p className="mb-4 text-sm text-[var(--color-fg-dim)]">
          Embeddings + UMAP-layouten saknas. Kör i terminalen:
        </p>
        <pre className="rounded bg-[var(--color-surface)] p-3 text-xs">
          {`OPENAI_API_KEY=sk-... npm run embed
npm run umap`}
        </pre>
        <p className="mt-3 text-xs text-[var(--color-fg-dim)]">
          När det är klart visas alla {events.length || '2161'} event i en
          semantisk karta här.
        </p>
      </section>
    )

  return (
    <section className="relative h-full">
      <div ref={containerRef} className="absolute inset-0 bg-[var(--color-bg)]">
        <canvas ref={canvasRef} className="block cursor-grab active:cursor-grabbing" />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3">
        <div className="pointer-events-auto mx-auto w-full max-w-md">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök i 2161 event …"
            className="w-full rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/95 px-4 py-2.5 text-sm placeholder:text-[var(--color-fg-dim)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </div>
        {clusterLabels.length > 0 && (
          <div className="pointer-events-auto mx-auto flex max-w-md flex-wrap justify-center gap-1">
            {clusterLabels.map((label) => {
              const active = activeClusters.has(label)
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleCluster(label)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] backdrop-blur ${
                    active
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-black'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)]/80 text-[var(--color-fg-dim)]'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {hovered && eventById.get(hovered.id) && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 w-[min(92vw,420px)] -translate-x-1/2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/97 p-3 backdrop-blur">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-dim)]">
            {hovered.label}
          </div>
          <div className="text-sm font-semibold">
            {eventById.get(hovered.id)!.title}
          </div>
          <div className="mt-1 text-xs text-[var(--color-fg-dim)]">
            {eventById.get(hovered.id)!.weekDayName}{' '}
            {eventById.get(hovered.id)!.startTime} ·{' '}
            {eventById.get(hovered.id)!.location?.name ?? 'digitalt'}
          </div>
        </div>
      )}

      <div className="absolute bottom-4 right-4 z-10 flex gap-2">
        <button
          type="button"
          onClick={() => setViewport(DEFAULT_VIEWPORT)}
          className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/95 px-3 py-1.5 text-xs backdrop-blur"
        >
          ⟲ Återställ
        </button>
      </div>
    </section>
  )
}
