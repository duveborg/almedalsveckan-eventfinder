import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import NowRoute from './routes/now.tsx'
import MapRoute from './routes/map.tsx'
import ScheduleRoute from './routes/schedule.tsx'
import SearchRoute from './routes/search.tsx'
import AboutRoute from './routes/about.tsx'
import EventDetailRoute from './routes/event.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Navigate to="/now" replace />} />
          <Route path="now" element={<NowRoute />} />
          <Route path="map" element={<MapRoute />} />
          <Route path="schedule" element={<ScheduleRoute />} />
          <Route path="search" element={<SearchRoute />} />
          <Route path="about" element={<AboutRoute />} />
          <Route path="event/:id" element={<EventDetailRoute />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
