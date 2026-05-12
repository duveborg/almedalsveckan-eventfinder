import type { EnrichedEvent } from './types'

export type FoodFilter = 'all' | 'with' | 'without'

export const FOOD_FILTERS: { label: string; value: FoodFilter }[] = [
  { label: 'Allt', value: 'all' },
  { label: 'Med mat', value: 'with' },
  { label: 'Utan mat', value: 'without' },
]

const FOOD_RE =
  /\b(bjuder på|serveras|servering|tilltugg|förtäring|frukost|lunch|middag|fika|mingel|buffé|brunch|smörgås|macka|kaffe och|tapas)\b/i

export function hasFood(event: EnrichedEvent): boolean {
  return FOOD_RE.test(event.searchText)
}

export function matchesFoodFilter(
  event: EnrichedEvent,
  filter: FoodFilter,
): boolean {
  if (filter === 'with') return hasFood(event)
  if (filter === 'without') return !hasFood(event)
  return true
}
