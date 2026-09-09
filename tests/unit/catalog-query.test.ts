import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SORT,
  EMPTY_CATALOG_QUERY,
  PAGE_SIZE,
  canonicalCatalogUrl,
  catalogUrl,
  hasActiveFilters,
  parseCatalogQuery,
  toggleCatalogValue,
} from '@/lib/catalog/query'

/**
 * The listing query: what a URL means, and what it must never mean.
 *
 * THE PARSER IS A TRUST BOUNDARY. Everything it returns goes into a database filter, a canonical
 * link and a set of checkbox states, so every case below is either "this is what the URL says" or
 * "this is what the URL cannot be allowed to say".
 *
 * THE CANONICAL URL IS THE OTHER HALF. A parser that quietly drops a bad value while the canonical
 * link still carries it has not dropped it — it has minted an indexable variant of the same page.
 * Each drop is therefore asserted twice: once in the parsed query, once in the URL.
 */

const BASE = '/collection/furniture'

describe('parseCatalogQuery', () => {
  it('returns the empty query for no parameters', () => {
    expect(parseCatalogQuery({})).toEqual(EMPTY_CATALOG_QUERY)
  })

  it('reads a comma-separated list and a repeated parameter the same way', () => {
    const comma = parseCatalogQuery({ material: 'oak,resin' })
    const repeated = parseCatalogQuery({ material: ['oak', 'resin'] })
    expect(comma.material).toEqual(['oak', 'resin'])
    expect(repeated.material).toEqual(comma.material)
  })

  it('de-duplicates and sorts, so two spellings of one filter are one page', () => {
    expect(parseCatalogQuery({ material: 'resin,oak,resin' }).material).toEqual(['oak', 'resin'])
    expect(canonicalCatalogUrl(BASE, parseCatalogQuery({ material: 'resin,oak' }))).toBe(
      canonicalCatalogUrl(BASE, parseCatalogQuery({ material: 'oak,resin' })),
    )
  })

  it('drops a value that is not a price state and keeps the ones that are', () => {
    const query = parseCatalogQuery({ price: 'FIXED,banana,REQUEST_QUOTE' })
    expect(query.price).toEqual(['FIXED', 'REQUEST_QUOTE'])
    expect(canonicalCatalogUrl(BASE, query)).toBe(`${BASE}?price=FIXED%2CREQUEST_QUOTE`)
  })

  it('drops a slug that is not slug-shaped', () => {
    expect(parseCatalogQuery({ material: 'Oak Table,../etc,oak' }).material).toEqual(['oak'])
  })

  it('drops an unknown sort and falls back to the default, without it in the URL', () => {
    const query = parseCatalogQuery({ sort: 'price' })
    expect(query.sort).toBe(DEFAULT_SORT)
    expect(canonicalCatalogUrl(BASE, query)).toBe(BASE)
  })

  it('has no price sort to fall back FROM — the option does not exist', () => {
    // Three of the four price states carry no number, so an ordering across them would have to
    // invent a position for "Request a Quote". Deliberate, and recorded in BUSINESS_RULES.md.
    expect(parseCatalogQuery({ sort: 'price' }).sort).not.toBe('price')
  })

  it('drops a page that is zero, negative or not a number', () => {
    for (const page of ['0', '-4', 'two', '1.5', '']) {
      expect(parseCatalogQuery({ page }).page, page).toBe(1)
    }
  })

  it('reads the scale and customizable toggles only on their exact values', () => {
    expect(parseCatalogQuery({ scale: 'large-format' }).largeFormat).toBe(true)
    expect(parseCatalogQuery({ scale: 'huge' }).largeFormat).toBe(false)
    expect(parseCatalogQuery({ customizable: '1' }).customizable).toBe(true)
    expect(parseCatalogQuery({ customizable: 'true' }).customizable).toBe(false)
  })
})

describe('canonicalCatalogUrl', () => {
  it('omits both defaults, so one result set has one address', () => {
    const query = parseCatalogQuery({ sort: 'curated', page: '1' })
    expect(canonicalCatalogUrl(BASE, query)).toBe(BASE)
  })

  it('emits the parameters in a fixed order regardless of how they arrived', () => {
    const first = parseCatalogQuery({ page: '2', sort: 'title', material: 'oak' })
    const second = parseCatalogQuery({ material: 'oak', page: '2', sort: 'title' })
    expect(canonicalCatalogUrl(BASE, first)).toBe(canonicalCatalogUrl(BASE, second))
    expect(canonicalCatalogUrl(BASE, first)).toBe(`${BASE}?material=oak&sort=title&page=2`)
  })
})

describe('catalogUrl', () => {
  it('returns to page 1 when a filter changes', () => {
    const query = parseCatalogQuery({ page: '3' })
    expect(catalogUrl(BASE, query, { material: ['oak'] })).toBe(`${BASE}?material=oak`)
  })

  it('keeps the page when the page is what changed', () => {
    const query = parseCatalogQuery({ material: 'oak', page: '3' })
    expect(catalogUrl(BASE, query, { page: 2 })).toBe(`${BASE}?material=oak&page=2`)
  })

  it('changes nothing when asked to change nothing', () => {
    const query = parseCatalogQuery({ material: 'oak', page: '3' })
    expect(catalogUrl(BASE, query)).toBe(canonicalCatalogUrl(BASE, query))
  })
})

describe('toggleCatalogValue', () => {
  it('adds, removes and always returns to page 1', () => {
    const start = parseCatalogQuery({ page: '4' })
    const added = toggleCatalogValue(start, 'material', 'oak')
    expect(added.material).toEqual(['oak'])
    expect(added.page).toBe(1)
    expect(toggleCatalogValue(added, 'material', 'oak').material).toEqual([])
  })
})

describe('hasActiveFilters', () => {
  it('is false for sort and page alone — neither narrows anything', () => {
    expect(hasActiveFilters(parseCatalogQuery({ sort: 'title', page: '3' }))).toBe(false)
  })

  it('is true for every filtering dimension', () => {
    const cases = [
      { material: 'oak' },
      { price: 'FIXED' },
      { availability: 'READY_STOCK' },
      { edition: 'ONE_OF_ONE' },
      { scale: 'large-format' },
      { customizable: '1' },
      { collection: 'winter' },
    ]
    for (const raw of cases) {
      expect(hasActiveFilters(parseCatalogQuery(raw)), JSON.stringify(raw)).toBe(true)
    }
  })
})

describe('PAGE_SIZE', () => {
  it('is 24 — divisible by the 2-, 3- and 4-column grids the listing uses', () => {
    expect(PAGE_SIZE).toBe(24)
    for (const columns of [2, 3, 4]) expect(PAGE_SIZE % columns).toBe(0)
  })
})
