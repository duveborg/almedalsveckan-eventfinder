import { useEffect } from 'react'

const DEFAULT_TITLE = 'Almedalen 2026 — hitta dina evenemang'

export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    const next = title ? `${title} — Almedalen 2026` : DEFAULT_TITLE
    const prev = document.title
    document.title = next
    return () => {
      document.title = prev
    }
  }, [title])
}
