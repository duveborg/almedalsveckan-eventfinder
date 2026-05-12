import type { EnrichedEvent } from './types'

const FOOD_RE =
  /\b(bjuder på|serveras|servering|tilltugg|förtäring|frukost|lunch|middag|fika|mingel|buffé|brunch|smörgås|macka|kaffe och|tapas)\b/i

export function hasFood(event: EnrichedEvent): boolean {
  if (event.environmental?.food === 'true') return true
  return FOOD_RE.test(event.searchText)
}
