import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export default function NotFoundRoute() {
  useDocumentTitle('Sidan hittades inte')
  return (
    <section className="mx-auto flex h-full max-w-md flex-col items-center justify-center px-4 text-center md:max-w-2xl">
      <p className="text-6xl font-semibold text-[var(--color-accent)]">404</p>
      <h1 className="mt-4 text-2xl font-semibold">Sidan hittades inte</h1>
      <p className="mt-2 text-sm text-[var(--color-fg-dim)]">
        Länken kanske är fel, eller så har eventet tagits bort.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link
          to="/"
          className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white"
        >
          Till start
        </Link>
        <Link
          to="/search"
          className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface)]"
        >
          Sök event
        </Link>
      </div>
    </section>
  )
}
