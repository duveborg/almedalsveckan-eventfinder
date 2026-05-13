import type { EnrichedEvent } from './types'

export function hasFood(event: EnrichedEvent): boolean {
  if (event.environmental?.food === 'true') return true
  return false
}
