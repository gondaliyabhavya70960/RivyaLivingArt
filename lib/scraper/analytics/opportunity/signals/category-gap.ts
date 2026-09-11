import type { Signal } from './types'
import { clamp } from './types'

/**
 * How thinly does Rivya's published catalogue cover this mapped category?
 * 0 published → 100; ≥ 12 → 0; linear between. A first-party count is always knowable, including
 * zero, so this signal has no coverage requirement of its own — except that the row must be
 * mapped, because "the category" has to name one.
 */
export const CATEGORY_GAP_SATURATION = 12

export const categoryGap: Signal = {
  key: 'category_gap',
  describe: () => "How thinly does Rivya's published catalogue cover this row's mapped category?",
  inputs: () => ['research_products.matched_category_id', 'products (PUBLISHED) per category'],
  normalise(row, context) {
    if (row.matchedCategoryId === null) {
      return { included: false, rawInput: null, reason: 'unmapped_category' }
    }
    const count = context.publishedCountByCategory.get(row.matchedCategoryId) ?? 0
    const value =
      count >= CATEGORY_GAP_SATURATION ? 0 : 100 - (100 * count) / CATEGORY_GAP_SATURATION
    return { included: true, rawInput: `${String(count)} published`, normalised: clamp(value) }
  },
}
