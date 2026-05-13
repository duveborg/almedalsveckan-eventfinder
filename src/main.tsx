import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import FindRoute from './routes/find.tsx'
import MapRoute from './routes/map.tsx'
import ScheduleRoute from './routes/schedule.tsx'
import SearchRoute from './routes/search.tsx'
import ForDigRoute from './routes/for-dig.tsx'
import AboutRoute from './routes/about.tsx'
import EventDetailRoute from './routes/event.tsx'

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
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
