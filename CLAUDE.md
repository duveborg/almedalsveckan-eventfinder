# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Almedalen 2026 — a React/TypeScript/Vite SPA for navigating the Almedalsveckan 2026 program. **UI strings are in Swedish.** Tabs: Hitta (now/nearby), Karta (map), Ditt schema (saved), För dig (recommendations), Sök (search), Om.

## Commands

```sh
npm run dev          # vite dev server
npm run build        # runs `prebuild` (sitemap) then `tsc -b && vite build`
npm run lint         # eslint .
npm run preview      # preview built site

npm run data         # scrape gotland.se → enrich → src/data/generated/events.json
npm run data:cache   # same, but reuse data/events-raw.json (skip scrape)
npm run embed        # OpenAI embeddings → src/data/generated/embeddings.{bin,-meta.json}
                     # requires OPENAI_API_KEY
npm run sitemap      # regenerate public/sitemap.xml (also runs as prebuild)
```

No test runner is configured.

The README claims the app reads `public/events.json` and writes embeddings to `public/embeddings.*` — this is stale. Generated data actually lives in `src/data/generated/` and is imported via Vite `?url` imports so it gets hashed/cached in the build.

## Architecture

**Data pipeline (offline, scripts/):** `scrape.ts` pages through the almedalsveckan.info API into `data/events-raw.json`, `enrich.ts` derives `startISO`/`endISO`, `durationMin`, `dayBucket`/`hourBucket`, unique `parties`, lowercased `topics`, and a `searchText` blob used by both keyword search and embeddings. Output is `src/data/generated/events.json` (an `EventsFile`). `embed.ts` then reads that file, calls `text-embedding-3-small`, **quantizes Float32 → Int8 with per-row max scaling** (preserves cosine similarity), and writes a packed `embeddings.bin` + `embeddings-meta.json` (ids + per-row scales).

**Runtime (src/):**
- `data/load.ts` — single fetch+cache of the generated events JSON; all views await `loadEvents()`.
- `data/search.ts` — MiniSearch index over `title`, `searchText`, `topic`, `topic2`; built lazily and memoized by events-array identity.
- `data/galaxy.ts` — loads the Int8 embeddings, then `rankByCentroid` builds a centroid from saved-event ids and ranks the rest by cosine. Used by the "För dig" tab. The file gracefully resolves `null` if embeddings aren't deployed, so the UI must handle the missing case.
- `store/schedule.ts` — Zustand with `persist` middleware under key `almedalen.schedule` (localStorage). This is the seed list for recommendations.
- `store/location.ts` — geolocation via the Web API; the "Nu" view sorts by distance.
- `routes/` — one file per tab. `main.tsx` wires them under a single `App` shell that renders the tab bar.

**Styling:** Tailwind v4 via `@tailwindcss/vite`. CSS variables (`--color-accent`, `--color-fg`, …) defined in `src/index.css` are the theme — prefer them over hard-coded colors.

### Tailwind v4 class-detection gotcha

Tailwind v4's source scanner reads `max-w-2xl${expr}` inside a template literal as a single token and silently drops the class — no CSS rule is emitted, no error. **Never place a Tailwind class immediately before `${...}` interpolation.** Pattern that works:

```ts
const BASE = "mx-auto w-full max-w-2xl"
className={className ? `${BASE} ${className}` : BASE}
```

If a class "isn't applying," first verify it exists in the generated CSS — Tailwind drops it rather than erroring.
