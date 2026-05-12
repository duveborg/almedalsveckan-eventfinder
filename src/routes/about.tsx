import { useState } from 'react'

export default function AboutRoute() {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const shareData = {
      title: 'Almedalen 2026 — ett bättre program',
      text: 'Hitta event i Almedalen 2026 — karta, schema, sök och vad som händer just nu.',
      url: window.location.origin,
    }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
        return
      } catch {
        // user cancelled — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(shareData.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <section className="mx-auto h-full max-w-md overflow-y-auto">
      <header className="border-b border-[var(--color-border)]">
        <div className="px-4 pb-3 pt-5">
          <h1 className="text-2xl font-semibold">Om</h1>
        </div>
      </header>

      <div className="space-y-6 p-4">
        <div className="space-y-3 text-sm leading-relaxed text-[var(--color-fg)]">
          <p>
            Ett snabbare sätt att navigera programmet under Almedalsveckan 2026.
            Bläddra i karta, schema och sök — eller se vad som händer just nu.
          </p>
          <p className="text-[var(--color-fg-dim)]">
            Data hämtas från det officiella Almedalsprogrammet. Varje event
            analyseras också utifrån sitt innehåll så att liknande event kan
            hittas och du kan få personliga förslag i För dig.
          </p>
        </div>

        <button
          type="button"
          onClick={handleShare}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          {copied ? 'Länk kopierad' : 'Dela sajten'}
        </button>

        <p className="text-sm text-[var(--color-fg-dim)]">
          Lämna gärna feedback{' '}
          <a
            href="https://github.com/duveborg/almedalsveckan-eventfinder/discussions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-accent)] underline underline-offset-2 hover:opacity-80"
          >
            här
          </a>
          .
        </p>
      </div>
    </section>
  )
}
