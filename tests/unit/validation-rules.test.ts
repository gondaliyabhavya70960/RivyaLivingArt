import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  emptyDraft,
  rawProductDraftSchema,
  type RawProductDraft,
} from '@/lib/scraper/adapters/draft-schema'
import { priceExtractionSchema } from '@/lib/scraper/core/source-schema'
import {
  normalizeDraft,
  type Lexicon,
  type NormalizationOutcome,
} from '@/lib/scraper/normalization'
import {
  RESEARCH_VALIDATION_RULES,
  RULE_DEFINITIONS,
  blockingRules,
  blocksPromotion,
  evaluateRules,
  type ResearchValidationRule,
} from '@/lib/scraper/validation/rules'

/**
 * The eleven rules, and the one property that matters more than any of them individually.
 *
 * **AN `ERROR` PRODUCES A RETAINED ROW WITH AN ATTACHED ISSUE, NEVER A DATABASE ERROR.** That is
 * the phase document's own named risk — "a validation rule and a database constraint cover the same
 * condition, and the rule becomes unreachable because the write fails first" — and it is the last
 * describe block in this file. If `research_price_state_coherent` or `research_dimensions_sane`
 * were the enforcement point, the normalizer's own write would fail and the row would either vanish
 * or crash the pass; instead the normalizer refuses the VALUE and these rules attach the finding,
 * so the row is written, kept at `VALIDATED`, and visible.
 *
 * THE URL PREDICATE IS ASSERTED TO BE THE FIRST-PARTY ONE, by reading this module off disk. Rivya's
 * own editors type addresses into forms and `lib/catalog/validation.ts` owns `isSafeHttpUrl`; a
 * second copy here would be a second place for `javascript:` to be admitted, and the two would
 * drift the first time either was tightened.
 */

const LEXICON: Lexicon = [{ token: 'oak', patterns: ['oak'], family: 'wood', isEnabled: true }]

const CONFIG = priceExtractionSchema.parse({
  strategy: 'NONE',
  decimalSeparator: '.',
  thousandsSeparator: ',',
})

/**
 * A draft with some fields filled in.
 *
 * `confidence` IS MERGED RATHER THAN REPLACED, because the schema demands a value for every one of
 * the fifteen draft fields — `emptyDraft()` supplies fifteen zeros and a test naming two of them
 * means "these two were found", not "the other thirteen no longer exist".
 */
type DraftOverrides = Partial<Omit<RawProductDraft, 'confidence' | 'provenance'>> & {
  /** PARTIAL, unlike the schema's own: naming two found fields must not erase the other thirteen. */
  readonly confidence?: Partial<RawProductDraft['confidence']>
  readonly provenance?: RawProductDraft['provenance']
}

function draft(overrides: DraftOverrides = {}): RawProductDraft {
  const base = emptyDraft()
  return rawProductDraftSchema.parse({
    ...base,
    ...overrides,
    confidence: { ...base.confidence, ...(overrides.confidence ?? {}) },
    provenance: { ...base.provenance, ...(overrides.provenance ?? {}) },
  })
}

function normalise(input: RawProductDraft, currency: string | null = 'GBP'): NormalizationOutcome {
  return normalizeDraft(input, {
    declaredCurrency: currency,
    priceExtraction: CONFIG,
    lexicon: LEXICON,
  })
}

function rules(
  input: RawProductDraft,
  options: {
    readonly sourceUrl?: string
    readonly duplicateOfEarlierId?: string | null
    readonly categoryMapped?: boolean
    readonly currency?: string | null
  } = {},
): readonly ResearchValidationRule[] {
  const outcome = normalise(input, options.currency ?? 'GBP')
  return evaluateRules({
    draft: input,
    normalized: outcome.product,
    signals: outcome.signals,
    sourceUrl: options.sourceUrl ?? 'https://source.example/p/1',
    duplicateOfEarlierId: options.duplicateOfEarlierId ?? null,
    categoryMapped: options.categoryMapped ?? true,
  }).map((issue) => issue.rule)
}

/** A draft that passes everything, so each test below changes exactly one thing. */
function healthy(): RawProductDraft {
  return draft({
    title: 'A Long Oak Table',
    priceText: '£1,299.00',
    currencyText: 'GBP',
    dimensionTexts: ['200 x 90 x 75 cm'],
    materialTexts: ['Solid oak'],
    availabilityText: 'In stock',
    categoryLabels: ['Dining Tables'],
    confidence: { title: 1, priceText: 1, currencyText: 1, dimensionTexts: 1 },
    provenance: { title: 'jsonld', priceText: 'jsonld' },
  })
}

describe('the registry', () => {
  it('holds exactly the eleven rules the phase document lists', () => {
    expect([...RESEARCH_VALIDATION_RULES]).toEqual([
      'missing_title',
      'malformed_source_url',
      'non_https_url',
      'price_quote_with_amount',
      'price_zero_or_negative',
      'impossible_dimension',
      'dimension_ambiguous',
      'currency_ambiguous',
      'duplicate_source_url_within_source',
      'missing_category_mapping',
      'image_url_unreachable_shape',
      'low_confidence_extraction',
    ])
  })

  it('defines every rule, with severity and blocking agreeing today', () => {
    for (const rule of RESEARCH_VALIDATION_RULES) {
      const definition = RULE_DEFINITIONS[rule]
      expect(definition, rule).toBeDefined()
      // `blocks` is stored separately from `severity` because "serious" and "holds a row back" are
      // different decisions. They agree today, and this is where that stops being an accident.
      expect(definition.blocks, rule).toBe(definition.severity === 'ERROR')
    }
  })

  it('shares the FEAT §21 URL predicate with lib/catalog/validation.ts rather than copying it', () => {
    const source = readFileSync('lib/scraper/validation/rules.ts', 'utf8')
    expect(source).toContain("import { isSafeHttpUrl } from '@/lib/catalog/validation'")
    // And it does not declare one of its own.
    expect(source).not.toMatch(/function\s+isSafeHttpUrl/u)
  })
})

describe('each rule fires on the condition it names', () => {
  it('missing_title', () => {
    expect(rules(draft({ priceText: '£1,299.00' }))).toContain('missing_title')
    expect(rules(healthy())).not.toContain('missing_title')
  })

  it('malformed_source_url', () => {
    expect(rules(healthy(), { sourceUrl: 'javascript:alert(1)' })).toContain('malformed_source_url')
    expect(rules(healthy(), { sourceUrl: 'not a url at all' })).toContain('malformed_source_url')
  })

  it('non_https_url is a SEPARATE rule from a malformed one', () => {
    // A malformed URL is a broken extraction; a plain-http one is a page read over a channel
    // anybody on the path could have rewritten. Both block, and telling them apart is what lets an
    // operator fix the right thing.
    const fired = rules(healthy(), { sourceUrl: 'http://source.example/p/1' })
    expect(fired).toContain('non_https_url')
    expect(fired).not.toContain('malformed_source_url')
  })

  it('price_quote_with_amount', () => {
    expect(rules(draft({ title: 'A Table', priceText: 'From £499 — enquire' }))).toContain(
      'price_quote_with_amount',
    )
  })

  it('price_zero_or_negative', () => {
    expect(rules(draft({ title: 'A Table', priceText: '£0.00' }))).toContain(
      'price_zero_or_negative',
    )
  })

  it('impossible_dimension', () => {
    expect(rules(draft({ title: 'A Table', dimensionTexts: ['1 200 x 60 x 45 cm'] }))).toContain(
      'impossible_dimension',
    )
  })

  it('dimension_ambiguous', () => {
    expect(rules(draft({ title: 'A Table', dimensionTexts: ['120 x 60'] }))).toContain(
      'dimension_ambiguous',
    )
  })

  it('currency_ambiguous', () => {
    expect(
      rules(draft({ title: 'A Table', priceText: '$1,299.00' }), { currency: 'INR' }),
    ).toContain('currency_ambiguous')
  })

  it('duplicate_source_url_within_source', () => {
    expect(rules(healthy(), { duplicateOfEarlierId: 'older-row' })).toContain(
      'duplicate_source_url_within_source',
    )
  })

  it('missing_category_mapping', () => {
    expect(rules(healthy(), { categoryMapped: false })).toContain('missing_category_mapping')
    expect(rules(healthy(), { categoryMapped: true })).not.toContain('missing_category_mapping')
  })

  it('image_url_unreachable_shape, WITHOUT MAKING A REQUEST', () => {
    /*
     * THE RULE IS REACHABLE, WHICH IS THE PART WORTH TESTING. `rawProductDraftSchema` already
     * refuses `ftp:`, `data:` and bare paths, so a rule written to catch THOSE would never fire —
     * the phase document's own "a rule becomes unreachable" risk. What gets through that filter and
     * is still not an address is a reference a broken template built: `https://` with no host, or a
     * URL with a space in it. Both are draft-valid and both are caught here.
     */
    const fired = rules(
      draft({ title: 'A Table', imageUrls: ['https://', 'https://cdn.example/a b.jpg'] }),
    )
    expect(fired).toContain('image_url_unreachable_shape')
    expect(RULE_DEFINITIONS.image_url_unreachable_shape.severity).toBe('INFO')

    // AND A WELL-FORMED ADDRESS RAISES NOTHING, so the rule is not simply always on.
    expect(
      rules(draft({ title: 'A Table', imageUrls: ['https://cdn.example/a.jpg'] })),
    ).not.toContain('image_url_unreachable_shape')

    // NO REQUEST IS MADE, and the severity is what says so.
    const source = readFileSync('lib/scraper/validation/rules.ts', 'utf8')
    expect(source).not.toMatch(/\bfetch\s*\(/u)
  })

  it('low_confidence_extraction below three found fields', () => {
    const fired = rules(draft({ title: 'A Table', confidence: { title: 1, priceText: 1 } }))
    expect(fired).toContain('low_confidence_extraction')
    expect(rules(healthy())).not.toContain('low_confidence_extraction')
  })
})

describe('EVERY ERROR RULE RETAINS THE ROW AND ATTACHES A FINDING', () => {
  /*
   * THE PHASE DOCUMENT'S NAMED RISK, ASSERTED. If the database constraints were the enforcement
   * point, each of these cases would be a failed INSERT — a row that vanished, or a pass that
   * crashed holding its leases. Instead the normalizer produces a value the row is ALLOWED to hold,
   * the rule attaches the ERROR, and the row is kept at `VALIDATED` where somebody can see it.
   */
  const CASES: ReadonlyArray<readonly [ResearchValidationRule, RawProductDraft]> = [
    ['missing_title', draft({ priceText: '£1,299.00' })],
    ['price_quote_with_amount', draft({ title: 'A Table', priceText: 'From £499 — enquire' })],
    ['price_zero_or_negative', draft({ title: 'A Table', priceText: '£0.00' })],
    ['impossible_dimension', draft({ title: 'A Table', dimensionTexts: ['1 200 x 60 x 45 cm'] })],
  ]

  it.each(CASES)('%s produces a storable row, not a thrown error', (rule, input) => {
    let outcome: NormalizationOutcome | null = null
    expect(() => {
      outcome = normalise(input)
    }).not.toThrow()
    expect(outcome).not.toBeNull()

    const product = outcome!.product
    // THE VALUE THE CONSTRAINT WOULD HAVE REFUSED IS SIMPLY NOT THERE.
    if (rule === 'price_quote_with_amount' || rule === 'price_zero_or_negative') {
      expect(product.priceMinMinor).toBeNull()
      expect(product.priceMaxMinor).toBeNull()
    }
    if (rule === 'impossible_dimension') {
      expect(product.dimensionsMm).toBeNull()
      expect(product.dimensionParseState).toBe('UNPARSED')
      // AND THE SOURCE STRING IS KEPT, so nothing is lost by refusing to store the number.
      expect(product.sourceTexts.dimensions).toEqual(['1 200 x 60 x 45 cm'])
    }

    const fired = evaluateRules({
      draft: input,
      normalized: product,
      signals: outcome!.signals,
      sourceUrl: 'https://source.example/p/1',
      duplicateOfEarlierId: null,
      categoryMapped: true,
    })
    expect(fired.map((issue) => issue.rule)).toContain(rule)
    expect(blocksPromotion(fired)).toBe(true)
    expect(blockingRules(fired)).toContain(rule)
  })

  it('a WARNING does not block', () => {
    const input = draft({ title: 'A Table', dimensionTexts: ['120 x 60'], priceText: '£1,299.00' })
    const outcome = normalise(input)
    const fired = evaluateRules({
      draft: input,
      normalized: outcome.product,
      signals: outcome.signals,
      sourceUrl: 'https://source.example/p/1',
      duplicateOfEarlierId: null,
      categoryMapped: true,
    })
    expect(fired.map((issue) => issue.rule)).toContain('dimension_ambiguous')
    expect(blocksPromotion(fired)).toBe(false)
  })

  it('a clean row raises nothing at all', () => {
    expect(rules(healthy())).toEqual([])
  })

  it('every finding carries a sentence a person can act on', () => {
    const input = draft({ title: 'A Table', priceText: '£0.00', dimensionTexts: ['120 x 60'] })
    const outcome = normalise(input)
    const fired = evaluateRules({
      draft: input,
      normalized: outcome.product,
      signals: outcome.signals,
      sourceUrl: 'https://source.example/p/1',
      duplicateOfEarlierId: null,
      categoryMapped: false,
    })
    expect(fired.length).toBeGreaterThan(0)
    for (const issue of fired) {
      expect(issue.detail.length, issue.rule).toBeGreaterThan(20)
      expect(issue.severity, issue.rule).toBe(RULE_DEFINITIONS[issue.rule].severity)
    }
  })
})
