import { describe, expect, it } from 'vitest'
import type { z } from 'zod'

import {
  DRAFT_FIELDS,
  MAX_DESCRIPTION_HTML_LENGTH,
  MAX_IMAGE_URLS,
  MAX_LIST_ENTRIES,
  MAX_TEXT_LENGTH,
  MAX_TITLE_LENGTH,
  PROVENANCE_STRATEGIES,
  emptyDraft,
  rawProductDraftSchema,
  withField,
  type RawProductDraft,
} from '@/lib/scraper/adapters/draft-schema'

/**
 * `RawProductDraft`, and the one thing it is built to refuse.
 *
 * THE CENTRAL ASSERTION IN THIS FILE IS THAT `priceText: 1299` FAILS. Everything else here is a
 * bound; that one is the phase's exit criterion, written as a test because a schema is only as
 * strict as the case somebody wrote for it. A draft carrying a parsed number would put price
 * parsing in an adapter as well as in Phase 28's normaliser, and the adapter's copy is the one that
 * never gets re-run when a decimal-separator rule is corrected — so the values it produced stay
 * wrong for as long as they are kept.
 *
 * EVERY REJECTION ASSERTS ON THE ISSUE PATH, NOT MERELY ON FAILURE, which is the habit
 * `tests/unit/source-schema.test.ts` sets and the reason it sets it: a test checking only
 * `success === false` passes for the wrong reason all the time. Rename `priceText` to `priceString`
 * and a fixture carrying the old name now has an unrecognised key and a missing required one — two
 * failures, one passing test, and nothing anywhere saying the field moved. Asserting the path makes
 * a rename fail HERE.
 *
 * THE FIELD NAMES ARE WRITTEN OUT BELOW RATHER THAN IMPORTED, for the same reason. A test that
 * derived its expectations from `DRAFT_FIELDS` would agree with any list that module happened to
 * hold, including a list somebody had quietly shortened.
 *
 * NO HOST, PRODUCT OR PRICE HERE DESCRIBES ANYBODY. Hosts are `example.com`-reserved, the product
 * names are invented, and no competitor is named anywhere in this repository (D10) — in a fixture
 * least of all, since a fixture is where the temptation is strongest.
 */

type ParseResult = { readonly success: boolean; readonly error?: z.ZodError }

/** The issue paths of a parse that must have failed, dotted, so `['a', 0]` reads `a.0`. */
function rejectedPaths(result: ParseResult): readonly string[] {
  expect(result.success).toBe(false)
  return (result.error?.issues ?? []).map((issue) => issue.path.join('.'))
}

/** FEAT §27's fifteen, in its order. Held to `DRAFT_FIELDS` by the first test below. */
const FIELD_NAMES = [
  'title',
  'priceText',
  'currencyText',
  'skuText',
  'availabilityText',
  'leadTimeText',
  'descriptionHtml',
  'dimensionTexts',
  'materialTexts',
  'variantTexts',
  'customizationTexts',
  'imageUrls',
  'categoryLabels',
  'externalId',
  'canonicalUrl',
] as const

/** Every field defaulted. Spread and override to say which ones a fixture found. */
const NONE_FOUND: RawProductDraft['confidence'] = {
  title: 0,
  priceText: 0,
  currencyText: 0,
  skuText: 0,
  availabilityText: 0,
  leadTimeText: 0,
  descriptionHtml: 0,
  dimensionTexts: 0,
  materialTexts: 0,
  variantTexts: 0,
  customizationTexts: 0,
  imageUrls: 0,
  categoryLabels: 0,
  externalId: 0,
  canonicalUrl: 0,
}

/** A complete draft: every key the schema names, every value the page's own string. */
const validDraft: RawProductDraft = {
  title: 'Low Table, Ash',
  priceText: '1,299.00',
  currencyText: 'GBP',
  skuText: 'AB-1234',
  availabilityText: 'In stock',
  leadTimeText: '6–8 weeks',
  descriptionHtml: '<p>A low table in solid ash.</p>',
  dimensionTexts: ['W 1200 mm', 'D 600 mm', 'H 380 mm'],
  materialTexts: ['Ash', 'Brass'],
  variantTexts: ['Oiled', 'Lacquered'],
  customizationTexts: ['Made to size'],
  imageUrls: ['https://images.example.com/low-table-1.jpg'],
  categoryLabels: ['Tables', 'Living'],
  externalId: 'AB-1234',
  canonicalUrl: 'https://catalogue.example.com/p/low-table',
  confidence: { ...NONE_FOUND, title: 1, priceText: 1, imageUrls: 1 },
  provenance: { title: 'jsonld', priceText: 'jsonld', imageUrls: 'selector' },
}

/** A draft with one thing changed, handed to `safeParse` as the unknown input it really is. */
function draft(overrides: Readonly<Record<string, unknown>>): unknown {
  return { ...validDraft, ...overrides }
}

const repeat = (length: number): string => 'x'.repeat(length)

describe('the field list', () => {
  it('names FEAT §27’s fifteen fields, in the order the requirement writes them', () => {
    expect([...DRAFT_FIELDS]).toEqual([...FIELD_NAMES])
  })

  it('gives the schema exactly those fields plus the two bookkeeping maps, and nothing else', () => {
    expect(Object.keys(rawProductDraftSchema.shape)).toEqual([
      ...FIELD_NAMES,
      'confidence',
      'provenance',
    ])
  })

  it('names the seven extraction strategies, in the generic adapter’s first-hit-wins order', () => {
    expect([...PROVENANCE_STRATEGIES]).toEqual([
      'jsonld',
      'microdata',
      'rdfa',
      'opengraph',
      'selector',
      'title',
      'h1',
    ])
  })

  it('caps at the documented numbers', () => {
    expect(MAX_TITLE_LENGTH).toBe(500)
    expect(MAX_DESCRIPTION_HTML_LENGTH).toBe(200_000)
    expect(MAX_TEXT_LENGTH).toBe(2_000)
    expect(MAX_IMAGE_URLS).toBe(40)
    expect(MAX_LIST_ENTRIES).toBe(60)
  })
})

describe('the draft shape', () => {
  it('accepts a complete draft', () => {
    expect(rawProductDraftSchema.safeParse(validDraft).success).toBe(true)
  })

  it('accepts a draft that found nothing at all', () => {
    expect(rawProductDraftSchema.safeParse(emptyDraft()).success).toBe(true)
  })

  /**
   * STRICT, FOR `core/raw.ts`'s REASON. An extra key is normalisation arriving early under a name
   * nobody reviewed — and it is on its way into a jsonb column that later phases read.
   */
  it('rejects an unrecognised key at the root rather than dropping it', () => {
    const result = rawProductDraftSchema.safeParse(draft({ priceMinor: '129900' }))
    expect(rejectedPaths(result)).toContain('')
    expect(result.error?.issues[0]?.code).toBe('unrecognized_keys')
  })

  it('rejects a normalised sibling smuggled in beside the raw one', () => {
    expect(
      rejectedPaths(rawProductDraftSchema.safeParse(draft({ priceMinorUnits: 129900 }))),
    ).toContain('')
  })

  it('rejects a missing field at that field’s own path', () => {
    const { title: _title, ...withoutTitle } = validDraft
    expect(rejectedPaths(rawProductDraftSchema.safeParse(withoutTitle))).toEqual(['title'])
  })

  it('rejects a missing bookkeeping map at its own path', () => {
    const { provenance: _provenance, ...withoutProvenance } = validDraft
    expect(rejectedPaths(rawProductDraftSchema.safeParse(withoutProvenance))).toEqual([
      'provenance',
    ])
  })
})

describe('every field is the source’s own string — a parsed value fails', () => {
  /** The phase's exit criterion: "a parsed number in a draft fails validation". */
  it('refuses `priceText: 1299` at `priceText`', () => {
    expect(rejectedPaths(rawProductDraftSchema.safeParse(draft({ priceText: 1299 })))).toEqual([
      'priceText',
    ])
  })

  it('refuses a price that has been resolved into an object', () => {
    expect(
      rejectedPaths(
        rawProductDraftSchema.safeParse(draft({ priceText: { amount: 1299, currency: 'GBP' } })),
      ),
    ).toEqual(['priceText'])
  })

  it('refuses a numeric title', () => {
    expect(rejectedPaths(rawProductDraftSchema.safeParse(draft({ title: 42 })))).toEqual(['title'])
  })

  it('refuses a numeric SKU, however numeric the source’s SKUs look', () => {
    expect(rejectedPaths(rawProductDraftSchema.safeParse(draft({ skuText: 1234 })))).toEqual([
      'skuText',
    ])
  })

  it('refuses availability parsed into a boolean', () => {
    expect(
      rejectedPaths(rawProductDraftSchema.safeParse(draft({ availabilityText: true }))),
    ).toEqual(['availabilityText'])
  })

  it('refuses a lead time converted into a number of days', () => {
    expect(rejectedPaths(rawProductDraftSchema.safeParse(draft({ leadTimeText: 42 })))).toEqual([
      'leadTimeText',
    ])
  })

  it('accepts the price exactly as the page printed it, separators and all', () => {
    const result = rawProductDraftSchema.safeParse(draft({ priceText: '1.234,56' }))
    expect(result.success).toBe(true)
    expect(result.data?.priceText).toBe('1.234,56')
  })

  it('refuses a number inside a list field, at the offending index', () => {
    expect(
      rejectedPaths(rawProductDraftSchema.safeParse(draft({ dimensionTexts: ['W 1200 mm', 600] }))),
    ).toEqual(['dimensionTexts.1'])
  })

  it('refuses a single string where a list belongs', () => {
    expect(rejectedPaths(rawProductDraftSchema.safeParse(draft({ materialTexts: 'Ash' })))).toEqual(
      ['materialTexts'],
    )
  })

  it('refuses `null` where a list belongs — an empty list is how "none" is said', () => {
    expect(rejectedPaths(rawProductDraftSchema.safeParse(draft({ variantTexts: null })))).toEqual([
      'variantTexts',
    ])
  })
})

describe('nothing a third party controls may be unbounded', () => {
  it('trims a title before measuring it', () => {
    const result = rawProductDraftSchema.safeParse(draft({ title: '   Low Table   ' }))
    expect(result.data?.title).toBe('Low Table')
  })

  it('accepts a title of exactly the cap', () => {
    expect(
      rawProductDraftSchema.safeParse(draft({ title: repeat(MAX_TITLE_LENGTH) })).success,
    ).toBe(true)
  })

  it('rejects a title one character over the cap, at `title`', () => {
    expect(
      rejectedPaths(
        rawProductDraftSchema.safeParse(draft({ title: repeat(MAX_TITLE_LENGTH + 1) })),
      ),
    ).toEqual(['title'])
  })

  it('gives a description far more room than a title, because the specification lives there', () => {
    expect(
      rawProductDraftSchema.safeParse(
        draft({ descriptionHtml: repeat(MAX_DESCRIPTION_HTML_LENGTH) }),
      ).success,
    ).toBe(true)
  })

  it('rejects a description one character over its cap', () => {
    expect(
      rejectedPaths(
        rawProductDraftSchema.safeParse(
          draft({ descriptionHtml: repeat(MAX_DESCRIPTION_HTML_LENGTH + 1) }),
        ),
      ),
    ).toEqual(['descriptionHtml'])
  })

  it('holds every other string to the shorter cap', () => {
    expect(
      rawProductDraftSchema.safeParse(draft({ priceText: repeat(MAX_TEXT_LENGTH) })).success,
    ).toBe(true)
    expect(
      rejectedPaths(
        rawProductDraftSchema.safeParse(draft({ priceText: repeat(MAX_TEXT_LENGTH + 1) })),
      ),
    ).toEqual(['priceText'])
  })

  it('caps a list entry as well as the list, and says which entry', () => {
    expect(
      rejectedPaths(
        rawProductDraftSchema.safeParse(
          draft({ materialTexts: ['Ash', repeat(MAX_TEXT_LENGTH + 1)] }),
        ),
      ),
    ).toEqual(['materialTexts.1'])
  })

  it('accepts a list of exactly the cap', () => {
    const entries = Array.from({ length: MAX_LIST_ENTRIES }, (_value, index) => `W ${index} mm`)
    expect(rawProductDraftSchema.safeParse(draft({ dimensionTexts: entries })).success).toBe(true)
  })

  it('rejects a list one entry over the cap, at the field', () => {
    const entries = Array.from({ length: MAX_LIST_ENTRIES + 1 }, (_value, index) => `W ${index} mm`)
    expect(
      rejectedPaths(rawProductDraftSchema.safeParse(draft({ dimensionTexts: entries }))),
    ).toEqual(['dimensionTexts'])
  })

  /** Tighter than the rest: a page offering four hundred images is not showing one product. */
  it('accepts exactly forty image references and refuses the forty-first', () => {
    const images = Array.from(
      { length: MAX_IMAGE_URLS },
      (_value, index) => `https://images.example.com/${index}.jpg`,
    )
    expect(rawProductDraftSchema.safeParse(draft({ imageUrls: images })).success).toBe(true)
    expect(
      rejectedPaths(
        rawProductDraftSchema.safeParse(
          draft({ imageUrls: [...images, 'https://images.example.com/40.jpg'] }),
        ),
      ),
    ).toEqual(['imageUrls'])
  })
})

describe('image references are http(s) strings and are never fetched', () => {
  it('accepts https', () => {
    expect(
      rawProductDraftSchema.safeParse(draft({ imageUrls: ['https://images.example.com/a.jpg'] }))
        .success,
    ).toBe(true)
  })

  it('accepts plain http, which is readable even where it is not storable as a base URL', () => {
    expect(
      rawProductDraftSchema.safeParse(draft({ imageUrls: ['http://127.0.0.1:8080/a.jpg'] }))
        .success,
    ).toBe(true)
  })

  it('trims a reference before judging its scheme', () => {
    const result = rawProductDraftSchema.safeParse(
      draft({ imageUrls: ['  https://images.example.com/a.jpg  '] }),
    )
    expect(result.data?.imageUrls[0]).toBe('https://images.example.com/a.jpg')
  })

  it('rejects a `data:` payload at the offending index — the draft holds references, not bytes', () => {
    expect(
      rejectedPaths(
        rawProductDraftSchema.safeParse(draft({ imageUrls: ['data:image/gif;base64,AA'] })),
      ),
    ).toEqual(['imageUrls.0'])
  })

  it('rejects a `javascript:` href picked up off a gallery control', () => {
    expect(
      rejectedPaths(rawProductDraftSchema.safeParse(draft({ imageUrls: ['javascript:void(0)'] }))),
    ).toEqual(['imageUrls.0'])
  })

  it('rejects a protocol-relative reference, which names no scheme at all', () => {
    expect(
      rejectedPaths(
        rawProductDraftSchema.safeParse(draft({ imageUrls: ['//images.example.com/a.jpg'] })),
      ),
    ).toEqual(['imageUrls.0'])
  })

  it('rejects a path that was never resolved against the page', () => {
    expect(
      rejectedPaths(rawProductDraftSchema.safeParse(draft({ imageUrls: ['/media/a.jpg'] }))),
    ).toEqual(['imageUrls.0'])
  })

  it('names the index of the bad reference rather than the whole field', () => {
    expect(
      rejectedPaths(
        rawProductDraftSchema.safeParse(
          draft({ imageUrls: ['https://images.example.com/a.jpg', 'data:image/gif;base64,AA'] }),
        ),
      ),
    ).toEqual(['imageUrls.1'])
  })
})

describe('confidence records which fields were found rather than defaulted', () => {
  it('demands an answer for every field, and names the one that is missing', () => {
    const { canonicalUrl: _canonicalUrl, ...partial } = validDraft.confidence
    expect(rejectedPaths(rawProductDraftSchema.safeParse(draft({ confidence: partial })))).toEqual([
      'confidence.canonicalUrl',
    ])
  })

  it('refuses a key that is not a draft field, so a page cannot contribute one', () => {
    const result = rawProductDraftSchema.safeParse(
      draft({ confidence: { ...NONE_FOUND, priceMinor: 1 } }),
    )
    expect(rejectedPaths(result)).toEqual(['confidence'])
    expect(result.error?.issues[0]?.code).toBe('unrecognized_keys')
  })

  it('refuses a value that is neither 0 nor 1, at the field it was given for', () => {
    expect(
      rejectedPaths(
        rawProductDraftSchema.safeParse(draft({ confidence: { ...NONE_FOUND, title: 2 } })),
      ),
    ).toEqual(['confidence.title'])
  })

  it('refuses a confidence expressed as a probability — it is a found flag, not a score', () => {
    expect(
      rejectedPaths(
        rawProductDraftSchema.safeParse(draft({ confidence: { ...NONE_FOUND, title: 0.8 } })),
      ),
    ).toEqual(['confidence.title'])
  })

  it('accepts a mixture of found and defaulted', () => {
    expect(
      rawProductDraftSchema.safeParse(
        draft({ confidence: { ...NONE_FOUND, title: 1, skuText: 1 } }),
      ).success,
    ).toBe(true)
  })
})

describe('provenance records which rule produced a value', () => {
  it('accepts an empty map, because a draft that found nothing attributes nothing', () => {
    expect(rawProductDraftSchema.safeParse(draft({ provenance: {} })).success).toBe(true)
  })

  it('accepts every one of the seven strategies', () => {
    for (const strategy of PROVENANCE_STRATEGIES) {
      expect(
        rawProductDraftSchema.safeParse(draft({ provenance: { title: strategy } })).success,
      ).toBe(true)
    }
  })

  it('refuses a strategy outside the closed list, at the field it was claimed for', () => {
    expect(
      rejectedPaths(rawProductDraftSchema.safeParse(draft({ provenance: { title: 'jsonId' } }))),
    ).toEqual(['provenance.title'])
  })

  it('refuses a free-text explanation where a strategy belongs', () => {
    expect(
      rejectedPaths(
        rawProductDraftSchema.safeParse(draft({ provenance: { priceText: 'read off the page' } })),
      ),
    ).toEqual(['provenance.priceText'])
  })

  it('refuses a key that is not a draft field', () => {
    const result = rawProductDraftSchema.safeParse(draft({ provenance: { priceMinor: 'jsonld' } }))
    expect(rejectedPaths(result)).toEqual(['provenance'])
    expect(result.error?.issues[0]?.code).toBe('unrecognized_keys')
  })
})

describe('emptyDraft', () => {
  it('reports every field as not found', () => {
    const found = emptyDraft().confidence
    expect(FIELD_NAMES.every((field) => found[field] === 0)).toBe(true)
  })

  it('attributes nothing, because nothing was found', () => {
    expect(emptyDraft().provenance).toEqual({})
  })

  it('defaults every text field to null and every list field to an empty list', () => {
    const draftValue = emptyDraft()
    expect(draftValue.title).toBeNull()
    expect(draftValue.priceText).toBeNull()
    expect(draftValue.canonicalUrl).toBeNull()
    expect(draftValue.dimensionTexts).toEqual([])
    expect(draftValue.imageUrls).toEqual([])
    expect(draftValue.categoryLabels).toEqual([])
  })

  it('leaves no field undefined — a defaulted field is null, and the difference is visible', () => {
    const draftValue: Record<string, unknown> = { ...emptyDraft() }
    expect(FIELD_NAMES.filter((field) => draftValue[field] === undefined)).toEqual([])
  })

  it('returns a fresh draft each time, so one page cannot inherit another’s reading', () => {
    expect(emptyDraft()).not.toBe(emptyDraft())
    expect(emptyDraft().confidence).not.toBe(emptyDraft().confidence)
  })
})

describe('withField — first hit wins', () => {
  it('records the value, the confidence and the strategy together', () => {
    const result = withField(emptyDraft(), 'priceText', '£1,299.00', 'jsonld')
    expect(result.priceText).toBe('£1,299.00')
    expect(result.confidence.priceText).toBe(1)
    expect(result.provenance.priceText).toBe('jsonld')
  })

  /**
   * THE STRATEGY ORDER, ENFORCED IN ONE PLACE. An adapter written as a sequence of `withField`
   * calls in JSON-LD → microdata → RDFa → OpenGraph → selector → title → h1 order is correct by
   * construction; a fallback that could overwrite structured data would not be.
   */
  it('leaves a value found by an earlier strategy alone', () => {
    const first = withField(emptyDraft(), 'title', 'Low Table, Ash', 'jsonld')
    const second = withField(first, 'title', 'Low Table, Ash | Catalogue', 'title')
    expect(second.title).toBe('Low Table, Ash')
  })

  it('does not rewrite the provenance of a value it left alone', () => {
    const first = withField(emptyDraft(), 'title', 'Low Table, Ash', 'jsonld')
    expect(withField(first, 'title', 'Something else', 'h1').provenance.title).toBe('jsonld')
  })

  it('returns the very same draft when there is nothing to add', () => {
    const first = withField(emptyDraft(), 'title', 'Low Table, Ash', 'jsonld')
    expect(withField(first, 'title', 'Something else', 'h1')).toBe(first)
  })

  it('still lets a later strategy fill a field the earlier one missed', () => {
    const first = withField(emptyDraft(), 'title', 'Low Table, Ash', 'jsonld')
    const second = withField(first, 'priceText', '1,299.00', 'opengraph')
    expect(second.title).toBe('Low Table, Ash')
    expect(second.priceText).toBe('1,299.00')
    expect(second.provenance).toEqual({ title: 'jsonld', priceText: 'opengraph' })
  })

  it('does not mutate the draft it was given', () => {
    const before = emptyDraft()
    withField(before, 'title', 'Low Table, Ash', 'jsonld')
    expect(before.title).toBeNull()
    expect(before.confidence.title).toBe(0)
    expect(before.provenance).toEqual({})
  })

  it('produces a draft the schema accepts', () => {
    const result = withField(
      withField(emptyDraft(), 'title', 'Low Table, Ash', 'h1'),
      'imageUrls',
      ['https://images.example.com/a.jpg'],
      'selector',
    )
    expect(rawProductDraftSchema.safeParse(result).success).toBe(true)
  })
})

describe('withField — an empty value is not a hit', () => {
  it('treats null as nothing found, leaving the next strategy its turn', () => {
    const result = withField(emptyDraft(), 'skuText', null, 'jsonld')
    expect(result.confidence.skuText).toBe(0)
    expect(result.provenance.skuText).toBeUndefined()
  })

  it('treats a whitespace-only string as nothing found', () => {
    const result = withField(emptyDraft(), 'skuText', '   \n  ', 'selector')
    expect(result.skuText).toBeNull()
    expect(result.confidence.skuText).toBe(0)
  })

  it('treats an empty list as nothing found', () => {
    const result = withField(emptyDraft(), 'materialTexts', [], 'selector')
    expect(result.confidence.materialTexts).toBe(0)
    expect(result.provenance.materialTexts).toBeUndefined()
  })

  it('treats a list of nothing but blanks as nothing found', () => {
    expect(
      withField(emptyDraft(), 'materialTexts', ['', '  '], 'selector').confidence.materialTexts,
    ).toBe(0)
  })

  it('leaves the whole draft identical when nothing was found', () => {
    const before = emptyDraft()
    expect(withField(before, 'priceText', null, 'jsonld')).toBe(before)
  })
})

describe('withField — it truncates where the schema refuses', () => {
  it('trims a value on the way in', () => {
    expect(withField(emptyDraft(), 'skuText', '  AB-1234  ', 'selector').skuText).toBe('AB-1234')
  })

  it('truncates an over-long title rather than costing the item its draft', () => {
    const result = withField(emptyDraft(), 'title', repeat(MAX_TITLE_LENGTH + 200), 'title')
    expect(result.title).toHaveLength(MAX_TITLE_LENGTH)
    expect(rawProductDraftSchema.safeParse(result).success).toBe(true)
  })

  it('truncates an over-long description to its own, larger cap', () => {
    const result = withField(
      emptyDraft(),
      'descriptionHtml',
      repeat(MAX_DESCRIPTION_HTML_LENGTH + 10),
      'selector',
    )
    expect(result.descriptionHtml).toHaveLength(MAX_DESCRIPTION_HTML_LENGTH)
  })

  it('caps a list and drops the blanks inside it', () => {
    const entries = Array.from(
      { length: MAX_LIST_ENTRIES + 10 },
      (_value, index) => `W ${index} mm`,
    )
    const result = withField(emptyDraft(), 'dimensionTexts', ['', ...entries], 'selector')
    expect(result.dimensionTexts).toHaveLength(MAX_LIST_ENTRIES)
    expect(result.dimensionTexts[0]).toBe('W 0 mm')
  })

  it('caps image references at their own tighter number', () => {
    const images = Array.from(
      { length: MAX_IMAGE_URLS + 5 },
      (_value, index) => `https://images.example.com/${index}.jpg`,
    )
    expect(withField(emptyDraft(), 'imageUrls', images, 'selector').imageUrls).toHaveLength(
      MAX_IMAGE_URLS,
    )
  })

  /**
   * A LAZY-LOADING GALLERY SERVES A PLACEHOLDER IN `src`. Refusing the whole draft over a spacer
   * pixel would cost the product; dropping the entry is the same choice `core/raw.ts` makes when it
   * filters hrefs.
   */
  it('drops an inadmissible image reference instead of failing the draft', () => {
    const result = withField(
      emptyDraft(),
      'imageUrls',
      ['data:image/gif;base64,AA', 'https://images.example.com/a.jpg'],
      'selector',
    )
    expect(result.imageUrls).toEqual(['https://images.example.com/a.jpg'])
    expect(rawProductDraftSchema.safeParse(result).success).toBe(true)
  })

  it('counts a gallery of nothing but placeholders as nothing found', () => {
    const result = withField(
      emptyDraft(),
      'imageUrls',
      ['data:image/gif;base64,AA', 'javascript:void(0)'],
      'selector',
    )
    expect(result.imageUrls).toEqual([])
    expect(result.confidence.imageUrls).toBe(0)
  })

  it('keeps a repeated entry, because deciding a page meant it once is normalisation', () => {
    const result = withField(emptyDraft(), 'materialTexts', ['Ash', 'Ash'], 'selector')
    expect(result.materialTexts).toEqual(['Ash', 'Ash'])
  })
})
