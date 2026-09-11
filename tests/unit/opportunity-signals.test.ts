import { describe, expect, it } from 'vitest'

import { SIGNAL_KEYS } from '@/lib/scraper/analytics/opportunity/model'
import { SIGNALS } from '@/lib/scraper/analytics/opportunity/signals'
import { LARGE_FORMAT_FIT_TABLE } from '@/lib/scraper/analytics/opportunity/signals/large-format-fit'

import { CAT_FURNITURE, fullContext, scoringRow, SOURCE_A } from './opportunity-fixture'

/**
 * Seven signals, each a fixture table — and `large_format_fit` enumerated across all 24 category ×
 * flag combinations with no fall-through and no default.
 */

describe('the signal register', () => {
  it('holds exactly the seven keys the model names', () => {
    expect(Object.keys(SIGNALS).sort()).toEqual([...SIGNAL_KEYS].sort())
    for (const key of SIGNAL_KEYS) expect(SIGNALS[key].key).toBe(key)
  })
})

describe('large_format_fit — all 24 combinations resolve', () => {
  const slugs = [
    'furniture',
    'collectible-design',
    '3d-resin',
    'wall-statement-art',
    'preservation',
    'decor',
    'gifts',
  ]
  const expectedFalse: Record<string, number> = {
    furniture: 50,
    'collectible-design': 75,
    '3d-resin': 70,
    'wall-statement-art': 60,
    preservation: 40,
    decor: 25,
    gifts: 10,
  }
  for (const slug of slugs) {
    for (const flag of [true, false, null]) {
      it(`${slug} × ${String(flag)}`, () => {
        const outcome = SIGNALS.large_format_fit.normalise(
          scoringRow({ matchedCategoryId: 'cat', categorySlug: slug, isLargeFormat: flag }),
          fullContext(),
        )
        if (flag === null) {
          expect(outcome).toMatchObject({ included: false, reason: 'large_format_unknown' })
        } else if (flag) {
          expect(outcome).toMatchObject({ included: true, normalised: 100 })
        } else {
          expect(outcome).toMatchObject({ included: true, normalised: expectedFalse[slug] })
        }
      })
    }
  }
  for (const flag of [true, false, null]) {
    it(`unmapped × ${String(flag)} is excluded as unmapped_category`, () => {
      const outcome = SIGNALS.large_format_fit.normalise(
        scoringRow({ matchedCategoryId: null, categorySlug: null, isLargeFormat: flag }),
        fullContext(),
      )
      expect(outcome).toMatchObject({ included: false, reason: 'unmapped_category' })
    })
  }
  it('has one table row per D3 category and no default', () => {
    expect(Object.keys(LARGE_FORMAT_FIT_TABLE).sort()).toEqual([...slugs].sort())
  })
})

describe('category_gap', () => {
  it('is 100 with nothing published, 0 at twelve, linear between', () => {
    const at = (count: number) =>
      SIGNALS.category_gap.normalise(
        scoringRow(),
        fullContext({ publishedCountByCategory: new Map([[CAT_FURNITURE, count]]) }),
      )
    expect(at(0)).toMatchObject({ included: true, normalised: 100 })
    expect(at(3)).toMatchObject({ included: true, normalised: 75 })
    expect(at(12)).toMatchObject({ included: true, normalised: 0 })
    expect(at(40)).toMatchObject({ included: true, normalised: 0 })
  })
  it('is excluded on an unmapped row', () => {
    expect(
      SIGNALS.category_gap.normalise(scoringRow({ matchedCategoryId: null }), fullContext()),
    ).toMatchObject({ included: false, reason: 'unmapped_category' })
  })
})

describe('price_band_gap', () => {
  it('scores unoccupied 100, adjacent 50, occupied 0', () => {
    // edges [50k, 100k, 200k]; occupied {0, 3}. 30k → band 0 occupied; 70k → band 1 adjacent to 0; 150k → band 2 adjacent to 3.
    expect(
      SIGNALS.price_band_gap.normalise(scoringRow({ priceMinMinor: 30_000 }), fullContext()),
    ).toMatchObject({ included: true, normalised: 0 })
    expect(
      SIGNALS.price_band_gap.normalise(scoringRow({ priceMinMinor: 70_000 }), fullContext()),
    ).toMatchObject({ included: true, normalised: 50 })
    const far = fullContext({
      occupiedBandsByCurrency: new Map([
        [
          'INR',
          {
            edges: [50_000, 100_000, 200_000, 400_000],
            occupied: new Set([0]),
            pricedProducts: 6,
            snapshotId: null,
          },
        ],
      ]),
    })
    expect(
      SIGNALS.price_band_gap.normalise(scoringRow({ priceMinMinor: 250_000 }), far),
    ).toMatchObject({ included: true, normalised: 100 })
  })
  it('is excluded below five Rivya prices, without a price, or with an ambiguous currency', () => {
    const thin = fullContext({
      occupiedBandsByCurrency: new Map([
        ['INR', { edges: [1], occupied: new Set(), pricedProducts: 4, snapshotId: null }],
      ]),
    })
    expect(SIGNALS.price_band_gap.normalise(scoringRow(), thin)).toMatchObject({
      included: false,
      reason: 'too_few_rivya_prices',
    })
    expect(
      SIGNALS.price_band_gap.normalise(scoringRow({ priceState: 'REQUEST_QUOTE' }), fullContext()),
    ).toMatchObject({ included: false, reason: 'no_price' })
    expect(
      SIGNALS.price_band_gap.normalise(scoringRow({ currency: null }), fullContext()),
    ).toMatchObject({ included: false, reason: 'ambiguous_currency' })
  })
})

describe('assortment_density', () => {
  it('maps 1 → 30, 2 → 60, ≥ 3 → 100 and needs three enabled sources', () => {
    const at = (sources: string[]) =>
      SIGNALS.assortment_density.normalise(
        scoringRow({ priceMinMinor: 150_000 }),
        fullContext({ sourcesByCategoryBand: new Map([[`${CAT_FURNITURE}:2`, new Set(sources)]]) }),
      )
    expect(at(['a'])).toMatchObject({ normalised: 30 })
    expect(at(['a', 'b'])).toMatchObject({ normalised: 60 })
    expect(at(['a', 'b', 'c', 'd'])).toMatchObject({ normalised: 100 })
    expect(
      SIGNALS.assortment_density.normalise(scoringRow(), fullContext({ enabledSourceCount: 2 })),
    ).toMatchObject({ included: false, reason: 'too_few_sources' })
  })
})

describe('change_velocity', () => {
  it('needs thirty days of history and saturates at ten changes', () => {
    expect(SIGNALS.change_velocity.normalise(scoringRow(), fullContext())).toMatchObject({
      included: true,
      normalised: 40,
    })
    expect(
      SIGNALS.change_velocity.normalise(
        scoringRow(),
        fullContext({ materialChanges90dByCategory: new Map([[CAT_FURNITURE, 25]]) }),
      ),
    ).toMatchObject({ normalised: 100 })
    expect(
      SIGNALS.change_velocity.normalise(
        scoringRow(),
        fullContext({ runHistoryDaysBySource: new Map([[SOURCE_A, 12]]) }),
      ),
    ).toMatchObject({ included: false, reason: 'insufficient_run_history' })
  })
})

describe('customisation_signal', () => {
  it('reads the declared, present key and is excluded otherwise', () => {
    expect(SIGNALS.customisation_signal.normalise(scoringRow(), fullContext())).toMatchObject({
      normalised: 100,
    })
    expect(
      SIGNALS.customisation_signal.normalise(
        scoringRow({ normalized: { customization: false } }),
        fullContext(),
      ),
    ).toMatchObject({ normalised: 0 })
    expect(
      SIGNALS.customisation_signal.normalise(scoringRow({ normalized: {} }), fullContext()),
    ).toMatchObject({ included: false, reason: 'version_lacks_customization' })
    expect(
      SIGNALS.customisation_signal.normalise(
        scoringRow(),
        fullContext({ attributeKeysBySource: new Map() }),
      ),
    ).toMatchObject({ included: false, reason: 'source_does_not_extract_customization' })
  })
})

describe('material_adjacency', () => {
  it('is the matched share of tokens, compared in application code', () => {
    expect(
      SIGNALS.material_adjacency.normalise(
        scoringRow({ materialTokens: ['oak', 'brass'] }),
        fullContext(),
      ),
    ).toMatchObject({ normalised: 50 })
    expect(
      SIGNALS.material_adjacency.normalise(scoringRow({ materialTokens: [] }), fullContext()),
    ).toMatchObject({ included: false, reason: 'no_material_tokens' })
  })
})
