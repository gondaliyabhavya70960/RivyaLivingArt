import { describe, expect, it } from 'vitest'

import {
  coverageAddsUp,
  coverageRecord,
  coverageRecordSchema,
  EXCLUSION_REASONS,
  ExclusionTally,
  SAMPLE_FLOOR,
  sumExclusions,
} from '@/lib/scraper/analytics/coverage'

/**
 * The coverage record — Phase 31's honesty contract.
 *
 * `n + Σ excluded = denominator`, always. A module that dropped a row without naming a reason
 * would make a thin result look like a small market, which is the failure FEAT §28 names. These
 * tests hold the record to that identity and to the closed reason vocabulary.
 */

const AS_OF = '2026-09-11T12:00:00.000Z'

describe('coverageRecord', () => {
  it('derives n from the denominator and the exclusions so the identity cannot be broken', () => {
    const record = coverageRecord('price_architecture', 140, { quote_only_price: 38 }, AS_OF)
    expect(record.n).toBe(102)
    expect(record.denominator).toBe(140)
    expect(record.coveragePct).toBe(73)
    expect(coverageAddsUp(record)).toBe(true)
  })

  it('reports zero over zero as 0 %, never 100 %', () => {
    const record = coverageRecord('assortment', 0, {}, AS_OF)
    expect(record.coveragePct).toBe(0)
    expect(record.n).toBe(0)
  })

  it('drops zero-count reasons and keeps the rest', () => {
    const record = coverageRecord('dimensions', 10, { stale: 0, dimensions_unparsed: 3 }, AS_OF)
    expect(record.excludedReasons).toEqual({ dimensions_unparsed: 3 })
    expect(sumExclusions(record.excludedReasons)).toBe(3)
  })

  it('never lets n go negative when exclusions exceed the denominator', () => {
    const record = coverageRecord('assortment', 2, { stale: 5 }, AS_OF)
    expect(record.n).toBe(0)
    // And the identity test then FAILS, which is the point: a caller that over-counts is caught.
    expect(coverageAddsUp(record)).toBe(false)
  })

  it('validates against its own Zod schema, reasons included', () => {
    const record = coverageRecord('assortment', 3, { unmapped_category: 1 }, AS_OF)
    expect(coverageRecordSchema.safeParse(record).success).toBe(true)
    expect(
      coverageRecordSchema.safeParse({ ...record, excludedReasons: { invented: 1 } }).success,
    ).toBe(false)
  })

  it('has exactly the seven reasons the phase document names', () => {
    expect([...EXCLUSION_REASONS]).toEqual([
      'no_price',
      'quote_only_price',
      'ambiguous_currency',
      'no_dimensions',
      'dimensions_unparsed',
      'unmapped_category',
      'stale',
    ])
  })

  it('tallies one row at a time', () => {
    const tally = new ExclusionTally()
    tally.add('stale')
    tally.add('stale')
    tally.add('no_price')
    expect(tally.counts).toEqual({ stale: 2, no_price: 1 })
  })

  it('sets the sample floor at twelve', () => {
    expect(SAMPLE_FLOOR).toBe(12)
  })
})
