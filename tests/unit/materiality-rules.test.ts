import { describe, expect, it } from 'vitest'

import {
  CHANGE_FIELDS,
  DEFAULT_THRESHOLDS,
  classifyAvailability,
  classifyDimensions,
  classifyExact,
  classifyImages,
  classifyLeadTime,
  classifyPrice,
  classifyText,
  classifyTokenSet,
  imageIdentity,
  resolveThresholds,
  type ChangeRule,
  type ResolvedThresholds,
} from '@/lib/scraper/analytics/materiality'

/**
 * The rule table, asked its own questions.
 *
 * EVERY CASE BELOW IS THE PHASE DOCUMENT'S OWN TABLE, and that is the point of the file rather than
 * a nicety. These eleven rules are what somebody will argue with — "why did the queue not tell me
 * this competitor raised its prices" is the complaint this phase exists to prevent, and the only
 * settleable form of that argument is a fixture beside an expected word.
 *
 * NO DATABASE. The rules are pure functions over two values and a threshold, which is what makes
 * re-classification after a threshold edit a loop over stored rows rather than a re-fetch of
 * anybody's website.
 */

const GLOBAL: ResolvedThresholds = {
  material: null,
  minor: null,
  isEnabled: true,
  origin: 'GLOBAL',
}

const withThresholds = (material: number | null, minor: number | null): ResolvedThresholds => ({
  material,
  minor,
  isEnabled: true,
  origin: 'GLOBAL',
})

describe('the rule table matches the migration', () => {
  it('has a default for every field the constraint admits', () => {
    // 0270's `research_change_rules_field_allowlist` is this list. A field with no default is a
    // field the classifier would fall back to `price`'s numbers for, silently.
    for (const field of CHANGE_FIELDS) {
      expect(DEFAULT_THRESHOLDS[field]).toBeDefined()
    }
    expect(Object.keys(DEFAULT_THRESHOLDS).sort()).toEqual([...CHANGE_FIELDS].sort())
  })

  it('carries the numbers 0270 seeds', () => {
    expect(DEFAULT_THRESHOLDS.price.material).toBe(0.05)
    expect(DEFAULT_THRESHOLDS.title.material).toBe(0.9)
    expect(DEFAULT_THRESHOLDS.title.minor).toBe(0.99)
    expect(DEFAULT_THRESHOLDS.dimensions_mm.material).toBe(0.02)
    expect(DEFAULT_THRESHOLDS.description.material).toBe(0.8)
    expect(DEFAULT_THRESHOLDS.description.minor).toBe(0.95)
  })

  it('has no threshold where any change is material', () => {
    for (const field of ['availability', 'variant_count', 'material_tokens', 'sku'] as const) {
      expect(DEFAULT_THRESHOLDS[field]).toEqual({ material: null, minor: null })
    }
  })
})

describe('resolveThresholds', () => {
  const rules: readonly ChangeRule[] = [
    {
      sourceId: null,
      field: 'price',
      materialThreshold: 0.05,
      minorThreshold: null,
      isEnabled: true,
    },
    {
      sourceId: 'source-a',
      field: 'price',
      materialThreshold: 0.01,
      minorThreshold: null,
      isEnabled: true,
    },
  ]

  it('prefers the per-source override', () => {
    expect(resolveThresholds('price', 'source-a', rules).material).toBe(0.01)
    expect(resolveThresholds('price', 'source-a', rules).origin).toBe('SOURCE')
  })

  it('falls back to the global default for another source', () => {
    // THE VERIFICATION STEP THE PHASE DOCUMENT ASKS FOR: tuning one source leaves the rest alone.
    expect(resolveThresholds('price', 'source-b', rules).material).toBe(0.05)
    expect(resolveThresholds('price', 'source-b', rules).origin).toBe('GLOBAL')
  })

  it('falls back to the built-in table when no row exists at all', () => {
    const resolved = resolveThresholds('title', 'source-a', rules)
    expect(resolved.origin).toBe('BUILT_IN')
    expect(resolved.material).toBe(0.9)
  })
})

describe('price', () => {
  const fixed = (minor: number) => ({
    state: 'FIXED',
    currency: 'GBP',
    minMinor: minor,
    maxMinor: null,
  })

  it('calls a 3 % move minor and an 8 % move material', () => {
    const three = classifyPrice(fixed(100_000), fixed(103_000), withThresholds(0.05, null))
    expect(three.materiality).toBe('MINOR')

    const eight = classifyPrice(fixed(100_000), fixed(108_000), withThresholds(0.05, null))
    expect(eight.materiality).toBe('MATERIAL')
  })

  it('calls a state change material at the same amount', () => {
    // THE RULE THAT OVERRIDES THE PERCENTAGE ONE. A competitor withdrawing a public price is one of
    // the most informative things this pipeline can observe, and comparing amounts calls it nothing.
    const withdrawn = classifyPrice(
      fixed(100_000),
      { state: 'REQUEST_QUOTE', currency: 'GBP', minMinor: null, maxMinor: null },
      withThresholds(0.05, null),
    )
    expect(withdrawn.materiality).toBe('MATERIAL')
    expect(withdrawn.reason).toBe('price.state_changed')
  })

  it('reclassifies the 3 % move as material when the source threshold is lowered to 1 %', () => {
    const tuned = classifyPrice(fixed(100_000), fixed(103_000), withThresholds(0.01, null))
    expect(tuned.materiality).toBe('MATERIAL')
  })

  it('calls equal minor units with an unchanged range noise', () => {
    expect(classifyPrice(fixed(100_000), fixed(100_000), GLOBAL).materiality).toBe('NOISE')
  })

  it('does not divide by a zero price', () => {
    // Infinity would classify by an arithmetic accident rather than by the rule.
    const fromZero = classifyPrice(fixed(0), fixed(9_900), withThresholds(0.05, null))
    expect(fromZero.materiality).toBe('MATERIAL')
    expect(fromZero.reason).toBe('price.from_zero')
  })

  it('treats a currency change as material', () => {
    const moved = classifyPrice(
      fixed(100_000),
      { state: 'FIXED', currency: 'EUR', minMinor: 100_000, maxMinor: null },
      GLOBAL,
    )
    expect(moved.materiality).toBe('MATERIAL')
  })
})

describe('title and description', () => {
  it('calls whitespace and case noise', () => {
    const noise = classifyText('title', 'Oak dining table', '  OAK   Dining Table ', GLOBAL)
    expect(noise.materiality).toBe('NOISE')
    expect(noise.reason).toBe('title.whitespace_or_case_only')
  })

  it('calls a rewritten title material', () => {
    const rewritten = classifyText(
      'title',
      'Oak dining table',
      'Walnut sideboard with brass handles',
      withThresholds(0.9, 0.99),
    )
    expect(rewritten.materiality).toBe('MATERIAL')
  })

  it('bands by similarity in the right direction', () => {
    // BELOW `material` IS MATERIAL, because low similarity means a large change. Backwards, this
    // rule would call a rewritten name noise and a corrected typo urgent — plausible either way,
    // which is exactly why the expected word is written down rather than the arithmetic.
    const edited = classifyText(
      'description',
      'A solid oak table finished with hardwax oil.',
      'A solid oak table finished with hard wax oil.',
      withThresholds(0.8, 0.95),
    )
    expect(['MINOR', 'NOISE']).toContain(edited.materiality)
    expect((edited.measure ?? 0) > 0.8).toBe(true)
  })
})

describe('availability', () => {
  it('is material on any transition and noise on the same token', () => {
    expect(classifyAvailability('IN_STOCK', 'MADE_TO_ORDER').materiality).toBe('MATERIAL')
    expect(classifyAvailability('IN_STOCK', 'IN_STOCK').materiality).toBe('NOISE')
  })
})

describe('dimensions', () => {
  it('is material when any axis moves by the threshold', () => {
    const moved = classifyDimensions(
      { length_mm: 1_200, width_mm: 600 },
      { length_mm: 1_200, width_mm: 900 },
      withThresholds(0.02, null),
    )
    expect(moved.materiality).toBe('MATERIAL')
  })

  it('is minor below the threshold', () => {
    const nudged = classifyDimensions(
      { length_mm: 1_200 },
      { length_mm: 1_210 },
      withThresholds(0.02, null),
    )
    expect(nudged.materiality).toBe('MINOR')
  })

  it('is material when an axis appears or disappears', () => {
    const gained = classifyDimensions(
      { length_mm: 1_200 },
      { length_mm: 1_200, height_mm: 750 },
      withThresholds(0.02, null),
    )
    expect(gained.materiality).toBe('MATERIAL')
    expect(gained.reason).toBe('dimensions.axis_appeared_or_left')
  })

  it('takes the largest move rather than the average', () => {
    // Averaging a 40 % depth move against two unmoved axes reports 13 % and calls it minor.
    const one = classifyDimensions(
      { length_mm: 1_000, width_mm: 1_000, depth_mm: 1_000 },
      { length_mm: 1_000, width_mm: 1_000, depth_mm: 1_400 },
      withThresholds(0.02, null),
    )
    expect(one.materiality).toBe('MATERIAL')
    expect(one.measure).toBeCloseTo(0.4, 5)
  })

  it('is noise when the values are equal', () => {
    expect(classifyDimensions({ length_mm: 1_200 }, { length_mm: 1_200 }, GLOBAL).materiality).toBe(
      'NOISE',
    )
  })
})

describe('token sets', () => {
  it('is noise when only the order changed', () => {
    expect(
      classifyTokenSet('material_tokens', ['oak', 'brass'], ['brass', 'oak']).materiality,
    ).toBe('NOISE')
  })

  it('is material when a token is added or removed', () => {
    expect(classifyTokenSet('material_tokens', ['oak'], ['oak', 'brass']).materiality).toBe(
      'MATERIAL',
    )
    expect(classifyTokenSet('material_tokens', ['oak', 'brass'], ['oak']).materiality).toBe(
      'MATERIAL',
    )
  })
})

describe('images', () => {
  it('identifies a picture by its path', () => {
    expect(imageIdentity('https://img.example.com/a/b.jpg?v=2')).toBe('/a/b.jpg')
    expect(imageIdentity('https://cdn.example.com/a/b.jpg')).toBe('/a/b.jpg')
  })

  it('is noise when only the query string or the host moved', () => {
    const delivery = classifyImages(
      ['https://img.example.com/a.jpg?v=1'],
      ['https://cdn.example.com/a.jpg?v=2'],
    )
    expect(delivery.materiality).toBe('NOISE')
    expect(delivery.reason).toBe('image_urls.delivery_only')
  })

  it('is material when one URL is removed and another added', () => {
    const swapped = classifyImages(
      ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
      ['https://example.com/b.jpg', 'https://example.com/c.jpg'],
    )
    expect(swapped.materiality).toBe('MATERIAL')
    expect(swapped.reason).toBe('image_urls.set_changed')
  })
})

describe('lead time and the exact fields', () => {
  it('compares the parsed range, not the prose', () => {
    expect(
      classifyLeadTime({ minDays: 28, maxDays: 42 }, { minDays: 28, maxDays: 42 }).materiality,
    ).toBe('NOISE')
    expect(
      classifyLeadTime({ minDays: 28, maxDays: 42 }, { minDays: 42, maxDays: 56 }).materiality,
    ).toBe('MATERIAL')
  })

  it('calls any variant or sku change material', () => {
    expect(classifyExact('variant_count', true).materiality).toBe('MATERIAL')
    expect(classifyExact('sku', true).materiality).toBe('MATERIAL')
    expect(classifyExact('sku', false).materiality).toBe('NOISE')
  })
})
