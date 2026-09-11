import { describe, expect, it } from 'vitest'

import {
  SCALE_BANDS,
  bandFor,
  classifyScale,
  longestAxis,
  matches,
  type ScaleInput,
  type ScaleRule,
} from '@/lib/scraper/analytics/scale'

/**
 * The five rules, asked their own questions, including at every boundary.
 *
 * BOUNDARIES ARE TESTED AT 1199, 1200, 1799 AND 1800 because an off-by-one in a threshold is the
 * defect that never announces itself: the classification is plausible either way, the counts move
 * by a percent or two, and nobody notices until somebody re-derives a figure by hand a year later.
 *
 * THE FIRST ASSERTION IN THIS FILE IS THE MOST IMPORTANT ONE. A row whose dimensions could not be
 * parsed must be `UNKNOWN` with a null verdict, never `SMALL` and never false — because a boolean
 * would force every badly-written page into the small bucket and make this whole workspace
 * under-report large work in proportion to how poorly its sources write. That failure looks exactly
 * like a finding.
 */

/** `0280`'s five seeded rules, as the classifier receives them. */
const RULES: readonly ScaleRule[] = [
  {
    id: 'rule-10',
    priority: 10,
    predicate: { parseState: 'NOT_PARSED' },
    resultBand: 'UNKNOWN',
    resultIsLarge: null,
    isEnabled: true,
  },
  {
    id: 'rule-20',
    priority: 20,
    predicate: { minLongestAxisMm: 1_800 },
    resultBand: null,
    resultIsLarge: true,
    isEnabled: true,
  },
  {
    id: 'rule-30',
    priority: 30,
    predicate: { minLongestAxisMm: 1_200, categoryInLargeFormatSet: true },
    resultBand: null,
    resultIsLarge: true,
    isEnabled: true,
  },
  {
    id: 'rule-40',
    priority: 40,
    predicate: { minLongestAxisMm: 1_200 },
    resultBand: null,
    resultIsLarge: false,
    isEnabled: true,
  },
  {
    id: 'rule-50',
    priority: 50,
    predicate: {},
    resultBand: null,
    resultIsLarge: false,
    isEnabled: true,
  },
]

function row(overrides: Partial<ScaleInput> = {}): ScaleInput {
  return {
    dimensionsMm: { length_mm: 1_000, width_mm: 500, height_mm: 750 },
    dimensionParseState: 'PARSED',
    categoryIsLargeFormat: false,
    ...overrides,
  }
}

describe('longestAxis', () => {
  it('takes the largest of every axis, diameter included', () => {
    // A round table two metres across is large-format by any reading, and a rule looking only at
    // `length_mm` would miss every circular piece — a systematic blind spot, not a rounding error.
    expect(longestAxis({ diameter_mm: 2_000, height_mm: 740 }, 'PARSED')).toBe(2_000)
  })

  it('is null whenever the dimensions are not PARSED', () => {
    expect(longestAxis({ length_mm: 2_000 }, 'AMBIGUOUS')).toBeNull()
    expect(longestAxis({ length_mm: 2_000 }, 'UNPARSED')).toBeNull()
    expect(longestAxis(null, 'PARSED')).toBeNull()
  })
})

describe('the unparsed row', () => {
  it('is UNKNOWN with a null verdict, never small and never false', () => {
    for (const state of ['AMBIGUOUS', 'UNPARSED', 'ABSENT'] as const) {
      const result = classifyScale(row({ dimensionParseState: state, dimensionsMm: null }), RULES)
      expect(result.band, state).toBe('UNKNOWN')
      expect(result.isLargeFormat, state).toBeNull()
      expect(result.ruleId, state).toBe('rule-10')
    }
  })

  it('reaches UNKNOWN even when its stored dimensions would otherwise be long', () => {
    // A row with an AMBIGUOUS parse state and a stored length is a contradiction Phase 28 forbids,
    // but a hand-written UPDATE could produce one. Rule 10 is first precisely so no threshold rule
    // ever sees a row whose measurements it has been told not to trust.
    const result = classifyScale(
      row({ dimensionParseState: 'AMBIGUOUS', dimensionsMm: { length_mm: 2_400 } }),
      RULES,
    )
    expect(result.band).toBe('UNKNOWN')
    expect(result.isLargeFormat).toBeNull()
  })
})

describe('the thresholds, at their boundaries', () => {
  const at = (mm: number, categoryIsLargeFormat = false) =>
    classifyScale(
      row({
        dimensionsMm: { length_mm: mm, width_mm: 500, height_mm: 750 },
        categoryIsLargeFormat,
      }),
      RULES,
    )

  it('1199 mm is not large and is caught by the fallthrough', () => {
    const result = at(1_199)
    expect(result.isLargeFormat).toBe(false)
    expect(result.ruleId).toBe('rule-50')
  })

  it('1200 mm in no mapped category is MID — not large, but caught by rule 40', () => {
    const result = at(1_200)
    expect(result.isLargeFormat).toBe(false)
    expect(result.ruleId).toBe('rule-40')
  })

  it('1200 mm in a mapped category is large, by rule 30', () => {
    const result = at(1_200, true)
    expect(result.isLargeFormat).toBe(true)
    expect(result.ruleId).toBe('rule-30')
  })

  it('1799 mm in no mapped category is still not large', () => {
    expect(at(1_799).isLargeFormat).toBe(false)
    expect(at(1_799).ruleId).toBe('rule-40')
  })

  it('1800 mm is large whatever its category, by rule 20', () => {
    expect(at(1_800).isLargeFormat).toBe(true)
    expect(at(1_800).ruleId).toBe('rule-20')
    expect(at(1_800, true).ruleId).toBe('rule-20')
  })

  it('2100 mm is large', () => {
    expect(at(2_100).isLargeFormat).toBe(true)
  })
})

describe('the four rows the phase document names', () => {
  it('bands 1150, 1250 mapped, 1250 unmapped and 2100 as SMALL, LARGE, MID and LARGE', () => {
    const results = [
      classifyScale(row({ dimensionsMm: { length_mm: 1_150, height_mm: 750 } }), RULES),
      classifyScale(
        row({ dimensionsMm: { length_mm: 1_250, height_mm: 750 }, categoryIsLargeFormat: true }),
        RULES,
      ),
      classifyScale(row({ dimensionsMm: { length_mm: 1_250, height_mm: 750 } }), RULES),
      classifyScale(row({ dimensionsMm: { length_mm: 2_100, height_mm: 750 } }), RULES),
    ]
    expect(results.map((result) => result.isLargeFormat)).toEqual([false, true, false, true])
    expect(results.map((result) => result.ruleId)).toEqual([
      'rule-50',
      'rule-30',
      'rule-40',
      'rule-20',
    ])
  })
})

describe('matches', () => {
  it('treats an empty predicate as matching everything, which is what a fallthrough is', () => {
    expect(matches({}, row(), 1_000)).toBe(true)
    expect(matches({}, row({ dimensionParseState: 'ABSENT' }), null)).toBe(true)
  })

  it('never matches a measurement rule against a row with no measurement', () => {
    // Rule 10 catches these in the default set; this is the guard for a set somebody has reordered.
    expect(matches({ minLongestAxisMm: 100 }, row({ dimensionParseState: 'UNPARSED' }), null)).toBe(
      false,
    )
  })
})

describe('the rule list itself', () => {
  it('skips a disabled rule rather than treating it as failing', () => {
    const withoutTwenty = RULES.map((rule) =>
      rule.id === 'rule-20' ? { ...rule, isEnabled: false } : rule,
    )
    const result = classifyScale(
      row({ dimensionsMm: { length_mm: 2_000, height_mm: 750 } }),
      withoutTwenty,
    )
    // Falls through to rule 40, which is what "as though it were not in the list" means.
    expect(result.ruleId).toBe('rule-40')
    expect(result.isLargeFormat).toBe(false)
  })

  it('honours priority rather than array order', () => {
    const shuffled = [...RULES].reverse()
    const result = classifyScale(
      row({ dimensionsMm: { length_mm: 2_000, height_mm: 750 } }),
      shuffled,
    )
    expect(result.ruleId).toBe('rule-20')
  })

  it('bands a row UNKNOWN when no rule matches, never small', () => {
    // A rule set somebody has edited into a state where nothing matches should be visible as a wall
    // of UNKNOWN, not as a sudden collapse in the large-format count.
    const result = classifyScale(row(), [])
    expect(result.band).toBe('UNKNOWN')
    expect(result.isLargeFormat).toBeNull()
    expect(result.source).toBe('UNKNOWN')
  })

  it('never gives an UNMEASURED row a verdict, whatever the rule says', () => {
    /*
     * THE TEST IS THE MEASUREMENT, NOT THE BAND, and this assertion is where that was settled.
     *
     * An earlier version of the classifier returned a null verdict whenever the BAND came out
     * `UNKNOWN` — and the phase document's own four rows caught it: a 1 150 mm piece whose
     * proportions match no band signature is banded `UNKNOWN` and its SIZE is perfectly well known.
     * Calling that one "could not tell" would hide a confident answer among the unanswerable ones,
     * which is the dishonesty the three-valued column exists to prevent.
     *
     * What is invariant is narrower and true: no measurement, no verdict.
     */
    const contradictory: readonly ScaleRule[] = [
      {
        id: 'bad',
        priority: 1,
        predicate: {},
        resultBand: 'UNKNOWN',
        resultIsLarge: true,
        isEnabled: true,
      },
    ]

    const unmeasured = classifyScale(
      row({ dimensionsMm: null, dimensionParseState: 'UNPARSED' }),
      contradictory,
    )
    expect(unmeasured.band).toBe('UNKNOWN')
    expect(unmeasured.isLargeFormat).toBeNull()

    // A MEASURED row banded UNKNOWN keeps its verdict: its size is known even where its kind is not.
    const measured = classifyScale(row({ dimensionsMm: { length_mm: 1_900 } }), contradictory)
    expect(measured.band).toBe('UNKNOWN')
    expect(measured.isLargeFormat).toBe(true)
  })
})

describe('bandFor', () => {
  it('prefers the matched category over any signature', () => {
    const band = bandFor(row({ dimensionsMm: { length_mm: 2_400, height_mm: 740 } }), 2_400, 'WALL')
    expect(band).toBe('WALL')
  })

  it('is MONUMENTAL above two metres high, whatever the footprint', () => {
    expect(bandFor(row({ dimensionsMm: { length_mm: 600, height_mm: 2_200 } }), 2_200, null)).toBe(
      'MONUMENTAL',
    )
  })

  it('reads a long piece at dining height as DINING', () => {
    expect(bandFor(row({ dimensionsMm: { length_mm: 1_800, height_mm: 750 } }), 1_800, null)).toBe(
      'DINING',
    )
  })

  it('returns UNKNOWN rather than guessing between a bench and a coffee table', () => {
    // 900 x 400 could be any of three things, and picking one would put it into a distribution
    // somebody reads as evidence.
    expect(bandFor(row({ dimensionsMm: { length_mm: 900 } }), 900, null)).toBe('UNKNOWN')
  })

  it('is UNKNOWN with no measurement at all', () => {
    expect(bandFor(row({ dimensionsMm: null, dimensionParseState: 'ABSENT' }), null, null)).toBe(
      'UNKNOWN',
    )
  })

  it('only ever returns a band from the closed list', () => {
    const bands = new Set<string>(SCALE_BANDS)
    for (const mm of [300, 900, 1_300, 1_700, 2_500]) {
      for (const height of [null, 400, 750, 1_500, 2_400]) {
        const dimensions =
          height === null ? { length_mm: mm } : { length_mm: mm, height_mm: height }
        expect(bands.has(bandFor(row({ dimensionsMm: dimensions }), mm, null))).toBe(true)
      }
    }
  })
})
