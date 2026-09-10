import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { DraftField, RawProductDraft } from '@/lib/scraper/adapters/draft-schema'
import { GENERIC_ADAPTER_VERSION, genericAdapter } from '@/lib/scraper/adapters/generic'
import {
  GENERIC_ADAPTER_KEY,
  getAdapterDescriptor,
  registerBuiltInAdapters,
} from '@/lib/scraper/adapters/registry'
import type { AdapterContext, AdapterSourceConfig, FetchedPage } from '@/lib/scraper/adapters/types'

/**
 * Everything the `generic` adapter falls back to once JSON-LD has said nothing — and the promise
 * that a page it cannot read costs one item rather than a batch.
 *
 * THE ORDER IS THE SUBJECT OF THIS FILE, NOT THE INDIVIDUAL READERS. Microdata, RDFa, OpenGraph,
 * the source's configured selectors, then `<title>` and `<h1>`: each of those is a weaker claim
 * than the one before it, and several tests below publish two strategies' worth of data on one page
 * to assert which one wins. That matters because the answer is written into `raw.provenance` and
 * read by a merchandiser deciding how much to trust a row — a price that quietly came from a
 * selector where the page published one properly is a price nobody would think to check.
 *
 * `extract()` NEVER THROWS, AND THE TESTS FOR IT ARE DELIBERATELY STUPID INPUTS. An empty string, a
 * page of binary, unclosed tags, a configured selector that will not compile, a jsonb blob that is
 * not what the schema says. Each returns a draft with low confidence, because an item marked
 * `FAILED` says "this adapter is broken" and a low-confidence draft says "this adapter's rules did
 * not fit this page" — different findings, acted on differently, and collapsing them would make a
 * redesigned catalogue indistinguishable from a bug.
 *
 * THE CONFIGURED-SELECTOR TESTS PARSE THEIR CONFIGURATION THROUGH THE REAL SCHEMAS by handing the
 * adapter the same shapes `research_sources` stores. That is the point of the strategy: the three
 * columns are jsonb, so what comes back is whatever was written, and the adapter is required to
 * validate rather than trust it. Two tests hand it rubbish to prove the refusal is a skipped rule
 * rather than an exception.
 *
 * NO HOST, PRODUCT OR PRICE HERE DESCRIBES ANYBODY. Hosts are `example.com`-reserved, the product
 * names are invented, and no competitor is named anywhere in this repository (D10).
 */

const FIXTURES = join(process.cwd(), 'tests', 'fixtures', 'scraper', 'generic')

const SOURCE: AdapterSourceConfig = {
  slug: 'fixture-source',
  baseUrl: 'https://catalogue.example.com',
  currency: 'GBP',
  imageExtractionMode: 'URL_ONLY',
  priceExtraction: { strategy: 'NONE', decimalSeparator: '.', thousandsSeparator: ',' },
  skuExtraction: { strategy: 'NONE' },
  attributeExtraction: [],
}

/**
 * The configuration `selectors-configured.html` is read with, in the shape the jsonb columns hold.
 *
 * WRITTEN OUT RATHER THAN BUILT, so that a change to `priceExtractionSchema` that this adapter
 * would silently stop honouring fails here instead of in production.
 */
const CONFIGURED: Partial<AdapterSourceConfig> = {
  priceExtraction: {
    strategy: 'SELECTOR',
    selector: '.price',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  skuExtraction: { strategy: 'SELECTOR', selector: '.sku', stripPattern: '^SKU:\\s*' },
  attributeExtraction: [
    { key: 'dimensions', selector: '.specification li', kind: 'TEXT' },
    { key: 'lead_time', selector: '.lead-time', kind: 'TEXT' },
    { key: 'variants', selector: '.finishes li', kind: 'TEXT' },
    { key: 'customization', selector: '.made-to-order', kind: 'ATTRIBUTE', attribute: 'data-note' },
  ],
}

const PAGE_URL = 'https://catalogue.example.com/products/fixture'

interface Harness {
  readonly ctx: AdapterContext
  readonly warnings: readonly string[]
  readonly matched: readonly string[]
}

function harness(source: Partial<AdapterSourceConfig> = {}, budgetSpent = false): Harness {
  const warnings: string[] = []
  const matched: string[] = []

  return {
    ctx: {
      source: { ...SOURCE, ...source },
      matchUrl: (url) => {
        matched.push(url)
        return url.includes('/products/')
          ? { kind: 'PRODUCT', reason: 'MATCHED' }
          : { kind: null, reason: 'NO_MATCH' }
      },
      logger: { debug: () => undefined, warn: (message) => warnings.push(message) },
      budgetSpent: () => budgetSpent,
    },
    warnings,
    matched,
  }
}

function pageOf(body: string, url = PAGE_URL): FetchedPage {
  return { url, body, contentHash: null, storageKey: null, httpStatus: null }
}

async function extract(body: string, harnessed: Harness = harness()): Promise<RawProductDraft> {
  return genericAdapter.extract(harnessed.ctx, pageOf(body))
}

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

/** A document body, written the way a page writes one. */
function document(head: string, body: string): string {
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    head,
    '</head><body>',
    body,
    '</body></html>',
  ].join('')
}

describe('microdata', () => {
  const item = (inner: string): string =>
    document(
      '<title>Fixture Page — Example Catalogue</title>',
      `<main itemscope itemtype="https://schema.org/Product">${inner}</main>`,
    )

  it('reads a name and records microdata as the rule that found it', async () => {
    const draft = await extract(item('<h1 itemprop="name">Panel Screen, Walnut</h1>'))

    expect(field(draft, 'title')).toEqual({
      value: 'Panel Screen, Walnut',
      confidence: 1,
      provenance: 'microdata',
    })
  })

  it('reads a meta element’s content, which is where a correctly published price lives', async () => {
    const draft = await extract(
      item('<span itemprop="name">Bench</span><meta itemprop="sku" content="EF-9012">'),
    )

    expect(draft.skuText).toBe('EF-9012')
  })

  it('reads price, currency and availability out of a nested offers scope', async () => {
    const draft = await extract(
      item(
        [
          '<span itemprop="name">Bench</span>',
          '<div itemprop="offers" itemscope itemtype="https://schema.org/Offer">',
          '<meta itemprop="price" content="2450.00">',
          '<meta itemprop="priceCurrency" content="GBP">',
          '<link itemprop="availability" href="https://schema.org/PreOrder">',
          '</div>',
        ].join(''),
      ),
    )

    expect(draft.priceText).toBe('2450.00')
    expect(draft.currencyText).toBe('GBP')
    expect(draft.availabilityText).toBe('https://schema.org/PreOrder')
    expect(draft.provenance.priceText).toBe('microdata')
  })

  it('does not let a nested item’s property leak up onto the product', async () => {
    // The whole of the microdata data model: an `itemprop` inside a nested `itemscope` belongs to
    // that nested item. Reading descendants flat would attach a related product's SKU to this one.
    const draft = await extract(
      item(
        [
          '<span itemprop="name">Bench</span>',
          '<div itemprop="isRelatedTo" itemscope itemtype="https://schema.org/Product">',
          '<meta itemprop="sku" content="ZZ-0000">',
          '</div>',
        ].join(''),
      ),
    )

    expect(field(draft, 'skuText')).toEqual({ value: null, confidence: 0, provenance: undefined })
  })

  it('resolves a relative image src and drops a data: placeholder', async () => {
    const draft = await extract(
      item(
        [
          '<span itemprop="name">Bench</span>',
          '<img itemprop="image" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="">',
          '<img itemprop="image" src="/img/bench-1.jpg" alt="">',
        ].join(''),
      ),
    )

    expect(draft.imageUrls).toEqual(['https://catalogue.example.com/img/bench-1.jpg'])
  })

  it('records the url a link element claims, unresolved', async () => {
    const draft = await extract(
      item('<span itemprop="name">Bench</span><link itemprop="url" href="/products/bench">'),
    )

    expect(draft.canonicalUrl).toBe('/products/bench')
  })

  it('prefers a time element’s datetime to its text', async () => {
    const draft = await extract(
      item(
        '<span itemprop="name">Bench</span><time itemprop="width" datetime="1200">1200 mm</time>',
      ),
    )

    expect(draft.dimensionTexts).toEqual(['1200'])
  })

  it('collapses the whitespace a template indented into an element', async () => {
    const draft = await extract(item('<h1 itemprop="name">\n   Bench\n   in ash\n  </h1>'))

    expect(draft.title).toBe('Bench in ash')
  })

  it('ignores an itemtype that is not a product', async () => {
    const draft = await extract(
      document(
        '<title>Fixture Page — Example Catalogue</title>',
        '<div itemscope itemtype="https://schema.org/Recipe"><span itemprop="name">Not A Product</span></div>',
      ),
    )

    expect(field(draft, 'title')).toEqual({
      value: 'Fixture Page — Example Catalogue',
      confidence: 1,
      provenance: 'title',
    })
  })

  it('loses every contested field to JSON-LD, which is read first', async () => {
    const body = document(
      [
        '<title>Fixture Page</title>',
        '<script type="application/ld+json">',
        JSON.stringify({ '@type': 'Product', name: 'From JSON-LD' }),
        '</script>',
      ].join(''),
      [
        '<main itemscope itemtype="https://schema.org/Product">',
        '<span itemprop="name">From Microdata</span>',
        '<meta itemprop="sku" content="EF-9012">',
        '</main>',
      ].join(''),
    )

    const draft = await extract(body)

    expect(field(draft, 'title')).toEqual({
      value: 'From JSON-LD',
      confidence: 1,
      provenance: 'jsonld',
    })
    // And the field JSON-LD said nothing about still comes from microdata: first hit wins PER
    // FIELD, not per strategy.
    expect(field(draft, 'skuText')).toEqual({
      value: 'EF-9012',
      confidence: 1,
      provenance: 'microdata',
    })
  })
})

describe('RDFa', () => {
  const typed = (inner: string): string =>
    document(
      '<title>Fixture Page — Example Catalogue</title>',
      `<div typeof="Product">${inner}</div>`,
    )

  it('reads a property into the field the vocabulary names', async () => {
    const draft = await extract(typed('<h1 property="name">Wall Console, Elm</h1>'))

    expect(field(draft, 'title')).toEqual({
      value: 'Wall Console, Elm',
      confidence: 1,
      provenance: 'rdfa',
    })
  })

  it('strips a prefix, so schema:name and name are one property', async () => {
    const draft = await extract(
      document(
        '<title>Fixture Page</title>',
        '<div typeof="schema:Product"><h1 property="schema:name">Wall Console, Elm</h1></div>',
      ),
    )

    expect(draft.provenance.title).toBe('rdfa')
    expect(draft.title).toBe('Wall Console, Elm')
  })

  it('prefers the content attribute to the text a person reads', async () => {
    // `<span property="price" content="1750.00">1,750</span>` — the display value is rounded and
    // the content attribute exists to say what the machine-readable one is.
    const draft = await extract(
      typed(
        [
          '<h1 property="name">Console</h1>',
          '<div property="offers" typeof="Offer">',
          '<span property="price" content="1750.00">1,750</span>',
          '</div>',
        ].join(''),
      ),
    )

    expect(draft.priceText).toBe('1750.00')
  })

  it('reads a nested Offer as a nested item', async () => {
    const draft = await extract(
      typed(
        [
          '<h1 property="name">Console</h1>',
          '<div property="offers" typeof="Offer">',
          '<meta property="priceCurrency" content="GBP">',
          '<link property="availability" href="https://schema.org/InStock">',
          '<span property="price">1750.00</span>',
          '</div>',
        ].join(''),
      ),
    )

    expect(draft.currencyText).toBe('GBP')
    expect(draft.availabilityText).toBe('https://schema.org/InStock')
  })

  it('loses to microdata, which is read before it', async () => {
    const draft = await extract(
      document(
        '<title>Fixture Page</title>',
        [
          '<main itemscope itemtype="https://schema.org/Product">',
          '<span itemprop="name">From Microdata</span></main>',
          '<div typeof="Product"><span property="name">From RDFa</span></div>',
        ].join(''),
      ),
    )

    expect(field(draft, 'title')).toEqual({
      value: 'From Microdata',
      confidence: 1,
      provenance: 'microdata',
    })
  })
})

describe('OpenGraph', () => {
  const share = (tags: readonly string[]): string =>
    document(
      ['<title>Fixture Page — Example Catalogue</title>', ...tags].join(''),
      '<h1>Fixture Page</h1>',
    )

  it('reads og:title, and beats the page’s own title element', async () => {
    const draft = await extract(
      share(['<meta property="og:title" content="Spindle Chair, Beech">']),
    )

    expect(field(draft, 'title')).toEqual({
      value: 'Spindle Chair, Beech',
      confidence: 1,
      provenance: 'opengraph',
    })
  })

  it('reads the price, its currency and the availability the share card declares', async () => {
    const draft = await extract(
      share([
        '<meta property="product:price:amount" content="640.00">',
        '<meta property="product:price:currency" content="GBP">',
        '<meta property="product:availability" content="in stock">',
      ]),
    )

    expect(draft.priceText).toBe('640.00')
    expect(draft.currencyText).toBe('GBP')
    expect(draft.availabilityText).toBe('in stock')
    expect(draft.provenance.priceText).toBe('opengraph')
    expect(draft.confidence.priceText).toBe(1)
  })

  it('accepts name= as well as property=, because half the web emits it that way', async () => {
    const draft = await extract(share(['<meta name="og:title" content="Spindle Chair, Beech">']))

    expect(draft.title).toBe('Spindle Chair, Beech')
  })

  it('collects every image key in document order and refuses a javascript: reference', async () => {
    const draft = await extract(
      share([
        '<meta property="og:image" content="https://images.example.com/one.jpg">',
        '<meta property="og:image" content="javascript:void(0)">',
        '<meta name="og:image:secure_url" content="/img/two.jpg">',
      ]),
    )

    expect(draft.imageUrls).toEqual([
      'https://images.example.com/one.jpg',
      'https://catalogue.example.com/img/two.jpg',
    ])
  })

  it('records og:url as the canonical claim and og:description as the description', async () => {
    const draft = await extract(
      share([
        '<meta property="og:url" content="https://catalogue.example.com/products/chair">',
        '<meta property="og:description" content="A spindle-backed chair.">',
      ]),
    )

    expect(draft.canonicalUrl).toBe('https://catalogue.example.com/products/chair')
    expect(draft.descriptionHtml).toBe('A spindle-backed chair.')
  })

  it('reads no SKU out of product:retailer_item_id, because that is a guess', async () => {
    const draft = await extract(
      share(['<meta property="product:retailer_item_id" content="MN-1357">']),
    )

    expect(field(draft, 'skuText')).toEqual({ value: null, confidence: 0, provenance: undefined })
  })

  it('ignores an ordinary meta description', async () => {
    const draft = await extract(share(['<meta name="description" content="Not the share card.">']))

    expect(draft.confidence.descriptionHtml).toBe(0)
  })

  it('loses to a schema.org spelling wherever both are present', async () => {
    const draft = await extract(
      document(
        [
          '<title>Fixture Page</title>',
          '<meta property="og:title" content="From OpenGraph">',
          '<script type="application/ld+json">',
          JSON.stringify({ '@type': 'Product', name: 'From JSON-LD' }),
          '</script>',
        ].join(''),
        '<h1>Fixture Page</h1>',
      ),
    )

    expect(field(draft, 'title')).toEqual({
      value: 'From JSON-LD',
      confidence: 1,
      provenance: 'jsonld',
    })
  })
})

describe('the source’s configured selectors', () => {
  const configured = readFixture('selectors-configured')

  it('reads the price the source was configured to read, under the selector provenance', async () => {
    const draft = await extract(configured, harness(CONFIGURED))

    expect(field(draft, 'priceText')).toEqual({
      value: '1,150.00',
      confidence: 1,
      provenance: 'selector',
    })
  })

  it('removes what the source’s strip pattern says to remove, and nothing else', async () => {
    const draft = await extract(configured, harness(CONFIGURED))

    expect(draft.skuText).toBe('IJ-7890')
  })

  it('reads every element a list-valued rule matches, in document order', async () => {
    const draft = await extract(configured, harness(CONFIGURED))

    expect(draft.dimensionTexts).toEqual(['W 1600 mm', 'D 700 mm', 'H 740 mm'])
    expect(draft.variantTexts).toEqual(['Oiled', 'Waxed'])
  })

  it('reads the first match only for a field that holds one value', async () => {
    const draft = await extract(configured, harness(CONFIGURED))

    expect(field(draft, 'leadTimeText')).toEqual({
      value: 'Dispatched in 6–8 weeks',
      confidence: 1,
      provenance: 'selector',
    })
  })

  it('reads the attribute an ATTRIBUTE rule names rather than the element’s text', async () => {
    const draft = await extract(configured, harness(CONFIGURED))

    expect(draft.customizationTexts).toEqual(['Made to any size'])
  })

  it('honours rule order, so the first rule for a key wins', async () => {
    const draft = await extract(
      configured,
      harness({
        attributeExtraction: [
          { key: 'lead_time', selector: '.lead-time', kind: 'TEXT' },
          { key: 'lead_time', selector: '.price', kind: 'TEXT' },
        ],
      }),
    )

    expect(draft.leadTimeText).toBe('Dispatched in 6–8 weeks')
  })

  it('reads a configured JSON-LD path, and still calls the provenance selector', async () => {
    const body = document(
      [
        '<title>Fixture Page</title>',
        '<script type="application/ld+json">',
        JSON.stringify({ '@type': 'Thing', name: 'Not a product', offers: { price: '99.00' } }),
        '</script>',
      ].join(''),
      '<h1>Fixture Page</h1>',
    )

    const draft = await extract(
      body,
      harness({
        priceExtraction: {
          strategy: 'JSONLD_PATH',
          jsonPath: 'offers.price',
          decimalSeparator: '.',
          thousandsSeparator: ',',
        },
      }),
    )

    // `PROVENANCE_STRATEGIES` has one entry for this strategy, because what provenance names is the
    // rule — the source's configuration — rather than the syntax it was written in.
    expect(field(draft, 'priceText')).toEqual({
      value: '99.00',
      confidence: 1,
      provenance: 'selector',
    })
  })

  it('loses to a published vocabulary, because a selector fails silently and structured data does not', async () => {
    const body = document(
      [
        '<title>Fixture Page</title>',
        '<script type="application/ld+json">',
        JSON.stringify({ '@type': 'Product', name: 'Desk', offers: { price: '1150.00' } }),
        '</script>',
      ].join(''),
      '<p class="price">SOMETHING ELSE ENTIRELY</p>',
    )

    const draft = await extract(body, harness(CONFIGURED))

    expect(field(draft, 'priceText')).toEqual({
      value: '1150.00',
      confidence: 1,
      provenance: 'jsonld',
    })
  })

  it('skips a configuration blob that is not what the schema says, and warns once', async () => {
    const harnessed = harness({ priceExtraction: { strategy: 'MAGIC' }, skuExtraction: null })
    const draft = await extract(configured, harnessed)

    expect(draft.confidence.priceText).toBe(0)
    expect(draft.confidence.skuText).toBe(0)
    expect(
      harnessed.warnings.filter((line) => line.includes('extraction configuration')),
    ).toHaveLength(2)
    // The rest of the page is still read: a rule nobody can parse is a rule nobody wrote, not a
    // failed item.
    expect(draft.provenance.title).toBe('title')
  })

  it('skips a selector the matcher cannot compile rather than throwing', async () => {
    const harnessed = harness({
      priceExtraction: {
        strategy: 'SELECTOR',
        selector: '::::not-a-selector(',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
    })

    const draft = await extract(configured, harnessed)

    expect(draft.confidence.priceText).toBe(0)
    expect(harnessed.warnings.join(' ')).toContain('configured selector')
  })

  it('refuses the whole sku configuration when its strip pattern will not compile', async () => {
    const harnessed = harness({
      skuExtraction: { strategy: 'SELECTOR', selector: '.sku', stripPattern: '([' },
    })
    const draft = await extract(configured, harnessed)

    // `skuExtractionSchema` COMPILES THE PATTERN AS PART OF PARSING, so an expression that will not
    // compile makes the whole configuration unreadable rather than making the strip a silent no-op.
    // The refusal happens at the trust boundary, which is where D1 puts it — and the alternative
    // would be a SKU carrying a prefix the source said to remove, looking exactly like a SKU.
    expect(field(draft, 'skuText')).toEqual({ value: null, confidence: 0, provenance: undefined })
    expect(harnessed.warnings.join(' ')).toContain('extraction configuration')
  })

  it('records no SKU at all when the strip pattern removes the whole value', async () => {
    const draft = await extract(
      configured,
      harness({ skuExtraction: { strategy: 'SELECTOR', selector: '.sku', stripPattern: '.*' } }),
    )

    // An empty value is not a hit — `withField` leaves the field alone and no provenance is
    // recorded, because attributing an absent value to a rule that "found" it is exactly the trail
    // provenance exists to keep honest.
    expect(field(draft, 'skuText')).toEqual({ value: null, confidence: 0, provenance: undefined })
  })
})

describe('the last resort', () => {
  it('takes the title element when nothing better exists', async () => {
    const draft = await extract(
      document('<title>Corner Shelf, Maple — Example Catalogue</title>', '<p>Nothing here.</p>'),
    )

    expect(field(draft, 'title')).toEqual({
      value: 'Corner Shelf, Maple — Example Catalogue',
      confidence: 1,
      provenance: 'title',
    })
  })

  it('does not split a site name off the title, because guessing the separator invents a fact', async () => {
    const draft = await extract(document('<title>A — B — C</title>', '<p>Nothing here.</p>'))

    expect(draft.title).toBe('A — B — C')
  })

  it('falls through to the first h1 when there is no title element', async () => {
    const draft = await extract(document('', '<h1>Corner Shelf, Maple</h1><h1>Second</h1>'))

    expect(field(draft, 'title')).toEqual({
      value: 'Corner Shelf, Maple',
      confidence: 1,
      provenance: 'h1',
    })
  })

  it('fills nothing but the title, whatever else the page says', async () => {
    const draft = await extract(
      document('<title>Corner Shelf</title>', '<h1>Corner Shelf</h1><p>£420</p>'),
    )

    for (const name of Object.keys(draft.confidence)) {
      expect(draft.confidence[name as DraftField]).toBe(name === 'title' ? 1 : 0)
    }
  })
})

describe('input this adapter cannot read', () => {
  it('answers an empty body with a draft rather than an exception', async () => {
    const draft = await extract('')

    expect(draft.provenance).toEqual({})
    expect(draft.title).toBeNull()
  })

  it('answers a page of binary with a draft', async () => {
    const draft = await extract(' <<<>>>�')

    expect(Object.values(draft.confidence).every((value) => value === 0)).toBe(true)
  })

  it('answers whitespace with a draft', async () => {
    expect((await extract('   \n\t  ')).confidence.title).toBe(0)
  })

  it('reads what it can out of unclosed tags', async () => {
    const draft = await extract(readFixture('malformed'))

    expect(field(draft, 'title')).toEqual({
      value: 'Rope Stool, Ash',
      confidence: 1,
      provenance: 'jsonld',
    })
  })

  it('never throws, whatever it is handed', async () => {
    const inputs = [
      '',
      '   ',
      '<',
      '<html',
      '<div itemscope itemtype="https://schema.org/Product"',
      '<script type="application/ld+json">null</script>',
      '<script type="application/ld+json">[[[</script>',
      ' '.repeat(64),
    ]

    for (const input of inputs) {
      await expect(genericAdapter.extract(harness().ctx, pageOf(input))).resolves.toBeDefined()
    }
  })

  it('produces a draft that satisfies its own schema even from rubbish', async () => {
    const draft = await extract('<<<>>><script type="application/ld+json">{,}</script>')

    // Every list field is an array and every text field is a string or null — the shape
    // `research_product_versions.raw` is written from.
    expect(Array.isArray(draft.imageUrls)).toBe(true)
    expect(draft.confidence.imageUrls).toBe(0)
  })
})

describe('the image extraction mode', () => {
  const withImage = document(
    [
      '<title>Fixture Page</title>',
      '<meta property="og:image" content="https://images.example.com/one.jpg">',
    ].join(''),
    '<h1>Fixture Page</h1>',
  )

  it('records image URLs when the source permits it', async () => {
    const draft = await extract(withImage, harness({ imageExtractionMode: 'URL_ONLY' }))

    expect(draft.imageUrls).toEqual(['https://images.example.com/one.jpg'])
  })

  it('treats URL_AND_DIMENSIONS the same way, because a draft holds no dimensions', async () => {
    const draft = await extract(withImage, harness({ imageExtractionMode: 'URL_AND_DIMENSIONS' }))

    expect(draft.imageUrls).toEqual(['https://images.example.com/one.jpg'])
  })

  it('records none at all when the source says NONE, and leaves no provenance behind', async () => {
    const draft = await extract(withImage, harness({ imageExtractionMode: 'NONE' }))

    expect(field(draft, 'imageUrls')).toEqual({ value: [], confidence: 0, provenance: undefined })
  })
})

describe('discovery', () => {
  const links = document(
    '<title>Fixture Page</title>',
    [
      '<a href="/products/one">One</a>',
      '<a href="/products/one#specifications">The same page</a>',
      '<a href="https://images.example.com/off-host">Off host</a>',
      '<a href="mailto:someone@example.com">Mail</a>',
      '<a href="/about">About</a>',
    ].join(''),
  )

  it('returns same-host http(s) URLs with the fragment stripped', async () => {
    const found = await genericAdapter.discover(harness().ctx, pageOf(links))

    expect(found.map((entry) => entry.url)).toEqual([
      'https://catalogue.example.com/products/one',
      'https://catalogue.example.com/about',
    ])
  })

  it('tags each URL with the matcher’s answer and never with an opinion of its own', async () => {
    const harnessed = harness()
    const found = await genericAdapter.discover(harnessed.ctx, pageOf(links))

    expect(found).toEqual([
      { url: 'https://catalogue.example.com/products/one', kind: 'PRODUCT' },
      { url: 'https://catalogue.example.com/about', kind: null },
    ])
    expect(harnessed.matched).toHaveLength(2)
  })

  it('answers a page with no links with an empty list', async () => {
    expect(await genericAdapter.discover(harness().ctx, pageOf('<p>Nothing.</p>'))).toEqual([])
  })
})

describe('the adapter’s own declaration', () => {
  it('answers supports() for http and https and refuses anything else', () => {
    expect(genericAdapter.supports({ baseUrl: 'https://catalogue.example.com' })).toBe(true)
    expect(genericAdapter.supports({ baseUrl: 'http://127.0.0.1:4321' })).toBe(true)
    expect(genericAdapter.supports({ baseUrl: 'ftp://catalogue.example.com' })).toBe(false)
    expect(genericAdapter.supports({ baseUrl: 'not a url at all' })).toBe(false)
    expect(genericAdapter.supports({ baseUrl: '' })).toBe(false)
  })

  it('is pure, and is called on every keystroke in the create drawer', () => {
    const source = { baseUrl: 'https://catalogue.example.com' }
    expect(genericAdapter.supports(source)).toBe(genericAdapter.supports(source))
  })

  it('claims DISCOVER and EXTRACT, and does not claim PAGINATE', () => {
    expect([...genericAdapter.capabilities]).toEqual(['DISCOVER', 'EXTRACT'])
  })

  it('agrees with the descriptor the Studio picker reads, key and version alike', () => {
    // The two registers hold separate objects on purpose — a picker that imported this adapter
    // would drag an HTML parser into a Client Component — so the agreement is asserted rather than
    // enforced by a shared constant.
    registerBuiltInAdapters()
    const descriptor = getAdapterDescriptor(GENERIC_ADAPTER_KEY)

    expect(genericAdapter.key).toBe(GENERIC_ADAPTER_KEY)
    expect(descriptor?.version).toBe(GENERIC_ADAPTER_VERSION)
    expect([...(descriptor?.capabilities ?? [])]).toEqual([...genericAdapter.capabilities])
  })
})

describe('the golden fixtures', () => {
  const cases = [
    { name: 'microdata-product', source: {} },
    { name: 'rdfa-product', source: {} },
    { name: 'opengraph-only', source: {} },
    { name: 'selectors-configured', source: CONFIGURED },
    { name: 'bare-title', source: {} },
  ] as const

  for (const { name, source } of cases) {
    it(`reads ${name}.html exactly as ${name}.expected.json says`, async () => {
      const draft = await genericAdapter.extract(
        harness(source).ctx,
        pageOf(readFixture(name), `https://catalogue.example.com/products/${name}`),
      )

      expect(draft).toEqual(readExpected(name))
    })
  }
})
