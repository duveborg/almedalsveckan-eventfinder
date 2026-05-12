import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useLocation } from './store/location'

const tabs = [
  { to: '/now', label: 'Nu' },
  { to: '/map', label: 'Karta' },
  { to: '/schedule', label: 'Schema' },
  { to: '/galaxy', label: 'Galax' },
]

export default function App() {
  const requestLocation = useLocation((s) => s.request)
  useEffect(() => {
    requestLocation()
  }, [requestLocation])

  return (
    <div className="flex h-[100svh] flex-col">
      <main className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>
      <nav className="border-t border-[var(--color-border)] bg-[var(--color-surface)] pt-2">
        <ul className="mx-auto flex max-w-md">
          {tabs.map((tab) => (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
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
