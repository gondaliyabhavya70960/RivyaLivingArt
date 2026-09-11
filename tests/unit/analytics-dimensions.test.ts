import { describe, expect, it } from 'vitest'

import { coverageAddsUp } from '@/lib/scraper/analytics/coverage'
import { computeDimensions, TABLE_SCALE_MM } from '@/lib/scraper/analytics/dimensions'

import { AS_OF, row } from './analytics-fixture'

/**
 * Dimension analysis measures PARSED rows and names every row it did not.
 *
 * The phase document's own regression: flip one row from PARSED to AMBIGUOUS and `n` falls by
 * exactly one, the denominator is unchanged, and `dimensions_unparsed` rises by exactly one.
 */

const widths = [600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800]

const measured = () =>
  widths.map((width) =>
    row({
      dimensionsMm: { width_mm: width, height_mm: 750 },
      longestAxisMm: width,
    }),
  )

describe('computeDimensions', () => {
  it('measures only PARSED rows and reports the others under two reasons', () => {
    const rows = [
      ...measured(),
      row({ dimensionParseState: 'AMBIGUOUS', dimensionsMm: null, longestAxisMm: null }),
      row({ dimensionParseState: 'UNPARSED', dimensionsMm: null, longestAxisMm: null }),
      row({ dimensionParseState: 'ABSENT', dimensionsMm: null, longestAxisMm: null }),
      row({ lastSeenAt: '2025-01-01T00:00:00.000Z' }),
    ]
    const result = computeDimensions(rows, { asOf: AS_OF })
    expect(result.n).toBe(12)
    expect(result.coverage.denominator).toBe(16)
    expect(result.coverage.excludedReasons).toEqual({
      dimensions_unparsed: 2,
      no_dimensions: 1,
      stale: 1,
    })
    expect(coverageAddsUp(result.coverage)).toBe(true)
  })

  it('drops exactly one from n when one row flips to AMBIGUOUS', () => {
    const before = computeDimensions(measured(), { asOf: AS_OF })
    const rows = measured()
    const flipped = [
      ...rows.slice(1),
      {
        ...rows[0]!,
        dimensionParseState: 'AMBIGUOUS' as const,
        dimensionsMm: null,
        longestAxisMm: null,
      },
    ]
    const after = computeDimensions(flipped, { asOf: AS_OF })
    expect(after.n).toBe(before.n - 1)
    expect(after.coverage.denominator).toBe(before.coverage.denominator)
    expect(after.coverage.excludedReasons.dimensions_unparsed ?? 0).toBe(
      (before.coverage.excludedReasons.dimensions_unparsed ?? 0) + 1,
    )
  })

  it('reports hand-computed per-axis percentiles at the floor', () => {
    const result = computeDimensions(measured(), { asOf: AS_OF })
    const width = result.axes.find((axis) => axis.axis === 'width_mm')
    // widths 600…2800 step 200: p50 = 1700, p10 = 820, p90 = 2580 (type 7).
    expect(width).toEqual({
      axis: 'width_mm',
      n: 12,
      insufficientSample: false,
      p10: 820,
      p50: 1700,
      p90: 2580,
    })
    const depth = result.axes.find((axis) => axis.axis === 'depth_mm')
    expect(depth?.n).toBe(0)
    expect(depth?.p50).toBeNull()
  })

  it('withholds axis percentiles below the sample floor', () => {
    const result = computeDimensions(measured().slice(0, 5), { asOf: AS_OF })
    const width = result.axes.find((axis) => axis.axis === 'width_mm')
    expect(width?.insufficientSample).toBe(true)
    expect(width?.p50).toBeNull()
  })

  it('buckets the longest axis with every bucket present at zero', () => {
    const result = computeDimensions(measured(), { asOf: AS_OF })
    expect(result.longestAxis.map((bucket) => bucket.count)).toEqual([0, 3, 3, 3, 3])
  })

  it('agrees with the Phase 30 table-scale cut at 1 800 mm', () => {
    const result = computeDimensions(measured(), { asOf: AS_OF })
    expect(TABLE_SCALE_MM).toBe(1800)
    expect(result.tableScale).toEqual({ thresholdMm: 1800, count: 6, share: 50 })
  })

  it('emits a scatter point only for rows carrying both width and height', () => {
    const result = computeDimensions(
      [
        row({ dimensionsMm: { width_mm: 1000 } }),
        row({ dimensionsMm: { width_mm: 1000, height_mm: 700 } }),
      ],
      { asOf: AS_OF },
    )
    expect(result.scatter).toHaveLength(1)
  })
})
