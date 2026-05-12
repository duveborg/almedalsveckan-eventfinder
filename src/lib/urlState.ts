import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

export function useUrlParam(
  key: string,
  defaultValue: string,
): [string, (v: string) => void] {
  const [params, setParams] = useSearchParams()
  const value = params.get(key) ?? defaultValue
  const setValue = useCallback(
    (v: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (v === defaultValue || v === '') next.delete(key)
          else next.set(key, v)
          return next
        },
        { replace: true },
      )
    },
    [key, defaultValue, setParams],
  )
  return [value, setValue]
}

export function useUrlSet(key: string): [Set<string>, (v: Set<string>) => void] {
  const [raw, setRaw] = useUrlParam(key, '')
  const set = useMemo(() => new Set(raw ? raw.split(',') : []), [raw])
  const setSet = useCallback(
    (next: Set<string>) => setRaw([...next].join(',')),
    [setRaw],
  )
  return [set, setSet]
}
