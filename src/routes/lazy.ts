import { lazy } from 'react'

export const MapRoute = lazy(() => import('./map.tsx'))
export const ScheduleRoute = lazy(() => import('./schedule.tsx'))
export const SearchRoute = lazy(() => import('./search.tsx'))
export const ForDigRoute = lazy(() => import('./for-dig.tsx'))
export const AboutRoute = lazy(() => import('./about.tsx'))
export const NotFoundRoute = lazy(() => import('./not-found.tsx'))
