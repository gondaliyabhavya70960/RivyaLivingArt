import { describe, expect, it } from 'vitest'

import {
  BAND_DEFINITIONS,
  FORM_SIMILAR_COSINE_MIN,
  MEASURED_PRECISION,
  NEAR_DUPLICATE_MAX,
  PRECISION_NOT_YET_MEASURED,
  PROBABLE_VARIANT_MAX,
  SIMILARITY_BANDS,
  WEAK_CEILING,
  bandForDistance,
  precisionFor,
} from '@/lib/scraper/analytics/similarity/bands'

/**
 * The band table is the single source of the thresholds and of the "does not mean" column; this
 * suite pins the ladder, the ceiling, the vocabulary, and the rule that no precision figure may
 * exist without its sample size and date.
 */

describe('the band ladder', () => {
  it('maps every distance to the band the document names, and discards beyond the ceiling', () => {
    for (let distance = 0; distance <= NEAR_DUPLICATE_MAX; distance += 1) {
      expect(bandForDistance(distance)).toBe('NEAR_DUPLICATE')
    }
    for (let distance = NEAR_DUPLICATE_MAX + 1; distance <= PROBABLE_VARIANT_MAX; distance += 1) {
      expect(bandForDistance(distance)).toBe('PROBABLE_VARIANT')
    }
    for (let distance = PROBABLE_VARIANT_MAX + 1; distance <= WEAK_CEILING; distance += 1) {
      expect(bandForDistance(distance)).toBe('WEAK')
    }
    expect(bandForDistance(WEAK_CEILING + 1)).toBeNull()
    expect(bandForDistance(64)).toBeNull()
  })

  it('has the literal thresholds of the phase document', () => {
    expect(NEAR_DUPLICATE_MAX).toBe(6)
    expect(PROBABLE_VARIANT_MAX).toBe(12)
    expect(WEAK_CEILING).toBe(18)
    expect(FORM_SIMILAR_COSINE_MIN).toBe(0.86)
  })

  it('refuses a negative or fractional distance', () => {
    expect(() => bandForDistance(-1)).toThrow(RangeError)
    expect(() => bandForDistance(2.5)).toThrow(RangeError)
  })
})

describe('the vocabulary', () => {
  it('names four bands, none containing the word "same"', () => {
    expect([...SIMILARITY_BANDS]).toEqual([
      'NEAR_DUPLICATE',
      'PROBABLE_VARIANT',
      'WEAK',
      'FORM_SIMILAR',
    ])
    for (const band of SIMILARITY_BANDS) expect(band.toLowerCase()).not.toContain('same')
  })

  it('defines every band exactly once, each with a non-empty "does not mean"', () => {
    expect(BAND_DEFINITIONS.map((definition) => definition.band)).toEqual([...SIMILARITY_BANDS])
    for (const definition of BAND_DEFINITIONS) {
      expect(definition.doesNotMean.trim().length).toBeGreaterThan(20)
      expect(definition.means.trim().length).toBeGreaterThan(10)
    }
  })

  it('never claims a shared object in the "means" column', () => {
    for (const definition of BAND_DEFINITIONS) {
      expect(definition.means.toLowerCase()).not.toMatch(/same (product|object)/u)
    }
    expect(BAND_DEFINITIONS[0]?.doesNotMean).toContain('same physical object')
  })
})

describe('measured precision', () => {
  it('is empty until a labelled sample exists, and the Studio wording is fixed', () => {
    expect(PRECISION_NOT_YET_MEASURED).toBe('PRECISION NOT YET MEASURED')
    for (const band of SIMILARITY_BANDS) {
      const measured = precisionFor(band)
      if (measured === null) continue
      // A populated row must carry its evidence: size, date, person. No figure without them.
      expect(measured.sampleSize).toBeGreaterThan(0)
      expect(measured.sampledOn).toMatch(/^\d{4}-\d{2}-\d{2}$/u)
      expect(measured.labelledBy.trim()).not.toBe('')
      expect(measured.precision).toBeGreaterThanOrEqual(0)
      expect(measured.precision).toBeLessThanOrEqual(1)
    }
  })

  it('has no figure at all today — the corpus has not been sampled', () => {
    expect(MEASURED_PRECISION).toHaveLength(0)
  })
})
