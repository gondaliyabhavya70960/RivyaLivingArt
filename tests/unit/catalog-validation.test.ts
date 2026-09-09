import { describe, expect, it } from 'vitest'

import {
  READINESS_ITEMS,
  isSafeHttpUrl,
  priceIssues,
  readinessChecklist,
  unmetForPublish,
  validateProduct,
  type ProductDraft,
} from '@/lib/catalog/validation'

/**
 * FEAT §21 and §22, rule by rule.
 *
 * WHAT IS BEING PROVED. Every rule here has a twin in the database — `products_price_state_coherent`,
 * `products_edition_size_coherent`, the unique indexes, `reject_concept_product_media` — and the
 * twin is the guarantee. These assertions are that an editor meets a sentence naming the field
 * instead of a constraint violation, and that the Server Action refuses the same rows the database
 * would, before it gets there.
 */

const VALID: ProductDraft = {
  slug: 'river-table',
  sku: 'RT-001',
  title: 'River Table',
  description: 'A table.',
  category_id: '00000000-0000-4000-8000-000000000001',
  price_state: 'FIXED',
  price_minor: 1_250_000,
  price_from_minor: null,
  currency: 'INR',
  availability_state: 'MADE_TO_ORDER',
  edition_state: 'ONE_OF_ONE',
  edition_size: null,
  is_customizable: true,
  is_large_format: false,
  dimensions: { length_mm: 2400, width_mm: 900 },
  hero_media_id: '00000000-0000-4000-8000-0000000000a1',
  seo_title: 'River Table',
  seo_description: 'A table.',
}

const codes = (draft: ProductDraft, context = {}) =>
  validateProduct(draft, context).map((issue) => issue.code)

describe('validateProduct — identity', () => {
  it('accepts a coherent product', () => {
    expect(codes(VALID)).toEqual([])
  })

  it('refuses a duplicate slug and a duplicate SKU by name', () => {
    const context = {
      takenSlugs: new Set(['river-table']),
      takenSkus: new Set(['rt-001']),
    }
    expect(codes(VALID, context)).toEqual(['slug_duplicate', 'sku_duplicate'])
  })

  it('refuses a slug that is not slug-shaped, and an empty one', () => {
    expect(codes({ ...VALID, slug: 'River Table' })).toContain('slug_shape')
    expect(codes({ ...VALID, slug: '' })).toContain('slug_required')
  })
})

describe('validateProduct — price', () => {
  it('refuses a quote-only product carrying a price, including zero', () => {
    for (const amount of [0, 1, 100]) {
      const issues = codes({
        ...VALID,
        price_state: 'REQUEST_QUOTE',
        price_minor: amount,
        currency: null,
      })
      expect(issues, String(amount)).toContain('quote_state_with_price')
    }
  })

  it('refuses a quote-only product carrying a currency with nothing to price', () => {
    expect(
      codes({ ...VALID, price_state: 'PRICE_ON_REQUEST', price_minor: null, currency: 'INR' }),
    ).toContain('quote_state_with_currency')
  })

  it('accepts both quote states with nothing beside them', () => {
    for (const state of ['REQUEST_QUOTE', 'PRICE_ON_REQUEST'] as const) {
      expect(
        codes({
          ...VALID,
          price_state: state,
          price_minor: null,
          price_from_minor: null,
          currency: null,
        }),
        state,
      ).toEqual([])
    }
  })

  it('requires an amount above zero for a fixed price, and refuses a second amount', () => {
    expect(codes({ ...VALID, price_minor: null })).toContain('fixed_price_missing')
    expect(codes({ ...VALID, price_minor: 0 })).toContain('fixed_price_missing')
    expect(codes({ ...VALID, price_from_minor: 500 })).toContain('fixed_price_with_from')
  })

  it('requires a from-amount for STARTING_FROM and refuses an exact one beside it', () => {
    const draft = { ...VALID, price_state: 'STARTING_FROM' as const, price_minor: null }
    expect(codes({ ...draft, price_from_minor: null })).toContain('starting_from_missing')
    expect(codes({ ...draft, price_from_minor: 500, price_minor: 900 })).toContain(
      'starting_from_with_fixed',
    )
  })

  it('refuses a currency that is not a three-letter code', () => {
    expect(codes({ ...VALID, currency: 'Rupees' })).toContain('currency_shape')
  })

  it('exposes the price rules on their own, for the readiness checklist', () => {
    expect(priceIssues(VALID)).toEqual([])
    expect(priceIssues({ ...VALID, price_minor: null }).length).toBeGreaterThan(0)
  })
})

describe('validateProduct — edition', () => {
  it('requires a positive size for a limited edition', () => {
    const draft = { ...VALID, edition_state: 'LIMITED_EDITION' as const }
    expect(codes({ ...draft, edition_size: null })).toContain('edition_size_required')
    expect(codes({ ...draft, edition_size: 0 })).toContain('edition_size_required')
    expect(codes({ ...draft, edition_size: 12 })).toEqual([])
  })

  it('refuses a size on any other edition state', () => {
    expect(codes({ ...VALID, edition_state: 'ONE_OF_ONE', edition_size: 12 })).toContain(
      'edition_size_not_allowed',
    )
  })
})

describe('validateProduct — dimensions', () => {
  it('refuses an unknown measurement, a non-number, zero and a negative', () => {
    expect(codes({ ...VALID, dimensions: { colour: 3 } })).toContain('dimensions_unknown_key')
    expect(codes({ ...VALID, dimensions: { length_mm: '2400' } })).toContain(
      'dimensions_not_a_number',
    )
    expect(codes({ ...VALID, dimensions: { length_mm: 0 } })).toContain('dimensions_not_positive')
    expect(codes({ ...VALID, dimensions: { length_mm: -5 } })).toContain('dimensions_not_positive')
  })

  it('refuses a measurement larger than any piece — the unit is wrong, not the piece', () => {
    expect(codes({ ...VALID, dimensions: { length_mm: 2_400_000 } })).toContain(
      'dimensions_out_of_range',
    )
  })

  it('accepts an absent dimensions blob', () => {
    expect(codes({ ...VALID, dimensions: null })).toEqual([])
  })
})

describe('validateProduct — media', () => {
  it('refuses a hero that no longer exists', () => {
    expect(codes(VALID, { knownMediaIds: new Set<string>() })).toContain('media_missing')
  })

  it('refuses a concept render as a hero, as the trigger does', () => {
    const context = {
      knownMediaIds: new Set([VALID.hero_media_id as string]),
      conceptMediaIds: new Set([VALID.hero_media_id as string]),
    }
    expect(codes(VALID, context)).toContain('media_concept')
  })
})

describe('isSafeHttpUrl', () => {
  it('accepts http and https and refuses everything else', () => {
    expect(isSafeHttpUrl('https://example.com')).toBe(true)
    expect(isSafeHttpUrl('http://example.com')).toBe(true)
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeHttpUrl('www.example.com')).toBe(false)
    expect(isSafeHttpUrl('')).toBe(false)
  })
})

describe('readinessChecklist', () => {
  it('lists all ten FEAT §22 items, in the specification order', () => {
    const checklist = readinessChecklist(VALID)
    expect(checklist.map((entry) => entry.item)).toEqual([...READINESS_ITEMS])
  })

  it('is a list of named items, never a score', () => {
    const checklist = readinessChecklist(VALID)
    for (const entry of checklist) {
      expect(typeof entry.item).toBe('string')
      expect(typeof entry.met).toBe('boolean')
    }
    expect(checklist).not.toHaveProperty('score')
  })

  it('names Hero image as unmet when there is no hero, and blocks publishing on it', () => {
    const checklist = readinessChecklist({ ...VALID, hero_media_id: null }, { materialIds: ['m1'] })
    expect(unmetForPublish(checklist)).toContain('Hero image')
  })

  it('lets a complete product publish', () => {
    expect(
      unmetForPublish(readinessChecklist(VALID, { materialIds: ['m1'], specCount: 1 })),
    ).toEqual([])
  })

  it('never blocks on Gallery or Customization', () => {
    const checklist = readinessChecklist(VALID, {
      materialIds: ['m1'],
      galleryMediaIds: [],
      specCount: 1,
    })
    expect(unmetForPublish(checklist)).toEqual([])
    expect(checklist.find((entry) => entry.item === 'Gallery')?.required).toBe(false)
    expect(checklist.find((entry) => entry.item === 'Customization')?.required).toBe(false)
  })

  /**
   * The Specifications item is the one whose SECOND branch is the point.
   *
   * It is required, so a product cannot publish while the question is open — and it is satisfiable
   * with no measurement at all, so the way to close the question is never to estimate one. A test
   * that only proved the first branch would pass just as happily against a rule that forces an
   * owner to invent a number, which is the outcome D10 exists to prevent.
   */
  describe('the Specifications item', () => {
    it('blocks publishing while the owner has neither entered specs nor declined to', () => {
      const checklist = readinessChecklist(VALID, { materialIds: ['m1'], specCount: 0 })
      expect(unmetForPublish(checklist)).toContain('Specifications')
    })

    it('is satisfied by a specification row', () => {
      const checklist = readinessChecklist(VALID, { materialIds: ['m1'], specCount: 2 })
      expect(checklist.find((entry) => entry.item === 'Specifications')?.met).toBe(true)
    })

    it('is satisfied by the deliberate omission, with no rows at all', () => {
      const checklist = readinessChecklist(
        { ...VALID, specifications_omitted: true },
        { materialIds: ['m1'], specCount: 0 },
      )
      expect(checklist.find((entry) => entry.item === 'Specifications')?.met).toBe(true)
      expect(unmetForPublish(checklist)).toEqual([])
    })

    it('is required, so the decision cannot simply be skipped', () => {
      const checklist = readinessChecklist(VALID, { materialIds: ['m1'] })
      expect(checklist.find((entry) => entry.item === 'Specifications')?.required).toBe(true)
    })
  })

  it('marks Price state unmet when the state and its columns disagree', () => {
    const checklist = readinessChecklist({ ...VALID, price_minor: null })
    expect(checklist.find((entry) => entry.item === 'Price state')?.met).toBe(false)
  })
})
