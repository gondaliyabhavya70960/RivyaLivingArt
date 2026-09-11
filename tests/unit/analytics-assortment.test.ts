import { describe, expect, it } from 'vitest'

import { computeAssortment, UNMAPPED } from '@/lib/scraper/analytics/assortment'
import { coverageAddsUp } from '@/lib/scraper/analytics/coverage'

import {
  AS_OF,
  CAT_DECOR,
  CAT_FURNITURE,
  CATEGORIES,
  row,
  SOURCE_A,
  SOURCE_B,
} from './analytics-fixture'

/**
 * Assortment: shares add to 100 % INCLUDING the unmapped bucket, and large-format is three-valued.
 */

describe('computeAssortment', () => {
  it('reports unmapped as a first-class bucket and shares that sum to 100', () => {
    const rows = [
      row({ matchedCategoryId: CAT_FURNITURE }),
      row({ matchedCategoryId: CAT_FURNITURE }),
      row({ matchedCategoryId: CAT_DECOR }),
      row({ matchedCategoryId: null, categorySlug: null }),
    ]
    const result = computeAssortment(rows, { asOf: AS_OF, categories: CATEGORIES })
    const unmapped = result.byCategory.find((entry) => entry.key === UNMAPPED)
    expect(unmapped?.count).toBe(1)
    expect(unmapped?.share).toBe(25)
    const total = result.byCategory.reduce((sum, entry) => sum + entry.share, 0)
    expect(Math.abs(total - 100)).toBeLessThan(0.01)
  })

  it('renders every category at zero rather than dropping it', () => {
    const result = computeAssortment([row({ matchedCategoryId: CAT_FURNITURE })], {
      asOf: AS_OF,
      categories: CATEGORIES,
    })
    expect(result.byCategory.map((entry) => entry.slug).sort()).toEqual([
      'decor',
      'furniture',
      'unmapped',
    ])
    expect(result.byCategory.find((entry) => entry.slug === 'decor')?.count).toBe(0)
  })

  it('reports large-format three-valued, per source and overall', () => {
    const rows = [
      row({ isLargeFormat: true }),
      row({ isLargeFormat: false }),
      row({ isLargeFormat: null }),
      row({ sourceId: SOURCE_B, isLargeFormat: null }),
    ]
    const result = computeAssortment(rows, { asOf: AS_OF, categories: CATEGORIES })
    expect(result.largeFormat).toEqual({ yes: 1, no: 1, unknown: 2 })
    const a = result.sources.find((source) => source.sourceId === SOURCE_A)
    expect(a?.largeFormat).toEqual({ yes: 1, no: 1, unknown: 1 })
    expect(a?.share).toBe(75)
  })

  it('counts stale rows out and the identity holds', () => {
    const rows = [row(), row({ lastSeenAt: '2025-01-01T00:00:00.000Z' })]
    const result = computeAssortment(rows, { asOf: AS_OF, categories: CATEGORIES })
    expect(result.n).toBe(1)
    expect(result.coverage.excludedReasons).toEqual({ stale: 1 })
    expect(coverageAddsUp(result.coverage)).toBe(true)
  })

  it('reports the priced share and the first/last seen spread per source', () => {
    const rows = [
      row({ firstSeenAt: '2026-06-01T00:00:00.000Z', lastSeenAt: '2026-09-01T00:00:00.000Z' }),
      row({
        priceState: 'REQUEST_QUOTE',
        priceMinMinor: null,
        firstSeenAt: '2026-05-01T00:00:00.000Z',
        lastSeenAt: '2026-09-09T00:00:00.000Z',
      }),
    ]
    const [a] = computeAssortment(rows, { asOf: AS_OF, categories: CATEGORIES }).sources
    expect(a?.pricedCount).toBe(1)
    expect(a?.pricedShare).toBe(50)
    expect(a?.firstSeenAt).toBe('2026-05-01T00:00:00.000Z')
    expect(a?.lastSeenAt).toBe('2026-09-09T00:00:00.000Z')
  })

  it('is empty and honest with no rows', () => {
    const result = computeAssortment([], { asOf: AS_OF, categories: CATEGORIES })
    expect(result.n).toBe(0)
    expect(result.sources).toEqual([])
    expect(result.coverage.coveragePct).toBe(0)
  })
})
