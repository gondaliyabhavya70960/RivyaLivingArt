import type { Signal } from './types'

/**
 * Does it sit where SEED §56 says Rivya's priority sits?
 *
 * THE FULL TABLE, BECAUSE A PARTIAL TABLE IS A LICENCE TO GUESS. Seven D3 categories × three flag
 * states, plus the unmapped case: every combination resolves to a number or a named exclusion,
 * with no fall-through and no default. `tests/unit/opportunity-signals.test.ts` enumerates all 24.
 *
 * THE FALSE COLUMN IS SEED §56'S LADDER READ LITERALLY: collectible 75, 3D + resin 70, statement
 * art 60, preservation 40, décor 25, gifts 10. `furniture` that is NOT large-format is the one
 * cell §56 does not name — its tier 1 is "large-format furniture" and the scale is what puts it
 * there. It scores **50**: above statement art because it is still Rivya's core craft, below
 * collectible design because it is neither at the priority scale nor a collectible piece. That
 * number is a judgement, written here as one, and changing it means publishing a new model.
 */
export const LARGE_FORMAT_FIT_TABLE: Readonly<
  Record<string, { readonly large: number; readonly notLarge: number }>
> = {
  furniture: { large: 100, notLarge: 50 },
  'collectible-design': { large: 100, notLarge: 75 },
  '3d-resin': { large: 100, notLarge: 70 },
  'wall-statement-art': { large: 100, notLarge: 60 },
  preservation: { large: 100, notLarge: 40 },
  decor: { large: 100, notLarge: 25 },
  gifts: { large: 100, notLarge: 10 },
}

export const largeFormatFit: Signal = {
  key: 'large_format_fit',
  describe: () => "Does this row sit where SEED §56 says Rivya's priority sits?",
  inputs: () => [
    'research_products.is_large_format (three-valued)',
    'research_products.matched_category_id',
  ],
  normalise(row) {
    if (row.matchedCategoryId === null || row.categorySlug === null) {
      return { included: false, rawInput: null, reason: 'unmapped_category' }
    }
    if (row.isLargeFormat === null) {
      return {
        included: false,
        rawInput: `${row.categorySlug} / unknown`,
        reason: 'large_format_unknown',
      }
    }
    const cell = LARGE_FORMAT_FIT_TABLE[row.categorySlug]
    if (cell === undefined) {
      // A category slug outside the seven D3 slugs is not a judgement this table makes.
      return { included: false, rawInput: row.categorySlug, reason: 'category_not_in_ladder' }
    }
    return {
      included: true,
      rawInput: `${row.categorySlug} / ${row.isLargeFormat ? 'large' : 'not large'}`,
      normalised: row.isLargeFormat ? cell.large : cell.notLarge,
    }
  },
}
