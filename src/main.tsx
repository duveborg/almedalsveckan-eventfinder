import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import FindRoute from './routes/find.tsx'
import EventDetailRoute from './routes/event.tsx'
import {
  AboutRoute,
  ForDigRoute,
  MapRoute,
  NotFoundRoute,
  ScheduleRoute,
  SearchRoute,
} from './routes/lazy.ts'
import { LoadingSpinner } from './components/LoadingSpinner.tsx'

registerSW({ immediate: true })

const fallback = <LoadingSpinner message="Laddar…" />

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<FindRoute />} />
          <Route path="event/:id" element={<EventDetailRoute />} />
          <Route
            path="map"
            element={<Suspense fallback={fallback}><MapRoute /></Suspense>}
          />
          <Route
            path="schedule"
            element={<Suspense fallback={fallback}><ScheduleRoute /></Suspense>}
          />
          <Route
            path="search"
            element={<Suspense fallback={fallback}><SearchRoute /></Suspense>}
          />
          <Route
            path="for-dig"
            element={<Suspense fallback={fallback}><ForDigRoute /></Suspense>}
          />
          <Route
            path="about"
            element={<Suspense fallback={fallback}><AboutRoute /></Suspense>}
          />
          <Route
            path="*"
            element={<Suspense fallback={fallback}><NotFoundRoute /></Suspense>}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
