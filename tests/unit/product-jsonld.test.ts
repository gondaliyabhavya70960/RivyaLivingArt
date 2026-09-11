import { describe, expect, it } from 'vitest'

import { productImageUrls, productJsonLd } from '@/lib/seo/jsonld/product'
import type { Category, MediaAsset, Product } from '@/lib/supabase/schemas'

/**
 * The `Product` node, and the price it must never publish.
 *
 * A visitor reading "Price on request" understands the wording. A crawler reading `offers` does
 * not — it reads a commitment. Three of the four price states carry no number, so `offers` must be
 * absent for all three, and absent as a MISSING KEY rather than a null: a consumer treats
 * `"offers": null` as malformed, not as an absence.
 */

const BASE = {
  id: '00000000-0000-4000-8000-000000000001',
  slug: 'wave-table',
  sku: null,
  title: 'Wave Table',
  subtitle: null,
  summary: null,
  description: null,
  category_id: null,
  price_state: 'REQUEST_QUOTE',
  price_from_minor: null,
  price_minor: null,
  currency: null,
  availability_state: null,
  edition_state: null,
  edition_size: null,
  is_customizable: false,
  sort_order: null,
  is_large_format: false,
  dimensions: null,
  hero_media_id: null,
  model_media_id: null,
  seo_title: null,
  seo_description: null,
  publication_readiness: {},
} as unknown as Product

const product = (overrides: Partial<Product> = {}): Product => ({ ...BASE, ...overrides })

const input = (overrides: Partial<Product> = {}, extra = {}) => ({
  product: product(overrides),
  url: 'https://rivya.example/product/wave-table',
  brandName: 'Rivya Living Art',
  category: null,
  imageUrls: [],
  formatAmount: (minor: number) => (minor / 100).toFixed(2),
  ...extra,
})

describe('productJsonLd — offers', () => {
  it('omits offers for REQUEST_QUOTE', () => {
    const node = productJsonLd(input({ price_state: 'REQUEST_QUOTE' }))
    expect(node).not.toBeNull()
    expect(node).not.toHaveProperty('offers')
  })

  it('omits offers for PRICE_ON_REQUEST', () => {
    expect(productJsonLd(input({ price_state: 'PRICE_ON_REQUEST' }))).not.toHaveProperty('offers')
  })

  it('omits offers for STARTING_FROM, which carries a floor rather than a price', () => {
    const node = productJsonLd(
      input({ price_state: 'STARTING_FROM', price_from_minor: 1_250_000, currency: 'INR' }),
    )
    expect(node).not.toHaveProperty('offers')
    // And nothing anywhere in the node repeats the floor as if it were the price.
    expect(JSON.stringify(node)).not.toContain('12500')
  })

  it('emits offers for FIXED and VERIFIED, with the amount and its currency', () => {
    const node = productJsonLd(
      input({
        price_state: 'FIXED',
        price_minor: 1_250_000,
        currency: 'INR',
        owner_verification: 'VERIFIED',
      }),
    )
    expect(node?.offers).toEqual({ '@type': 'Offer', price: '12500.00', priceCurrency: 'INR' })
  })

  it('omits offers for a FIXED row the owner has not verified (Phase 39)', () => {
    const node = productJsonLd(
      input({ price_state: 'FIXED', price_minor: 1_250_000, currency: 'INR' }),
    )
    expect(node).not.toHaveProperty('offers')
  })

  it('omits offers for a FIXED row with no currency — half an offer is worse than none', () => {
    const node = productJsonLd(
      input({ price_state: 'FIXED', price_minor: 1_250_000, owner_verification: 'VERIFIED' }),
    )
    expect(node).not.toHaveProperty('offers')
  })

  it('omits offers when the formatter cannot express the amount', () => {
    const node = productJsonLd(
      input(
        {
          price_state: 'FIXED',
          price_minor: 1_250_000,
          currency: 'ZZZ',
          owner_verification: 'VERIFIED',
        },
        {
          formatAmount: () => null,
        },
      ),
    )
    expect(node).not.toHaveProperty('offers')
  })
})

describe('productJsonLd — what it never emits', () => {
  it('has no aggregateRating and no review, for any state', () => {
    for (const state of ['FIXED', 'STARTING_FROM', 'REQUEST_QUOTE', 'PRICE_ON_REQUEST'] as const) {
      const node = productJsonLd(
        input({ price_state: state, price_minor: 1_000, currency: 'INR', price_from_minor: 1_000 }),
      )
      const json = JSON.stringify(node)
      expect(json).not.toContain('aggregateRating')
      expect(json).not.toContain('review')
      expect(json).not.toContain('ratingValue')
    }
  })

  it('has no availability key — schema.org has no vocabulary for made-to-order', () => {
    const node = productJsonLd(input({ availability_state: 'READY_STOCK' }))
    expect(JSON.stringify(node)).not.toContain('availability')
  })

  it('omits an absent sku rather than emitting null', () => {
    const node = productJsonLd(input({ sku: null }))
    expect(node).not.toHaveProperty('sku')
    expect(JSON.stringify(node)).not.toContain('null')
  })

  it('returns null for a product with no name', () => {
    expect(productJsonLd(input({ title: null }))).toBeNull()
    expect(productJsonLd(input({ title: '   ' }))).toBeNull()
  })
})

describe('productJsonLd — the optional keys', () => {
  it('includes description, category, sku and brand when they exist', () => {
    const category = { id: 'c1', name: 'Furniture' } as unknown as Category
    const node = productJsonLd(
      input(
        { description: 'A cast resin dining table.', sku: 'RV-001' },
        {
          category,
          imageUrls: ['https://cdn.example/a.jpg'],
        },
      ),
    )
    expect(node?.description).toBe('A cast resin dining table.')
    expect(node?.category).toBe('Furniture')
    expect(node?.sku).toBe('RV-001')
    expect(node?.brand).toEqual({ '@type': 'Brand', name: 'Rivya Living Art' })
    expect(node?.image).toEqual(['https://cdn.example/a.jpg'])
  })

  it('omits brand when the CMS has no brand row', () => {
    expect(productJsonLd(input({}, { brandName: null }))).not.toHaveProperty('brand')
  })

  it('omits image when there are none', () => {
    expect(productJsonLd(input())).not.toHaveProperty('image')
  })
})

describe('productImageUrls', () => {
  const asset = (id: string) => ({ id, public_id: id }) as unknown as MediaAsset
  const toUrl = (a: MediaAsset) => `https://cdn.example/${a.public_id}.jpg`

  it('puts the hero first and does not repeat it from the gallery', () => {
    const urls = productImageUrls(asset('hero'), [asset('hero'), asset('b')], toUrl)
    expect(urls).toEqual(['https://cdn.example/hero.jpg', 'https://cdn.example/b.jpg'])
  })

  it('works with no hero', () => {
    expect(productImageUrls(null, [asset('b')], toUrl)).toEqual(['https://cdn.example/b.jpg'])
  })

  it('drops assets with no URL rather than emitting a gap', () => {
    expect(
      productImageUrls(null, [asset('a'), asset('b')], (a) => (a.id === 'a' ? null : 'u')),
    ).toEqual(['u'])
  })

  it('is empty when there is nothing, so the caller omits the key', () => {
    expect(productImageUrls(null, [], toUrl)).toEqual([])
  })
})
