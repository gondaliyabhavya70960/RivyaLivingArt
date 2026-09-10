import { describe, expect, it } from 'vitest'

import {
  MAX_DIMENSION_MM,
  MIN_DIMENSION_MM,
  largestExtentMm,
  parseDimensions,
  type DimensionsMm,
  type ParseState,
} from '@/lib/scraper/normalization'

/**
 * Measurements, and the one rule the whole file is about: **nothing is inferred from magnitude**.
 *
 * THE FIRST TABLE IS THE PHASE DOCUMENT'S OWN, ROW FOR ROW. It is written as a table here because
 * it is a table there, and a reviewer should be able to read the two side by side and see that
 * nothing was quietly reinterpreted.
 *
 * THE SECOND TABLE IS TWELVE REAL MALFORMED STRINGS, which the phase document asks for by name.
 * They are the shapes a furniture site actually publishes: an inch mark that is a straight quote, a
 * `Ø` written as `dia.`, a seat height listed beside an overall height, prose with a number in it.
 * Every one of them has an answer that is either a measurement or an honest refusal, and none of
 * them has an answer that is a guess.
 *
 * `AMBIGUOUS` STORES NOTHING, and that invariant is asserted separately at the end because it is
 * the property every downstream chart depends on: a scale band, a comparison and an opportunity
 * score all read `dimensions_mm`, and none of them can tell a guessed millimetre from a read one.
 */

type Case = readonly [input: string, dimensions: DimensionsMm | null, state: ParseState]

/** The phase document's table, verbatim. */
const DOCUMENTED: readonly Case[] = [
  ['120 x 60 x 45 cm', { length_mm: 1200, width_mm: 600, height_mm: 450 }, 'PARSED'],
  ['W 120cm · D 60cm · H 45cm', { width_mm: 1200, depth_mm: 600, height_mm: 450 }, 'PARSED'],
  ['47" x 24" x 18"', { length_mm: 1194, width_mm: 610, height_mm: 457 }, 'PARSED'],
  ['4\' 6"', { length_mm: 1372 }, 'PARSED'],
  ['Ø 90 cm', { diameter_mm: 900 }, 'PARSED'],
  ['dia. 90cm', { diameter_mm: 900 }, 'PARSED'],
  ['120–140 cm', { length_mm: 1200, length_mm_max: 1400 }, 'PARSED'],
  ['120 x 60', null, 'AMBIGUOUS'],
  ['seats six comfortably', null, 'UNPARSED'],
  ['1 200 x 60 x 45 cm', null, 'UNPARSED'],
  ['4 x 3 mm', null, 'UNPARSED'],
]

describe('parseDimensions — the phase document’s table', () => {
  it.each(DOCUMENTED)('%s', (input, dimensions, state) => {
    const reading = parseDimensions([input])
    expect(reading.state, input).toBe(state)
    expect(reading.dimensions, input).toEqual(dimensions)
  })
})

/** Twelve real malformed strings, as the phase document asks for by name. */
const REAL_WORLD: readonly Case[] = [
  // A straight quote for inches, which is what a CMS produces after somebody types a curly one.
  ['L 47" W 24"', { length_mm: 1194, width_mm: 610 }, 'PARSED'],
  // Typographic marks, which is what the same CMS produces on a good day.
  ['Ø 90 cm', { diameter_mm: 900 }, 'PARSED'],
  // A units column that names the unit once, at the end, in words.
  ['180 x 90 x 75 centimetres', { length_mm: 1800, width_mm: 900, height_mm: 750 }, 'PARSED'],
  // A comma decimal in a measurement, which is not the price convention and needs no configuration.
  ['45,5 cm', { length_mm: 455 }, 'PARSED'],
  // Feet with no inches at all.
  ['6 ft', { length_mm: 1829 }, 'PARSED'],
  // A metric string in metres, where reading `m` as `mm` would be a thousand-fold error.
  ['1.8 m x 0.9 m', { length_mm: 1800, width_mm: 900 }, 'PARSED'],
  // Millimetres named directly, which some trade sites do.
  ['2000mm x 900mm x 750mm', { length_mm: 2000, width_mm: 900, height_mm: 750 }, 'PARSED'],
  // A label that is a whole word rather than an initial.
  ['Height 75 cm', { height_mm: 750 }, 'PARSED'],
  // Prose with a number in it, which is the case a naive scanner reads as a measurement.
  ['Comfortably seats 8 people', null, 'AMBIGUOUS'],
  // A weight, which is a measurement of something this column does not hold.
  ['Weighs 42 kg', null, 'AMBIGUOUS'],
  // Nothing at all.
  ['—', null, 'UNPARSED'],
  // A misread unit in the other direction: metres where centimetres were meant.
  ['120 x 60 x 45 m', null, 'UNPARSED'],
]

describe('parseDimensions — real malformed strings', () => {
  it.each(REAL_WORLD)('%s', (input, dimensions, state) => {
    const reading = parseDimensions([input])
    expect(reading.state, input).toBe(state)
    expect(reading.dimensions, input).toEqual(dimensions)
  })
})

describe('parseDimensions — what it refuses, and how loudly', () => {
  it('joins several strings into one object, because they describe one thing', () => {
    // A page that puts width, depth and height in three list items and the unit on the last one.
    const reading = parseDimensions(['W 120', 'D 60', 'H 45 cm'])
    expect(reading.state).toBe('PARSED')
    expect(reading.dimensions).toEqual({ width_mm: 1200, depth_mm: 600, height_mm: 450 })
  })

  it('reads nothing as ABSENT rather than as a failure', () => {
    expect(parseDimensions([]).state).toBe('ABSENT')
    expect(parseDimensions(['', '  ']).state).toBe('ABSENT')
  })

  it('RAISES impossible RATHER THAN STORING A TWELVE-METRE TABLE', () => {
    const reading = parseDimensions(['1 200 x 60 x 45 cm'])
    expect(reading.impossible).toBe(true)
    expect(reading.dimensions).toBeNull()
    expect(reading.state).toBe('UNPARSED')
  })

  it('discards the WHOLE reading when one axis is out of range', () => {
    // The other two were read in the same wrong unit. Keeping them would store two figures that are
    // wrong by the same factor and look entirely fine.
    const reading = parseDimensions(['120 x 60 x 45 m'])
    expect(reading.dimensions).toBeNull()
    expect(reading.impossible).toBe(true)
  })

  it('admits a measurement exactly at each bound', () => {
    expect(parseDimensions([`${String(MIN_DIMENSION_MM)} mm`]).state).toBe('PARSED')
    expect(parseDimensions([`${String(MAX_DIMENSION_MM)} mm`]).state).toBe('PARSED')
    expect(parseDimensions([`${String(MIN_DIMENSION_MM - 1)} mm`]).impossible).toBe(true)
    expect(parseDimensions([`${String(MAX_DIMENSION_MM + 1)} mm`]).impossible).toBe(true)
  })

  it('NEVER STORES A MILLIMETRE FIGURE FOR AN AMBIGUOUS READING', () => {
    /*
     * THE INVARIANT EVERY DOWNSTREAM CHART DEPENDS ON. A scale band, a price-per-metre and a
     * similarity comparison all read `dimensions_mm`, and none of them can tell a guessed figure
     * from a read one — so the guessed one never gets written. The source string survives in the
     * version's `raw` and in `sourceTexts.dimensions`, where a person can see it and correct it.
     */
    for (const input of ['120 x 60', '90', 'about 120 by 60', 'seats 8']) {
      const reading = parseDimensions([input])
      if (reading.state === 'AMBIGUOUS') expect(reading.dimensions, input).toBeNull()
    }
  })

  it('does not read a `<script>`-worth of digits as forty measurements', () => {
    const reading = parseDimensions(['1 2 3 4 5 6 7 8 9 10 11 12 cm'])
    // At most four axes are ever assigned; past the third there is no axis left to guess at.
    expect(Object.keys(reading.dimensions ?? {}).length).toBeLessThanOrEqual(4)
  })

  it('never throws, whatever it is given', () => {
    for (const input of ['', '<<<', '∅', '12"x', 'x x x', '- - -', '1e999 cm']) {
      expect(() => parseDimensions([input]), input).not.toThrow()
    }
  })
})

describe('largestExtentMm', () => {
  it('is null when nothing was measured', () => {
    expect(largestExtentMm(null)).toBeNull()
    expect(largestExtentMm({})).toBeNull()
  })

  it('counts a `_max` key, because an extending table occupies its extended length', () => {
    expect(largestExtentMm({ length_mm: 1800, length_mm_max: 2400, height_mm: 750 })).toBe(2400)
  })
})
