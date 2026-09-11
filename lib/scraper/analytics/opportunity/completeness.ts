import { PRICED_STATES } from '../price-architecture'
import type { ScoringRow } from './context'

/**
 * Completeness: the share of Phase 28's required fields present on the row.
 *
 * SIX FIELDS, NAMED HERE AND NOWHERE ELSE, so the multiplier means one thing across the CLI, the
 * cron and the drawer. A sparse row is capped at 60 % of its raw score (`0.6 + 0.4 × completeness`
 * in `score.ts`), because a row Rivya read badly should never out-rank a row it read well on the
 * strength of the few signals it happened to satisfy.
 */
export const REQUIRED_FIELDS = [
  'title',
  'currency',
  'price',
  'dimensions',
  'materials',
  'category',
] as const
export type RequiredField = (typeof REQUIRED_FIELDS)[number]

export function presentFields(row: ScoringRow): readonly RequiredField[] {
  const present: RequiredField[] = []
  if (row.titleNormalized !== null && row.titleNormalized.trim() !== '') present.push('title')
  if (row.currency !== null) present.push('currency')
  if (row.priceState !== null && PRICED_STATES.has(row.priceState) && row.priceMinMinor !== null) {
    present.push('price')
  }
  if (row.dimensionParseState === 'PARSED' && row.dimensionsMm !== null) present.push('dimensions')
  if (row.materialTokens.length > 0) present.push('materials')
  if (row.matchedCategoryId !== null) present.push('category')
  return present
}

/** 0–1, three decimals. */
export function completeness(row: ScoringRow): number {
  return Math.round((presentFields(row).length / REQUIRED_FIELDS.length) * 1000) / 1000
}
