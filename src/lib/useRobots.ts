import { useEffect } from 'react'

export function useRobots(value: 'noindex' | 'noindex, follow' | 'index, follow') {
  useEffect(() => {
    const tag = document.createElement('meta')
    tag.name = 'robots'
    tag.content = value
    document.head.appendChild(tag)
    return () => {
      tag.remove()
    }
  }, [value])
}
