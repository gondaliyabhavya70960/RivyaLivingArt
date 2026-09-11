import { describe, expect, it } from 'vitest'

import {
  FORBIDDEN_KEYS,
  FORBIDDEN_TYPES,
  articleJsonLd,
  breadcrumbJsonLd,
  collectionJsonLd,
  contactPointJsonLd,
  faqPageJsonLd,
  forbiddenKeysIn,
  organizationJsonLd,
  productJsonLd,
  verifiedOnly,
  webSiteJsonLd,
} from '@/lib/seo/jsonld'
import type { Collection, JournalArticle, Product } from '@/lib/supabase/schemas'

import {
  FORBIDDEN_KEYS as SCRIPT_KEYS,
  FORBIDDEN_TYPES as SCRIPT_TYPES,
  forbiddenIn,
} from '../../scripts/seo/validate-jsonld.mjs'

/**
 * The verification gate as code — Phase 39, the risk table's first row.
 *
 * EVERY BUILDER IS FED AN OWNER_VERIFICATION_REQUIRED FIXTURE and the output — where there is one —
 * is scanned for the forbidden-key list. The point is not that the builders are polite today; it
 * is that no branch exists that could emit `aggregateRating`, `telephone` outside ContactPoint,
 * `foundingDate` or an `Offer` for an unverified price, whatever a future edit passes in.
 */

const REQUIRED = 'OWNER_VERIFICATION_REQUIRED' as const

const product = (overrides: Partial<Product> = {}): Product =>
  ({
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'wave-table',
    sku: 'RLA-001',
    title: 'Wave Table',
    description: 'A table.',
    status: 'PUBLISHED',
    owner_verification: REQUIRED,
    price_state: 'FIXED',
    price_minor: 1_250_000,
    currency: 'INR',
    ...overrides,
  }) as unknown as Product

describe('verifiedOnly', () => {
  it('withholds a value whose row awaits verification and passes the other two states', () => {
    expect(verifiedOnly('x', 'OWNER_VERIFICATION_REQUIRED')).toBeUndefined()
    expect(verifiedOnly('x', 'NOT_REQUIRED')).toBe('x')
    expect(verifiedOnly('x', 'VERIFIED')).toBe('x')
  })
})

describe('every builder, fed an unverified fixture', () => {
  const outputs: Record<string, object | null> = {
    Organization: organizationJsonLd({
      name: 'Rivya',
      verification: REQUIRED,
      url: 'https://rivya.example',
      logoUrl: 'https://cdn.example/logo.png',
    }),
    WebSite: webSiteJsonLd({ name: 'Rivya', url: 'https://rivya.example', searchPath: '/search' }),
    BreadcrumbList: breadcrumbJsonLd([
      { name: 'Rivya', url: 'https://rivya.example/' },
      { name: 'Wave', url: 'https://rivya.example/product/wave' },
    ]),
    Product: productJsonLd({
      product: product(),
      url: 'https://rivya.example/product/wave-table',
      brandName: 'Rivya',
      category: null,
      imageUrls: [],
      materialNames: ['Walnut'],
      formatAmount: (minor) => (minor / 100).toFixed(2),
    }),
    CollectionPage: collectionJsonLd(
      {
        name: 'Winter',
        statement: 'x',
        status: 'PUBLISHED',
        owner_verification: REQUIRED,
      } as unknown as Collection,
      'https://rivya.example/collections/winter',
      null,
    ),
    Article: articleJsonLd(
      {
        title: 'Post',
        byline: 'A Person',
        owner_verification: REQUIRED,
        status: 'PUBLISHED',
        excerpt: null,
        published_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      } as unknown as JournalArticle,
      {
        url: 'https://rivya.example/journal/post',
        organisationName: 'Rivya',
        imageUrl: null,
        categoryName: null,
      },
    ),
    FAQPage: faqPageJsonLd([
      {
        question: 'Lead time?',
        answer: 'Six weeks.',
        owner_verification: REQUIRED,
        status: 'PUBLISHED',
      },
    ]),
    ContactPoint: contactPointJsonLd({ verified: false, email: 'a@b.c', phone: '+91', url: null }),
  }

  it('produces no forbidden key or type anywhere', () => {
    for (const [type, output] of Object.entries(outputs)) {
      expect(forbiddenKeysIn(output), type).toEqual([])
    }
  })

  it('withholds what the gate withholds', () => {
    expect(outputs['Organization']).toBeNull()
    expect(outputs['FAQPage']).toBeNull()
    expect(outputs['ContactPoint']).toBeNull()
    expect(outputs['Product']).not.toHaveProperty('offers')
    expect((outputs['Article'] as { author: { '@type': string } }).author['@type']).toBe(
      'Organization',
    )
  })

  it('emits the offer only for FIXED and VERIFIED', () => {
    const verified = productJsonLd({
      product: product({ owner_verification: 'VERIFIED' }),
      url: 'u',
      brandName: null,
      category: null,
      imageUrls: [],
      formatAmount: (minor) => (minor / 100).toFixed(2),
    })
    expect(verified?.offers).toEqual({ '@type': 'Offer', price: '12500.00', priceCurrency: 'INR' })
    for (const state of ['STARTING_FROM', 'REQUEST_QUOTE', 'PRICE_ON_REQUEST'] as const) {
      const node = productJsonLd({
        product: product({ owner_verification: 'VERIFIED', price_state: state }),
        url: 'u',
        brandName: null,
        category: null,
        imageUrls: [],
        formatAmount: () => '1',
      })
      expect(node, state).not.toHaveProperty('offers')
    }
  })

  it('emits material only from the joined rows, and never a gtin or mpn', () => {
    const node = productJsonLd({
      product: product({ owner_verification: 'VERIFIED' }),
      url: 'u',
      brandName: null,
      category: null,
      imageUrls: [],
      materialNames: ['Walnut', ' '],
      formatAmount: () => '1',
    })
    expect(node?.material).toEqual(['Walnut'])
    expect(JSON.stringify(node)).not.toMatch(/gtin|mpn/)
  })
})

describe('forbiddenKeysIn', () => {
  it('finds a forbidden key at any depth and a forbidden type', () => {
    const found = forbiddenKeysIn({
      '@type': 'Product',
      offers: { '@type': 'Offer', shippingDetails: {} },
      nested: [{ '@type': 'AggregateRating' }],
    })
    expect(found).toContain('$.offers.shippingDetails')
    expect(found).toContain('$.nested[0].@type=AggregateRating')
  })

  it('exempts telephone on a ContactPoint and nowhere else', () => {
    expect(forbiddenKeysIn({ '@type': 'ContactPoint', telephone: '+91' })).toEqual([])
    expect(forbiddenKeysIn({ '@type': 'Organization', telephone: '+91' })).toEqual(['$.telephone'])
  })
})

describe('the build-time validator agrees with the guard', () => {
  it('carries the same forbidden lists', () => {
    expect([...SCRIPT_KEYS].sort()).toEqual([...FORBIDDEN_KEYS].sort())
    expect([...SCRIPT_TYPES].sort()).toEqual([...FORBIDDEN_TYPES].sort())
  })
  it('finds the same things', () => {
    const graph = { '@graph': [{ '@type': 'LocalBusiness', award: 'x' }] }
    expect(forbiddenIn(graph).length).toBe(forbiddenKeysIn(graph).length)
  })
  it('additionally refuses an Offer with no price', () => {
    expect(forbiddenIn({ '@type': 'Offer', priceCurrency: 'INR' })).toContain(
      '$.Offer-without-price',
    )
  })
})
