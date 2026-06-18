import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

/** Sends a custom GA4 event. No-op if analytics hasn't loaded. */
export function trackEvent(name: string, params?: Record<string, unknown>) {
  window.gtag?.('event', name, params)
}

/** Sends a GA4 page_view on every route change (SPA navigation). */
export function usePageTracking() {
  const location = useLocation()
  useEffect(() => {
    window.gtag?.('event', 'page_view', {
      page_path: location.pathname + location.search,
      page_location: window.location.href,
      page_title: document.title,
    })
  }, [location.pathname, location.search])
}
