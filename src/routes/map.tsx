import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import maplibregl, {
  type GeoJSONSource,
  type MapGeoJSONFeature,
  type StyleSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { loadEvents } from '../data/load'
import type { EnrichedEvent } from '../data/types'
import {
  FOOD_FILTERS,
  matchesFoodFilter,
  type FoodFilter,
} from '../data/food'
import { EventCard } from '../components/EventCard'

const WEEK_DAYS = [
  { date: '2026-06-22', label: 'Mån' },
  { date: '2026-06-23', label: 'Tis' },
  { date: '2026-06-24', label: 'Ons' },
  { date: '2026-06-25', label: 'Tor' },
  { date: '2026-06-26', label: 'Fre' },
]

const VISBY: [number, number] = [18.296, 57.638]

const OSM_STYLE: StyleSpecification = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    osm: {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}

function shortRelativeTime(event: EnrichedEvent, now: Date): string {
  const start = new Date(event.startISO).getTime()
  const end = new Date(event.endISO).getTime()
  const t = now.getTime()
  if (t > end) return ''
  if (t >= start) return 'nu'
  const min = Math.round((start - t) / 60000)
  if (min < 60) return `${min}m`
  const h = Math.round(min / 60)
  if (h < 24) return `${h}h`
  const d = Math.round(h / 24)
  return `${d}d`
}

function toGeoJSON(
  events: EnrichedEvent[],
  now: Date,
): GeoJSON.FeatureCollection<
  GeoJSON.Point,
  { id: string; color: string; label: string }
> {
  return {
    type: 'FeatureCollection',
    features: events
      .filter(
        (e) =>
          e.location?.longitude != null && e.location?.latitude != null,
      )
      .map((e) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [e.location!.longitude!, e.location!.latitude!],
        },
        properties: {
          id: e.id,
          color: e.color?.main ?? '#ff7a3a',
          label: shortRelativeTime(e, now),
        },
      })),
  }
}

export default function MapRoute() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const navigate = useNavigate()

  const [events, setEvents] = useState<EnrichedEvent[]>([])
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [foodFilter, setFoodFilter] = useState<FoodFilter>('all')
  const [focusedIds, setFocusedIds] = useState<string[]>([])
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    loadEvents().then(setEvents)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const filtered = useMemo(
    () =>
      events.filter((e) => {
        if (selectedDay && e.date !== selectedDay) return false
        if (!matchesFoodFilter(e, foodFilter)) return false
        return true
      }),
    [events, selectedDay, foodFilter],
  )

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: VISBY,
      zoom: 14,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      'top-right',
    )

    map.on('load', () => {
      map.addSource('events', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 16,
        clusterRadius: 40,
      })

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'events',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#ff7a3a',
          'circle-opacity': 0.9,
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            16,
            10,
            22,
            50,
            28,
            150,
            36,
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#0c0a14',
        },
      })

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'events',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-size': 12,
          'text-font': ['Noto Sans Bold'],
        },
        paint: { 'text-color': '#0c0a14' },
      })

      map.addLayer({
        id: 'event-points',
        type: 'circle',
        source: 'events',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 7,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#0c0a14',
        },
      })

      map.addLayer({
        id: 'event-labels',
        type: 'symbol',
        source: 'events',
        filter: [
          'all',
          ['!', ['has', 'point_count']],
          ['!=', ['get', 'label'], ''],
        ],
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 11,
          'text-font': ['Noto Sans Bold'],
          'text-anchor': 'bottom',
          'text-offset': [0, -0.9],
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-optional': true,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#0c0a14',
          'text-halo-width': 1.5,
        },
      })

      map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['clusters'],
        })
        const clusterId = features[0]?.properties?.cluster_id as number | undefined
        if (clusterId == null) return
        const source = map.getSource('events') as GeoJSONSource
        source.getClusterExpansionZoom(clusterId).then((zoom) => {
          const geom = features[0].geometry as GeoJSON.Point
          map.easeTo({
            center: geom.coordinates as [number, number],
            zoom,
          })
        })
      })

      map.on('click', 'event-points', (e) => {
        const features = e.features as MapGeoJSONFeature[] | undefined
        if (!features?.length) return
        const ids = features.map((f) => f.properties.id as string)
        setFocusedIds(ids)
      })

      map.on('mouseenter', 'clusters', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'clusters', () => {
        map.getCanvas().style.cursor = ''
      })
      map.on('mouseenter', 'event-points', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'event-points', () => {
        map.getCanvas().style.cursor = ''
      })
    })

    mapRef.current = map
    const resizeObserver = new ResizeObserver(() => map.resize())
    resizeObserver.observe(containerRef.current)
    return () => {
      resizeObserver.disconnect()
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      const source = map.getSource('events') as GeoJSONSource | undefined
      if (!source) return
      source.setData(toGeoJSON(filtered, now))
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [filtered, now])

  const focusedEvents = useMemo(
    () => events.filter((e) => focusedIds.includes(e.id)),
    [events, focusedIds],
  )

  return (
    <section className="relative h-full">
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center gap-2 p-3">
        <div className="pointer-events-auto flex gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-1 text-xs backdrop-blur">
          <button
            type="button"
            onClick={() => setSelectedDay(null)}
            className={`rounded-full px-3 py-1 ${
              selectedDay === null
                ? 'bg-[var(--color-accent)] text-black'
                : 'text-[var(--color-fg-dim)]'
            }`}
          >
            Alla
          </button>
          {WEEK_DAYS.map((d) => (
            <button
              key={d.date}
              type="button"
              onClick={() => setSelectedDay(d.date)}
              className={`rounded-full px-3 py-1 ${
                selectedDay === d.date
                  ? 'bg-[var(--color-accent)] text-black'
                  : 'text-[var(--color-fg-dim)]'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="pointer-events-auto flex gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-1 text-[11px] backdrop-blur">
          {FOOD_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFoodFilter(f.value)}
              className={`rounded-full px-2.5 py-0.5 ${
                foodFilter === f.value
                  ? 'bg-[var(--color-accent)] text-black'
                  : 'text-[var(--color-fg-dim)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {focusedEvents.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 z-10 max-h-[55svh] overflow-y-auto rounded-t-2xl border-t border-[var(--color-border)] bg-[var(--color-bg)]/97 p-4 backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {focusedEvents.length} event här
            </h2>
            <button
              type="button"
              onClick={() => setFocusedIds([])}
              className="text-xs text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"
            >
              Stäng
            </button>
          </div>
          <ul className="space-y-2 pb-4">
            {focusedEvents.map((e) => (
              <li key={e.id}>
                <EventCard event={e} now={now} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
