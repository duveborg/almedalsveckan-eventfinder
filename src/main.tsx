import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

registerSW({ immediate: true })
import FindRoute from './routes/find.tsx'
import MapRoute from './routes/map.tsx'
import ScheduleRoute from './routes/schedule.tsx'
import SearchRoute from './routes/search.tsx'
import ForDigRoute from './routes/for-dig.tsx'
import AboutRoute from './routes/about.tsx'
import EventDetailRoute from './routes/event.tsx'
import NotFoundRoute from './routes/not-found.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<FindRoute />} />
          <Route path="map" element={<MapRoute />} />
          <Route path="schedule" element={<ScheduleRoute />} />
          <Route path="search" element={<SearchRoute />} />
          <Route path="for-dig" element={<ForDigRoute />} />
          <Route path="about" element={<AboutRoute />} />
          <Route path="event/:id" element={<EventDetailRoute />} />
          <Route path="*" element={<NotFoundRoute />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
