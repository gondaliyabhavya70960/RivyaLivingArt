import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { DraftField, RawProductDraft } from '@/lib/scraper/adapters/draft-schema'
import { genericAdapter } from '@/lib/scraper/adapters/generic'
import type { AdapterContext, AdapterSourceConfig, FetchedPage } from '@/lib/scraper/adapters/types'

/**
 * The `generic` adapter's first strategy: JSON-LD, in every shape a real page publishes it.
 *
 * WHAT THIS SUITE IS GUARDING IS NOT "CAN IT READ A PRODUCT" — it is the four shapes that make the
 * difference between an adapter that works on the textbook example and one that works on the web.
 * `@graph`, a top-level array, `@type` given as an array, and `offers` as an array are between them
 * most of what content-management plugins actually emit; an adapter that read only the flat
 * `{"@type":"Product"}` object would report "nothing found" on pages that publish a product
 * perfectly well, and the failure would look exactly like a site that publishes nothing.
 *
 * THE FIFTH SHAPE IS THE BROKEN ONE, AND IT IS THE ONE THE REQUIREMENT NAMES. A page carrying four
 * JSON-LD blocks from four plugins will eventually carry one with a trailing comma in it, and
 * `JSON.parse` throws on the first bad byte. FEAT §27's rule is that one malformed page costs one
 * item; the rule inside a page is the same shape one level down — one malformed block costs that
 * block. Several tests below put a broken script beside a good one and assert the good one was
 * still read.
 *
 * PROVENANCE IS ASSERTED, NOT JUST THE VALUE. `raw.provenance` exists so that a wrong value in a
 * comparison table can be traced to the rule that produced it; a test that checked only the value
 * would pass just as happily if the field had been filled by the `<title>` fallback, which is the
 * one outcome a merchandiser reading the run drawer needs to be able to tell apart.
 *
 * NO HOST, PRODUCT OR PRICE HERE DESCRIBES ANYBODY. Hosts are `example.com`-reserved, the product
 * names are invented, and no competitor is named anywhere in this repository (D10) — least of all
 * in a fixture, where the temptation is strongest.
 */

const FIXTURES = join(process.cwd(), 'tests', 'fixtures', 'scraper', 'generic')

/** The source configuration a page is read against unless a test says otherwise. */
const SOURCE: AdapterSourceConfig = {
  slug: 'fixture-source',
  baseUrl: 'https://catalogue.example.com',
  currency: 'GBP',
  imageExtractionMode: 'URL_ONLY',
  // `NONE` for both, so nothing in this file can be answered by the configured-selector strategy —
  // a JSON-LD test that passed because a selector happened to match would be testing nothing.
  priceExtraction: { strategy: 'NONE', decimalSeparator: '.', thousandsSeparator: ',' },
  skuExtraction: { strategy: 'NONE' },
  attributeExtraction: [],
}

const PAGE_URL = 'https://catalogue.example.com/products/low-table-ash'

interface Harness {
  readonly ctx: AdapterContext
  readonly warnings: readonly string[]
  readonly debugs: readonly string[]
}

/** A context granting exactly the four members `AdapterContext` names, with the log captured. */
function harness(source: Partial<AdapterSourceConfig> = {}, budgetSpent = false): Harness {
  const warnings: string[] = []
  const debugs: string[] = []

  return {
    ctx: {
      source: { ...SOURCE, ...source },
      matchUrl: () => ({ kind: null, reason: 'No pattern is configured in this stub.' }),
      logger: {
        debug: (message) => debugs.push(message),
        warn: (message) => warnings.push(message),
      },
      budgetSpent: () => budgetSpent,
    },
    warnings,
    debugs,
  }
}

function pageOf(body: string, url = PAGE_URL): FetchedPage {
  return { url, body, contentHash: null, storageKey: null, httpStatus: null }
}

/** A document with one JSON-LD block in its head, written as the page would write it. */
function pageWithJsonLd(json: string, type = 'application/ld+json'): string {
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<title>Fixture Page — Example Catalogue</title>',
    `<script type="${type}">${json}</script>`,
    '</head><body><h1>Fixture Page</h1></body></html>',
  ].join('')
}

async function extract(body: string, harnessed: Harness = harness()): Promise<RawProductDraft> {
  return genericAdapter.extract(harnessed.ctx, pageOf(body))
}

/** One field's value, confidence and provenance, read the way the run drawer reads them. */
function field(
  draft: RawProductDraft,
  name: DraftField,
): { value: unknown; confidence: 0 | 1; provenance: string | undefined } {
  return {
    value: draft[name],
    confidence: draft.confidence[name],
    provenance: draft.provenance[name],
  }
}

const readFixture = (name: string): string => readFileSync(join(FIXTURES, `${name}.html`), 'utf8')

const readExpected = (name: string): unknown =>
  JSON.parse(readFileSync(join(FIXTURES, `${name}.expected.json`), 'utf8'))

/** The plain shape, reused wherever a test cares about one key rather than the whole document. */
function product(extra: Readonly<Record<string, unknown>>): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', ...extra })
}

describe('a plain JSON-LD product', () => {
  it('reads the name into the title and says which rule found it', async () => {
    const draft = await extract(pageWithJsonLd(product({ name: 'Low Table, Ash' })))

    expect(field(draft, 'title')).toEqual({
      value: 'Low Table, Ash',
      confidence: 1,
      provenance: 'jsonld',
    })
  })

  it('reads the price out of an offers OBJECT', async () => {
    const draft = await extract(
      pageWithJsonLd(
        product({ name: 'Low Table, Ash', offers: { '@type': 'Offer', price: '1299.00' } }),
      ),
    )

    expect(field(draft, 'priceText')).toEqual({
      value: '1299.00',
      confidence: 1,
      provenance: 'jsonld',
    })
  })

  it('reads the currency and the availability off the same offer as the price', async () => {
    const draft = await extract(
      pageWithJsonLd(
        product({
          name: 'Low Table, Ash',
          offers: {
            '@type': 'Offer',
            price: '1299.00',
            priceCurrency: 'GBP',
            availability: 'https://schema.org/InStock',
          },
        }),
      ),
    )

    expect(draft.currencyText).toBe('GBP')
    expect(draft.availabilityText).toBe('https://schema.org/InStock')
    expect(draft.provenance.availabilityText).toBe('jsonld')
  })

  it('records the availability IRI exactly as the page wrote it, unresolved and unmapped', async () => {
    // `InStock` is Phase 28's to interpret. An adapter that turned this into `true`, `IN_STOCK` or
    // `available` would be normalising, and the second normaliser is the one nobody re-runs.
    const draft = await extract(
      pageWithJsonLd(
        product({
          name: 'Low Table, Ash',
          offers: { '@type': 'Offer', price: '1', availability: 'http://schema.org/OutOfStock' },
        }),
      ),
    )

    expect(draft.availabilityText).toBe('http://schema.org/OutOfStock')
  })

  it('reads the sku, and takes productID as the external identifier when both are present', async () => {
    const draft = await extract(
      pageWithJsonLd(product({ name: 'Low Table, Ash', sku: 'AB-1234', productID: 'P-0001' })),
    )

    expect(draft.skuText).toBe('AB-1234')
    expect(draft.externalId).toBe('P-0001')
  })

  it('falls back to the sku as the external identifier when no productID is published', async () => {
    const draft = await extract(pageWithJsonLd(product({ name: 'Bench', sku: 'CD-5678' })))

    expect(draft.externalId).toBe('CD-5678')
    expect(draft.provenance.externalId).toBe('jsonld')
  })

  it('does not read @id as the external identifier', async () => {
    // `@id` identifies the NODE — commonly a fragment like `#product` — rather than the thing. It
    // would deduplicate every product on a site into one.
    const draft = await extract(
      pageWithJsonLd(product({ '@id': 'https://catalogue.example.com/p#product', name: 'Bench' })),
    )

    expect(field(draft, 'externalId')).toEqual({
      value: null,
      confidence: 0,
      provenance: undefined,
    })
  })

  it('records the canonical URL the page claims, without resolving it', async () => {
    const draft = await extract(pageWithJsonLd(product({ name: 'Bench', url: '/products/bench' })))

    expect(draft.canonicalUrl).toBe('/products/bench')
  })

  it('reads an image array, resolving a relative reference against the page URL', async () => {
    const draft = await extract(
      pageWithJsonLd(
        product({
          name: 'Bench',
          image: ['https://images.example.com/bench-1.jpg', '/img/bench-2.jpg'],
        }),
      ),
    )

    expect(draft.imageUrls).toEqual([
      'https://images.example.com/bench-1.jpg',
      'https://catalogue.example.com/img/bench-2.jpg',
    ])
  })

  it('drops a data: placeholder without costing the rest of the gallery', async () => {
    const draft = await extract(
      pageWithJsonLd(
        product({
          name: 'Bench',
          image: ['data:image/gif;base64,R0lGODlhAQABAAAAACw=', '/img/bench-2.jpg'],
        }),
      ),
    )

    expect(draft.imageUrls).toEqual(['https://catalogue.example.com/img/bench-2.jpg'])
    expect(draft.confidence.imageUrls).toBe(1)
  })

  it('reads an ImageObject through its url, and through contentUrl when there is no url', async () => {
    const draft = await extract(
      pageWithJsonLd(
        product({
          name: 'Bench',
          image: [
            { '@type': 'ImageObject', url: 'https://images.example.com/one.jpg' },
            { '@type': 'ImageObject', contentUrl: 'https://images.example.com/two.jpg' },
          ],
        }),
      ),
    )

    expect(draft.imageUrls).toEqual([
      'https://images.example.com/one.jpg',
      'https://images.example.com/two.jpg',
    ])
  })

  it('reads materials from strings and from a nested item’s name, in the page’s order', async () => {
    const draft = await extract(
      pageWithJsonLd(
        product({ name: 'Bench', material: ['Ash', { '@type': 'Product', name: 'Brass' }] }),
      ),
    )

    expect(draft.materialTexts).toEqual(['Ash', 'Brass'])
    expect(draft.provenance.materialTexts).toBe('jsonld')
  })

  it('reads a category, whether it is a string or a thing with a name', async () => {
    const draft = await extract(
      pageWithJsonLd(
        product({ name: 'Bench', category: [{ '@type': 'Thing', name: 'Seating' }, 'Benches'] }),
      ),
    )

    expect(draft.categoryLabels).toEqual(['Seating', 'Benches'])
  })

  it('records width, depth and height as the page printed them, in the page’s order', async () => {
    const draft = await extract(
      pageWithJsonLd(
        product({ name: 'Bench', width: '1200 mm', depth: '600 mm', height: '380 mm' }),
      ),
    )

    expect(draft.dimensionTexts).toEqual(['1200 mm', '600 mm', '380 mm'])
  })

  it('does not assemble a dimension out of a QuantitativeValue’s number and unit code', async () => {
    // `{ value: 1200, unitCode: 'MMT' }` is a unit decision, and unit decisions are Phase 28's.
    const draft = await extract(
      pageWithJsonLd(
        product({
          name: 'Bench',
          width: { '@type': 'QuantitativeValue', value: 1200, unitCode: 'MMT' },
        }),
      ),
    )

    expect(field(draft, 'dimensionTexts')).toEqual({
      value: [],
      confidence: 0,
      provenance: undefined,
    })
  })

  it('leaves a field the page never mentioned at confidence 0 with no provenance', async () => {
    const draft = await extract(pageWithJsonLd(product({ name: 'Bench' })))

    expect(field(draft, 'leadTimeText')).toEqual({
      value: null,
      confidence: 0,
      provenance: undefined,
    })
  })
})

describe('the shapes a page actually publishes', () => {
  it('finds the product inside @graph, beside nodes that are not products', async () => {
    const draft = await extract(
      pageWithJsonLd(
        JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            { '@type': 'WebSite', name: 'Example Catalogue' },
            { '@type': 'Product', name: 'Slat Bench, Oak' },
          ],
        }),
      ),
    )

    expect(field(draft, 'title')).toEqual({
      value: 'Slat Bench, Oak',
      confidence: 1,
      provenance: 'jsonld',
    })
  })

  it('does not take a name off a BreadcrumbList that sits beside the product', async () => {
    const draft = await extract(
      pageWithJsonLd(
        JSON.stringify({
          '@graph': [
            { '@type': 'BreadcrumbList', name: 'Seating' },
            { '@type': 'Product', name: 'Slat Bench, Oak' },
          ],
        }),
      ),
    )

    expect(draft.title).toBe('Slat Bench, Oak')
  })

  it('finds the product in a top-level ARRAY of nodes', async () => {
    const draft = await extract(
      pageWithJsonLd(
        JSON.stringify([
          { '@type': 'Organization', name: 'Example Catalogue' },
          { '@type': 'Product', name: 'Slat Bench, Oak' },
        ]),
      ),
    )

    expect(draft.title).toBe('Slat Bench, Oak')
  })

  it('accepts @type given as an ARRAY', async () => {
    const draft = await extract(
      pageWithJsonLd(
        JSON.stringify({ '@type': ['Product', 'IndividualProduct'], name: 'Slat Bench, Oak' }),
      ),
    )

    expect(draft.title).toBe('Slat Bench, Oak')
  })

  it('accepts the four schema.org subtypes of Product', async () => {
    for (const type of ['ProductModel', 'ProductGroup', 'IndividualProduct', 'SomeProducts']) {
      const draft = await extract(pageWithJsonLd(JSON.stringify({ '@type': type, name: 'Bench' })))
      expect(draft.title).toBe('Bench')
    }
  })

  it('refuses a type that merely ends in Product', async () => {
    // A bespoke `RelatedProduct` from somebody's own vocabulary is not a product page's product,
    // and reading it would put a wrong value in with full confidence behind it.
    const draft = await extract(
      pageWithJsonLd(JSON.stringify({ '@type': 'RelatedProduct', name: 'Not A Product' })),
    )

    expect(field(draft, 'title')).toEqual({
      value: 'Fixture Page — Example Catalogue',
      confidence: 1,
      provenance: 'title',
    })
  })

  it('matches a full schema.org IRI and a prefixed name alike', async () => {
    for (const type of [
      'https://schema.org/Product',
      'http://schema.org/Product',
      'schema:Product',
    ]) {
      const draft = await extract(pageWithJsonLd(JSON.stringify({ '@type': type, name: 'Bench' })))
      expect(draft.provenance.title).toBe('jsonld')
    }
  })

  it('takes the first offer WITH A PRICE out of an offers array', async () => {
    const draft = await extract(
      pageWithJsonLd(
        product({
          name: 'Bench',
          offers: [
            { '@type': 'Offer', priceCurrency: 'EUR', availability: 'https://schema.org/PreOrder' },
            {
              '@type': 'Offer',
              price: '890.00',
              priceCurrency: 'GBP',
              availability: 'https://schema.org/InStock',
            },
          ],
        }),
      ),
    )

    expect(draft.priceText).toBe('890.00')
    // The currency and availability come from the SAME offer, which is what stops two true
    // statements being assembled into a false one.
    expect(draft.currencyText).toBe('GBP')
    expect(draft.availabilityText).toBe('https://schema.org/InStock')
  })

  it('falls back to the first offer for currency when NO offer carries a price', async () => {
    const draft = await extract(
      pageWithJsonLd(
        product({
          name: 'Bench',
          offers: [
            { '@type': 'Offer', priceCurrency: 'EUR' },
            { '@type': 'Offer', priceCurrency: 'GBP' },
          ],
        }),
      ),
    )

    expect(draft.priceText).toBeNull()
    expect(draft.currencyText).toBe('EUR')
  })

  it('reads lowPrice from an AggregateOffer', async () => {
    const draft = await extract(
      pageWithJsonLd(
        product({
          name: 'Bench',
          offers: { '@type': 'AggregateOffer', lowPrice: '640.00', priceCurrency: 'GBP' },
        }),
      ),
    )

    expect(draft.priceText).toBe('640.00')
  })

  it('reads a price published directly on the product, with no offer at all', async () => {
    const draft = await extract(pageWithJsonLd(product({ name: 'Bench', price: '210.00' })))

    expect(draft.priceText).toBe('210.00')
  })

  it('renders a JSON number as its own text and never reformats it', async () => {
    const draft = await extract(pageWithJsonLd(product({ name: 'Bench', price: 890 })))

    // 890, not 890.00 and not 890.0 — JSON said 890, and the encoding is the publisher's.
    expect(draft.priceText).toBe('890')
    expect(typeof draft.priceText).toBe('string')
  })

  it('does not record a null price as a value', async () => {
    const draft = await extract(pageWithJsonLd(product({ name: 'Bench', price: null })))

    expect(field(draft, 'priceText')).toEqual({ value: null, confidence: 0, provenance: undefined })
  })

  it('uses the FIRST product node when a page publishes several, and says so in the log', async () => {
    const harnessed = harness()
    const draft = await extract(
      pageWithJsonLd(
        JSON.stringify({
          '@graph': [
            { '@type': 'Product', name: 'Slat Bench, Oak', sku: 'CD-5678' },
            { '@type': 'Product', name: 'Offcut Stool, Walnut', sku: 'ZZ-0000' },
          ],
        }),
      ),
      harnessed,
    )

    // NOT A MERGE. A name from one product and a SKU from another is a product that exists nowhere.
    expect(draft.title).toBe('Slat Bench, Oak')
    expect(draft.skuText).toBe('CD-5678')
    expect(harnessed.debugs.join(' ')).toContain('json-ld product nodes')
  })
})

describe('a malformed block beside a good one', () => {
  const brokenAndGood = [
    '<!doctype html><html lang="en"><head>',
    '<title>Rope Stool, Ash — Example Catalogue</title>',
    '<script type="application/ld+json">{ "@type": "Product", "name": "Broken",</script>',
    `<script type="application/ld+json">${product({ name: 'Rope Stool, Ash', sku: 'KL-2468' })}</script>`,
    '</head><body><h1>Rope Stool, Ash</h1></body></html>',
  ].join('')

  it('still reads the block that parsed', async () => {
    const draft = await extract(brokenAndGood)

    expect(field(draft, 'title')).toEqual({
      value: 'Rope Stool, Ash',
      confidence: 1,
      provenance: 'jsonld',
    })
    expect(draft.skuText).toBe('KL-2468')
  })

  it('warns once, with counts and no page content in the line', async () => {
    const harnessed = harness()
    await extract(brokenAndGood, harnessed)

    expect(harnessed.warnings).toHaveLength(1)
    expect(harnessed.warnings[0]).toContain('json-ld blocks could not be parsed')
    // A third party's markup must never reach Rivya's logs — `AdapterLogger` takes scalars, and
    // the message itself must not carry a fragment either.
    expect(harnessed.warnings[0]).not.toContain('Broken')
  })

  it('produces a draft rather than throwing when EVERY block is broken', async () => {
    const draft = await extract(pageWithJsonLd('{ "@type": "Product", "name": "Broken",'))

    expect(draft.provenance.title).toBe('title')
    expect(draft.confidence.priceText).toBe(0)
  })

  it('accepts a media type carrying a charset parameter', async () => {
    const draft = await extract(
      pageWithJsonLd(product({ name: 'Bench' }), 'application/ld+json; charset=utf-8'),
    )

    expect(draft.provenance.title).toBe('jsonld')
  })

  it('ignores a script tag that is not JSON-LD at all', async () => {
    const body = [
      '<!doctype html><html lang="en"><head><title>Fixture Page</title>',
      `<script type="text/javascript">${product({ name: 'Not Structured Data' })}</script>`,
      '</head><body><h1>Fixture Page</h1></body></html>',
    ].join('')

    const draft = await extract(body)

    expect(draft.provenance.title).toBe('title')
  })

  it('survives a deeply nested document without throwing', async () => {
    let nested: Record<string, unknown> = { '@type': 'Product', name: 'Buried' }
    for (let depth = 0; depth < 40; depth += 1) nested = { mainEntity: nested }

    const draft = await extract(pageWithJsonLd(JSON.stringify(nested)))

    // Bounded rather than found: the walk stops before it reaches this one, and the page still
    // yields a draft with the `<title>` behind it.
    expect(draft.provenance.title).toBe('title')
  })

  it('reads nothing at all once the CPU budget is spent', async () => {
    const spent = harness({}, true)
    const draft = await extract(pageWithJsonLd(product({ name: 'Bench', sku: 'AB-1' })), spent)

    for (const key of Object.values(draft.confidence)) expect(key).toBe(0)
    expect(draft.provenance).toEqual({})
  })
})

describe('the golden fixtures', () => {
  for (const name of ['jsonld-product', 'jsonld-graph', 'malformed']) {
    it(`reads ${name}.html exactly as ${name}.expected.json says`, async () => {
      const draft = await genericAdapter.extract(
        harness().ctx,
        pageOf(readFixture(name), `https://catalogue.example.com/products/${name}`),
      )

      expect(draft).toEqual(readExpected(name))
    })
  }
})
