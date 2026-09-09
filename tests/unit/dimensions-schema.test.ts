import { describe, expect, it } from 'vitest'

import {
  DIMENSION_KEYS,
  DIMENSION_UNIT,
  dimensionEntries,
  dimensionsSchema,
} from '@/lib/catalog/dimensions'

/**
 * The dimensions contract, which the database mirrors in `products_dimensions_shape` (0130).
 *
 * The rule these assertions defend is the no-inference rule: the unit is part of the key, so there
 * is exactly one unit per measurement and nothing anywhere converts between them. A blob carrying
 * `length_inches` must be refused rather than accommodated, because a renderer that meets a unit it
 * cannot label has only bad options.
 */
describe('dimensionsSchema', () => {
  it('accepts a subset — a product that states only its height states only its height', () => {
    expect(dimensionsSchema.safeParse({ height_mm: 450 }).success).toBe(true)
  })

  it('accepts the empty object, which is a product that states nothing', () => {
    expect(dimensionsSchema.safeParse({}).success).toBe(true)
  })

  it('accepts every declared key at once', () => {
    const all = Object.fromEntries(DIMENSION_KEYS.map((key) => [key, 12]))
    expect(dimensionsSchema.safeParse(all).success).toBe(true)
  })

  it('rejects an undeclared key rather than ignoring it', () => {
    expect(dimensionsSchema.safeParse({ length_inches: 90 }).success).toBe(false)
    expect(dimensionsSchema.safeParse({ length_mm: 900, colour: 'blue' }).success).toBe(false)
  })

  it('rejects zero and negative values — a measurement of nothing is not a measurement', () => {
    expect(dimensionsSchema.safeParse({ length_mm: 0 }).success).toBe(false)
    expect(dimensionsSchema.safeParse({ length_mm: -5 }).success).toBe(false)
  })

  it('rejects a stringified number, which is how a form posts an unparsed field', () => {
    expect(dimensionsSchema.safeParse({ length_mm: '900' }).success).toBe(false)
  })

  it('rejects a fractional seat count', () => {
    expect(dimensionsSchema.safeParse({ seats: 6.5 }).success).toBe(false)
    expect(dimensionsSchema.safeParse({ seats: 6 }).success).toBe(true)
  })

  it('rejects an absurd value, which is a data-entry slip rather than a large table', () => {
    expect(dimensionsSchema.safeParse({ length_mm: 100_001 }).success).toBe(false)
  })
})

describe('dimensionEntries', () => {
  it('returns only the stated measurements, in the declared order', () => {
    const entries = dimensionEntries({ seats: 6, height_mm: 450, length_mm: 2400 })
    expect(entries.map((e) => e.key)).toEqual(['length_mm', 'height_mm', 'seats'])
    expect(entries.map((e) => e.value)).toEqual([2400, 450, 6])
  })

  it('carries the unit from the key, and none for a count', () => {
    const entries = dimensionEntries({ length_mm: 2400, weight_g: 18_000, seats: 6 })
    expect(entries.map((e) => e.unit)).toEqual(['mm', 'g', null])
    expect(DIMENSION_UNIT.seats).toBeNull()
  })

  it('is empty for null, for a malformed blob, and for a non-object', () => {
    // Empty is what makes the specification block absent rather than empty: the caller renders
    // nothing at all, with no heading and no placeholder row.
    expect(dimensionEntries(null)).toEqual([])
    expect(dimensionEntries({ length_inches: 90 })).toEqual([])
    expect(dimensionEntries('900mm')).toEqual([])
    expect(dimensionEntries([1, 2, 3])).toEqual([])
  })

  it('never invents an entry for a key the product did not state', () => {
    const entries = dimensionEntries({ length_mm: 2400 })
    expect(entries).toHaveLength(1)
    expect(entries.every((e) => e.value > 0)).toBe(true)
  })
})
