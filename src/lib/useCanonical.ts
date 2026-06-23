import { useEffect } from 'react'

/**
 * Sets the document's <link rel="canonical"> href for the lifetime of the
 * mounting component, restoring the previous value on unmount. `href` may be a
 * path (e.g. "/") — it is resolved against the current origin so the emitted
 * canonical is always absolute.
 */
export function useCanonical(href: string) {
  useEffect(() => {
    let link = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    )
    const created = !link
    if (!link) {
      link = document.createElement('link')
      link.rel = 'canonical'
      document.head.appendChild(link)
    }
    const prev = link.getAttribute('href')
    link.setAttribute('href', new URL(href, window.location.origin).href)
    return () => {
      if (created) {
        link.remove()
      } else if (prev !== null) {
        link.setAttribute('href', prev)
      }
    }
  }, [href])
}
