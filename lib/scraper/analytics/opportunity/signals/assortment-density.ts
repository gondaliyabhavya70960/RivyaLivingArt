import { bandIndex } from '../../bands'
import { PRICED_STATES } from '../../price-architecture'
import { densityKey } from '../context'
import type { Signal } from './types'

/**
 * How many independent sources list something comparable?
 * Distinct source ids in the same mapped category and band: 1 → 30, 2 → 60, ≥ 3 → 100.
 * Coverage: ≥ 3 enabled sources — with fewer, "independent" cannot reach 100 and the scale is
 * meaningless.
 */
export const ASSORTMENT_DENSITY_MIN_SOURCES = 3

export const assortmentDensity: Signal = {
  key: 'assortment_density',
  describe: () => 'How many independent sources list something comparable?',
  inputs: () => ['research_sources (enabled)', 'research_products per (category, band)'],
  normalise(row, context) {
    if (context.enabledSourceCount < ASSORTMENT_DENSITY_MIN_SOURCES) {
      return {
        included: false,
        rawInput: `${String(context.enabledSourceCount)} enabled sources`,
        reason: 'too_few_sources',
      }
    }
    if (row.matchedCategoryId === null) {
      return { included: false, rawInput: null, reason: 'unmapped_category' }
    }
    const priced =
      row.priceState !== null &&
      PRICED_STATES.has(row.priceState) &&
      row.priceMinMinor !== null &&
      row.currency !== null
    const edges = priced
      ? (context.occupiedBandsByCurrency.get(row.currency ?? '')?.edges ?? [])
      : []
    const band = priced && edges.length > 0 ? bandIndex(row.priceMinMinor ?? 0, edges) : null
    const sources =
      context.sourcesByCategoryBand.get(densityKey(row.matchedCategoryId, band)) ??
      new Set<string>()
    const count = sources.size
    const value = count >= 3 ? 100 : count === 2 ? 60 : count === 1 ? 30 : 0
    return { included: true, rawInput: `${String(count)} sources`, normalised: value }
  },
}
