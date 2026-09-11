import { describe, expect, it } from 'vitest'

import {
  assignBands,
  bandIndex,
  fixedEdges,
  percentile,
  quantileEdges,
} from '@/lib/scraper/analytics/bands'
import { coverageAddsUp } from '@/lib/scraper/analytics/coverage'
import {
  computePriceArchitecture,
  histogram,
  MixedCurrencyError,
  splitByCurrency,
} from '@/lib/scraper/analytics/price-architecture'

import { AS_OF, row } from './analytics-fixture'

/**
 * Price architecture, against hand-computed expectations.
 *
 * THE PERCENTILE DEFINITION IS TYPE 7 (linear interpolation between closest ranks), and every
 * expected value below was worked by hand under that definition rather than snapshotted from the
 * implementation. Twelve values 10, 20, …, 120: p50 = 65 (between the 6th and 7th), p25 = 37.5,
 * p75 = 92.5, p10 = 21, p90 = 109.
 */

const TWELVE = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]

describe('percentile (type 7)', () => {
  it('interpolates between the closest ranks', () => {
    expect(percentile(TWELVE, 50)).toBe(65)
    expect(percentile(TWELVE, 25)).toBe(37.5)
    expect(percentile(TWELVE, 75)).toBe(92.5)
    expect(percentile(TWELVE, 10)).toBe(21)
    expect(percentile(TWELVE, 90)).toBe(109)
  })

  it('returns the single value for a list of one', () => {
    expect(percentile([42], 90)).toBe(42)
  })

  it('refuses an empty list rather than returning NaN', () => {
    expect(() => percentile([], 50)).toThrow(RangeError)
  })
})

describe('bands', () => {
  it('cuts four quantile bands from three interior edges', () => {
    const edges = quantileEdges(TWELVE)
    expect(edges).toEqual([38, 65, 93])
    const bands = assignBands(TWELVE, edges, 'QUANTILE')
    expect(bands.map((band) => band.count)).toEqual([3, 3, 3, 3])
    expect(bands[0]?.fromMinor).toBe(10)
    expect(bands[3]?.toMinor).toBeNull()
  })

  it('deduplicates repeated quantiles so no band is empty by construction', () => {
    expect(quantileEdges([5, 5, 5, 5, 5, 5, 5, 5])).toEqual([])
  })

  it('validates a FIXED ladder', () => {
    expect(fixedEdges([100, 200, 300])).toEqual([100, 200, 300])
    expect(() => fixedEdges([200, 100])).toThrow(RangeError)
    expect(() => fixedEdges([])).toThrow(RangeError)
    expect(() => fixedEdges([1.5])).toThrow(RangeError)
  })

  it('opens the first FIXED band downward', () => {
    const bands = assignBands([50, 150, 250], [100, 200], 'FIXED')
    expect(bands[0]).toEqual({ fromMinor: null, toMinor: 100, count: 1 })
    expect(bands[2]).toEqual({ fromMinor: 200, toMinor: null, count: 1 })
  })

  it('places a value in its band by index', () => {
    expect(bandIndex(50, [100, 200])).toBe(0)
    expect(bandIndex(100, [100, 200])).toBe(1)
    expect(bandIndex(999, [100, 200])).toBe(2)
  })
})

describe('computePriceArchitecture', () => {
  it('refuses mixed currencies instead of producing a meaningless band', () => {
    const rows = [row({ currency: 'INR' }), row({ currency: 'GBP' })]
    expect(() => computePriceArchitecture(rows, { asOf: AS_OF })).toThrow(MixedCurrencyError)
  })

  it('splits by currency for the caller, with the ambiguous rows under null', () => {
    const groups = splitByCurrency([
      row({ currency: 'INR' }),
      row({ currency: 'gbp' }),
      row({ currency: null }),
    ])
    expect([...groups.keys()]).toEqual(['INR', 'GBP', null])
  })

  it('counts every excluded row under a named reason so n + Σ excluded = denominator', () => {
    const rows = [
      ...TWELVE.map((amount) => row({ priceMinMinor: amount })),
      row({ priceState: 'REQUEST_QUOTE', priceMinMinor: null }),
      row({ priceState: 'PRICE_ON_REQUEST', priceMinMinor: null }),
      row({ priceState: 'UNKNOWN', priceMinMinor: null }),
      row({ priceState: 'FIXED', priceMinMinor: null }),
      row({ currency: null }),
      row({ lastSeenAt: '2026-01-01T00:00:00.000Z' }),
    ]
    const result = computePriceArchitecture(
      rows.filter((r) => r.currency !== 'GBP'),
      { asOf: AS_OF },
    )
    expect(result.n).toBe(12)
    expect(result.coverage.denominator).toBe(18)
    expect(result.coverage.excludedReasons).toEqual({
      quote_only_price: 2,
      no_price: 2,
      ambiguous_currency: 1,
      stale: 1,
    })
    expect(coverageAddsUp(result.coverage)).toBe(true)
  })

  it('reports the hand-computed percentiles at and above the sample floor', () => {
    const result = computePriceArchitecture(
      TWELVE.map((amount) => row({ priceMinMinor: amount })),
      { asOf: AS_OF },
    )
    expect(result.insufficientSample).toBe(false)
    expect(result.percentiles).toEqual({ p10: 21, p25: 37.5, median: 65, p75: 92.5, p90: 109 })
    expect(result.minMinor).toBe(10)
    expect(result.maxMinor).toBe(120)
  })

  it('withholds the percentiles below the floor and says INSUFFICIENT SAMPLE', () => {
    const result = computePriceArchitecture(
      [10, 20, 30, 40, 50, 60, 70, 80, 90].map((amount) => row({ priceMinMinor: amount })),
      { asOf: AS_OF },
    )
    expect(result.n).toBe(9)
    expect(result.insufficientSample).toBe(true)
    expect(result.percentiles).toBeNull()
    // The distribution still renders: bands and histogram are present.
    expect(result.bands.bands.length).toBeGreaterThan(0)
    expect(result.histogram.length).toBeGreaterThan(0)
  })

  it('uses the lower bound of a range as the comparable point and reports the widths', () => {
    const result = computePriceArchitecture(
      [
        row({ priceState: 'STARTING_FROM', priceMinMinor: 100, priceMaxMinor: 300 }),
        row({ priceState: 'STARTING_FROM', priceMinMinor: 200, priceMaxMinor: 250 }),
        row({ priceState: 'FIXED', priceMinMinor: 150 }),
      ],
      { asOf: AS_OF },
    )
    expect(result.minMinor).toBe(100)
    expect(result.ranges).toEqual({ count: 2, medianWidthMinor: 125 })
  })

  it('honours a FIXED band rule from the set', () => {
    const result = computePriceArchitecture(
      TWELVE.map((amount) => row({ priceMinMinor: amount })),
      { asOf: AS_OF, bandRule: 'FIXED', bandEdges: [50, 100] },
    )
    expect(result.bands.rule).toBe('FIXED')
    expect(result.bands.bands.map((band) => band.count)).toEqual([4, 5, 3])
  })

  it('produces an empty, honest result for no priced rows', () => {
    const result = computePriceArchitecture([row({ priceState: 'REQUEST_QUOTE' })], {
      asOf: AS_OF,
    })
    expect(result.n).toBe(0)
    expect(result.percentiles).toBeNull()
    expect(result.histogram).toEqual([])
    expect(result.coverage.coveragePct).toBe(0)
  })
})

describe('histogram', () => {
  it('bins equal widths and keeps the maximum in the last bin', () => {
    const bins = histogram([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 10)
    expect(bins).toHaveLength(10)
    expect(bins.reduce((total, bin) => total + bin.count, 0)).toBe(11)
    expect(bins[9]?.count).toBe(2)
  })

  it('collapses to one bin when every amount is the same', () => {
    expect(histogram([7, 7, 7], 10)).toEqual([{ fromMinor: 7, toMinor: 7, count: 3 }])
  })
})
