# Almedalen 2026

A faster way to navigate the Almedalsveckan 2026 program. Browse the map, build a schedule, search, or see what's happening right now.

Built with React, TypeScript and Vite. The UI is in Swedish.

## App

- **Nu** — events happening right now, nearby first.
- **Karta** — MapLibre map of all events.
- **Ditt schema** — events you've saved.
- **För dig** — recommendations based on what you've saved, using OpenAI embeddings.
- **Sök** — full-text search via MiniSearch.
- **Om** — about + share.

Stack: React 19, React Router, Zustand, Tailwind v4, MapLibre GL, MiniSearch.

## Develop

```sh
npm install
npm run dev
```

Other scripts:

```sh
npm run build      # type-check + vite build
npm run lint
npm run preview
```

## Data pipeline

The app reads a single static `public/events.json` plus precomputed embeddings. Regenerate with:

```sh
npm run data           # scrape + enrich → public/events.json
npm run data:cache     # same, but reuse data/events-raw.json
npm run embed          # OpenAI embeddings → public/embeddings.{bin,meta.json}
```

`embed` requires `OPENAI_API_KEY` in the environment.

## Layout

```
scripts/   data pipeline (scrape, enrich, embed)
src/
  routes/  one file per tab
  data/    types, loading, search, embeddings, food
  store/   zustand stores (schedule, location)
  lib/     small utilities
public/    static data consumed by the app
```
