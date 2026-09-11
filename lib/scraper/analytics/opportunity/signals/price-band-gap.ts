import { bandIndex } from '../../bands'
import { PRICED_STATES } from '../../price-architecture'
import type { Signal } from './types'

/**
 * Is this price band unoccupied by Rivya's published range?
 * The row's Phase 31 band (from `price_min_minor` against the currency's quantile edges) against
 * the bands occupied by published Rivya products in the same currency: unoccupied → 100, adjacent
 * → 50, occupied → 0. Coverage: the row is priced AND ≥ 5 published Rivya products carry a price
 * in that currency — below that the "occupied" set is too thin to mean anything.
 */
export const PRICE_BAND_GAP_MIN_PRODUCTS = 5

export const priceBandGap: Signal = {
  key: 'price_band_gap',
  describe: () => "Is this row's price band unoccupied by Rivya's published range?",
  inputs: () => [
    'research_products.price_state / price_min_minor / currency',
    'Phase 31 band edges per currency',
    'products (PUBLISHED, priced) per band',
  ],
  normalise(row, context) {
    if (
      row.priceState === null ||
      !PRICED_STATES.has(row.priceState) ||
      row.priceMinMinor === null
    ) {
      return { included: false, rawInput: null, reason: 'no_price' }
    }
    if (row.currency === null)
      return { included: false, rawInput: null, reason: 'ambiguous_currency' }
    const bands = context.occupiedBandsByCurrency.get(row.currency)
    if (bands === undefined || bands.pricedProducts < PRICE_BAND_GAP_MIN_PRODUCTS) {
      return {
        included: false,
        rawInput: `${row.currency}: ${String(bands?.pricedProducts ?? 0)} priced Rivya products`,
        reason: 'too_few_rivya_prices',
      }
    }
    if (bands.edges.length === 0) {
      return { included: false, rawInput: row.currency, reason: 'no_band_edges' }
    }
    const index = bandIndex(row.priceMinMinor, bands.edges)
    const occupied = bands.occupied.has(index)
    const adjacent = bands.occupied.has(index - 1) || bands.occupied.has(index + 1)
    const value = occupied ? 0 : adjacent ? 50 : 100
    return {
      included: true,
      rawInput: `band ${String(index)} of ${String(bands.edges.length + 1)} (${row.currency}) — ${occupied ? 'occupied' : adjacent ? 'adjacent' : 'unoccupied'}`,
      normalised: value,
    }
  },
}
