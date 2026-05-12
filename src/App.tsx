import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useLocation } from './store/location'

const tabs = [
  { to: '/now', label: 'Nu' },
  { to: '/map', label: 'Karta' },
  { to: '/schedule', label: 'Ditt schema' },
  { to: '/for-dig', label: 'För dig' },
  { to: '/search', label: 'Sök' },
  { to: '/about', label: 'Om' },
]

export default function App() {
  const requestLocation = useLocation((s) => s.request)
  useEffect(() => {
    requestLocation()
  }, [requestLocation])

  return (
    <div className="flex h-[100svh] flex-col">
      <header className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2">
        <img src="/favicon.svg" alt="" className="h-5 w-5" />
        <span className="text-sm font-semibold tracking-tight">Almedalen 2026</span>
      </header>
      <main className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>
      <nav className="border-t border-[var(--color-border)] bg-[var(--color-surface)] pt-2 pb-2">
        <ul className="mx-auto flex max-w-md justify-center gap-6">
          {tabs.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                className={({ isActive }) =>
                  `flex flex-col items-start gap-1 py-3 text-xs font-medium transition-colors ${
                    isActive
                      ? 'text-[var(--color-accent)]'
                      : 'text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
