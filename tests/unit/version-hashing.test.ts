import { describe, expect, it } from 'vitest'

import { emptyDraft, withField, type RawProductDraft } from '@/lib/scraper/adapters/draft-schema'
import { draftContentHash, stableStringify } from '@/lib/scraper/core/content-hash'

/**
 * What makes two readings of a page one observation, and what makes them two.
 *
 * `research_product_versions_unique_content` IS THE RULE THIS FILE GUARDS. A nightly run over four
 * hundred pages, almost all of them unchanged, must write almost no rows — and the only thing
 * standing between that and four hundred rows a night is that an unchanged product hashes to the
 * value it hashed to yesterday. Every test here is one way that could stop being true.
 *
 * THE TWO DIRECTIONS FAIL DIFFERENTLY AND BOTH ARE TESTED. A hash that moves when nothing changed
 * fills the version table with noise and makes Phase 29 report a catalogue-wide change on a day
 * nothing happened — the worst kind of false alarm, because it is large, simultaneous and looks
 * enough like a real repricing to be believed. A hash that stays put when something DID change
 * loses the observation altogether: the row is refused by the unique constraint and nothing
 * anywhere says a price moved.
 *
 * THE SUBTLE CASE IS THE BOOKKEEPING. `confidence` and `provenance` are excluded from the hash, so
 * an adapter fix that starts reading a price from JSON-LD where it used to fall back to a selector
 * changes the provenance of every product on that source while changing no price at all — and must
 * produce no versions. That assertion is the reason this file exists as much as the price one is.
 *
 * NO HOST OR PRODUCT HERE DESCRIBES ANYBODY: `example.com`-reserved hosts and invented names, per
 * D10.
 */

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

/**
 * One observation, with the keys in the order the schema declares them.
 *
 * A LITERAL RATHER THAN A BUILDER, because two of the tests below are about key order and a builder
 * would produce the same order every time — which is precisely the property that must not be
 * assumed.
 */
const forwards: RawProductDraft = {
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
  imageUrls: ['https://images.example.com/a.jpg', 'https://images.example.com/b.jpg'],
  categoryLabels: ['Tables', 'Living'],
  externalId: 'AB-1234',
  canonicalUrl: 'https://catalogue.example.com/p/low-table',
  confidence: { ...NONE_FOUND, title: 1, priceText: 1, imageUrls: 1 },
  provenance: { title: 'jsonld', priceText: 'jsonld', imageUrls: 'selector' },
}

/** The same observation, written in the reverse order. `withField` builds drafts by spreading. */
const backwards: RawProductDraft = {
  provenance: { imageUrls: 'selector', priceText: 'jsonld', title: 'jsonld' },
  confidence: { ...NONE_FOUND, imageUrls: 1, priceText: 1, title: 1 },
  canonicalUrl: 'https://catalogue.example.com/p/low-table',
  externalId: 'AB-1234',
  categoryLabels: ['Tables', 'Living'],
  imageUrls: ['https://images.example.com/a.jpg', 'https://images.example.com/b.jpg'],
  customizationTexts: ['Made to size'],
  variantTexts: ['Oiled', 'Lacquered'],
  materialTexts: ['Ash', 'Brass'],
  dimensionTexts: ['W 1200 mm', 'D 600 mm', 'H 380 mm'],
  descriptionHtml: '<p>A low table in solid ash.</p>',
  leadTimeText: '6–8 weeks',
  availabilityText: 'In stock',
  skuText: 'AB-1234',
  currencyText: 'GBP',
  priceText: '1,299.00',
  title: 'Low Table, Ash',
}

const changed = (overrides: Partial<RawProductDraft>): RawProductDraft => ({
  ...forwards,
  ...overrides,
})

describe('the hash is over the draft, and it is stable', () => {
  it('is sixty-four lower-case hexadecimal characters', () => {
    expect(draftContentHash(forwards)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('gives two identical drafts one hash', () => {
    expect(draftContentHash(forwards)).toBe(draftContentHash(changed({})))
  })

  /**
   * `JSON.stringify` PRESERVES INSERTION ORDER, AND `withField` BUILDS A DRAFT BY SPREADING — so
   * insertion order is the order the strategies happened to fire in. A source whose JSON-LD is
   * intermittent would otherwise alternate between two hashes and write a version every other run
   * for a page that never moved.
   */
  it('does not care what order the keys were written in', () => {
    expect(draftContentHash(backwards)).toBe(draftContentHash(forwards))
  })

  it('agrees with a draft assembled field by field through withField', () => {
    let assembled = emptyDraft()
    assembled = withField(assembled, 'title', 'Low Table, Ash', 'jsonld')
    assembled = withField(assembled, 'priceText', '1,299.00', 'jsonld')

    const literal = changed({
      title: 'Low Table, Ash',
      priceText: '1,299.00',
      currencyText: null,
      skuText: null,
      availabilityText: null,
      leadTimeText: null,
      descriptionHtml: null,
      dimensionTexts: [],
      materialTexts: [],
      variantTexts: [],
      customizationTexts: [],
      imageUrls: [],
      categoryLabels: [],
      externalId: null,
      canonicalUrl: null,
      confidence: { ...NONE_FOUND, title: 1, priceText: 1 },
      provenance: { title: 'jsonld', priceText: 'jsonld' },
    })

    expect(draftContentHash(assembled)).toBe(draftContentHash(literal))
  })
})

describe('a change to what the source published is a new observation', () => {
  it('moves when the price moves', () => {
    expect(draftContentHash(changed({ priceText: '1,399.00' }))).not.toBe(
      draftContentHash(forwards),
    )
  })

  it('moves when the title is rewritten', () => {
    expect(draftContentHash(changed({ title: 'Low Table, Oak' }))).not.toBe(
      draftContentHash(forwards),
    )
  })

  it('moves when an image is added to the gallery', () => {
    expect(
      draftContentHash(
        changed({ imageUrls: [...forwards.imageUrls, 'https://images.example.com/c.jpg'] }),
      ),
    ).not.toBe(draftContentHash(forwards))
  })

  it('moves when an image is removed from the gallery', () => {
    expect(draftContentHash(changed({ imageUrls: ['https://images.example.com/a.jpg'] }))).not.toBe(
      draftContentHash(forwards),
    )
  })

  /**
   * ARRAYS ARE NOT SORTED, DELIBERATELY. The first image is the one a listing shows, so a re-ordered
   * gallery IS a change worth a version; sorting would make a redesigned page indistinguishable
   * from an untouched one.
   */
  it('moves when the gallery is re-ordered but holds the same images', () => {
    expect(draftContentHash(changed({ imageUrls: [...forwards.imageUrls].reverse() }))).not.toBe(
      draftContentHash(forwards),
    )
  })

  it('moves when a specification list is re-ordered, because line order is how it reads', () => {
    expect(
      draftContentHash(changed({ dimensionTexts: ['D 600 mm', 'W 1200 mm', 'H 380 mm'] })),
    ).not.toBe(draftContentHash(forwards))
  })

  it('distinguishes a value the page stopped printing from one it printed as empty', () => {
    expect(draftContentHash(changed({ skuText: null }))).not.toBe(
      draftContentHash(changed({ skuText: '' })),
    )
  })

  it('distinguishes an empty list from a list with one entry', () => {
    expect(draftContentHash(changed({ materialTexts: [] }))).not.toBe(
      draftContentHash(changed({ materialTexts: ['Ash'] })),
    )
  })
})

describe('a change to how a value was found is not a change to the product', () => {
  /**
   * THE ADAPTER-FIX CASE. Reading a price from JSON-LD where it used to come from a selector is a
   * better answer to the same question. If provenance were hashed, the first run after that fix
   * would write a new version for every product on the source and Phase 29 would report the whole
   * catalogue as having changed on a day nothing did.
   */
  it('ignores a provenance that names a different strategy for the same value', () => {
    expect(
      draftContentHash(
        changed({ provenance: { title: 'microdata', priceText: 'jsonld', imageUrls: 'selector' } }),
      ),
    ).toBe(draftContentHash(forwards))
  })

  it('ignores provenance being dropped altogether', () => {
    expect(draftContentHash(changed({ provenance: {} }))).toBe(draftContentHash(forwards))
  })

  it('ignores a confidence flag flipping', () => {
    expect(
      draftContentHash(changed({ confidence: { ...NONE_FOUND, title: 1, priceText: 1 } })),
    ).toBe(draftContentHash(forwards))
  })

  it('ignores both maps changing at once, which is what an adapter fix actually looks like', () => {
    expect(
      draftContentHash(
        changed({
          confidence: { ...NONE_FOUND, title: 1 },
          provenance: { title: 'opengraph' },
        }),
      ),
    ).toBe(draftContentHash(forwards))
  })
})

describe('stableStringify', () => {
  it('sorts the keys of an object', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}')
  })

  it('sorts at every depth, not only at the top', () => {
    expect(stableStringify({ outer: { b: 1, a: { d: 4, c: 3 } } })).toBe(
      '{"outer":{"a":{"c":3,"d":4},"b":1}}',
    )
  })

  it('leaves an array in the order it was given', () => {
    expect(stableStringify(['b', 'a', 'c'])).toBe('["b","a","c"]')
  })

  it('sorts the keys of an object inside an array without moving the array', () => {
    expect(
      stableStringify([
        { b: 1, a: 2 },
        { d: 3, c: 4 },
      ]),
    ).toBe('[{"a":2,"b":1},{"c":4,"d":3}]')
  })

  /**
   * CODE-UNIT ORDER, NOT `localeCompare`. This string feeds a hash stored in a database and
   * compared against for years; a locale-sensitive comparator would reorder the keys the day a Node
   * upgrade shipped new ICU data, changing every hash in the system at once. In `en`,
   * `localeCompare` puts `'a'` before `'Z'` and `'ä'` before `'z'` — both the reverse of this.
   */
  it('orders keys by code unit rather than by locale', () => {
    expect(stableStringify({ a: 1, Z: 2 })).toBe('{"Z":2,"a":1}')
    expect(stableStringify({ ä: 1, z: 2 })).toBe('{"z":2,"ä":1}')
  })

  it('drops a key whose value is undefined, as JSON.stringify does', () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe('{"a":1}')
  })

  it('writes null for null', () => {
    expect(stableStringify({ a: null })).toBe('{"a":null}')
  })

  it('writes strings, numbers and booleans as JSON does', () => {
    expect(stableStringify({ s: 'x', n: 12, t: true, f: false })).toBe(
      '{"f":false,"n":12,"s":"x","t":true}',
    )
  })

  it('escapes a quotation mark in a key and in a value', () => {
    expect(stableStringify({ 'a"b': 'c"d' })).toBe('{"a\\"b":"c\\"d"}')
  })

  it('writes an empty object and an empty array distinguishably', () => {
    expect(stableStringify({})).toBe('{}')
    expect(stableStringify([])).toBe('[]')
    expect(stableStringify({ a: {}, b: [] })).toBe('{"a":{},"b":[]}')
  })

  it('is unchanged by the order two objects with the same content were built in', () => {
    expect(stableStringify({ a: [1, 2], b: { c: 3, d: 4 } })).toBe(
      stableStringify({ b: { d: 4, c: 3 }, a: [1, 2] }),
    )
  })
})
