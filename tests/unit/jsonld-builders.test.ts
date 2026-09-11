import { describe, expect, it } from 'vitest'

import {
  breadcrumbJsonLd,
  contactPointJsonLd,
  faqPageJsonLd,
  graphOf,
  organizationJsonLd,
  serialiseJsonLd,
  webSiteJsonLd,
} from '@/lib/seo/jsonld'

/**
 * What each Phase 39 builder emits when its gate is OPEN — the positive half of jsonld-guard.
 */
describe('organizationJsonLd', () => {
  it('carries name, url and @id, and only logo / sameAs when supplied', () => {
    const node = organizationJsonLd({
      name: 'Rivya',
      verification: 'NOT_REQUIRED',
      url: 'https://r.example',
    })
    expect(node).toEqual({
      '@type': 'Organization',
      '@id': 'https://r.example/#organization',
      name: 'Rivya',
      url: 'https://r.example',
    })
  })
  it('keeps only URL-shaped sameAs entries', () => {
    const node = organizationJsonLd({
      name: 'Rivya',
      verification: 'VERIFIED',
      url: 'https://r.example',
      sameAs: ['https://instagram.com/rivya', 'not a url', ''],
    })
    expect(node?.sameAs).toEqual(['https://instagram.com/rivya'])
  })
  it('is null without a name or an origin', () => {
    expect(
      organizationJsonLd({ name: null, verification: 'VERIFIED', url: 'https://r.example' }),
    ).toBeNull()
    expect(organizationJsonLd({ name: 'Rivya', verification: 'VERIFIED', url: null })).toBeNull()
  })
})

describe('webSiteJsonLd', () => {
  it('carries the one SearchAction the site offers', () => {
    const node = webSiteJsonLd({
      name: 'Rivya',
      url: 'https://r.example',
      searchPath: '/search',
      hasOrganization: true,
    })
    expect(node?.potentialAction?.target.urlTemplate).toBe(
      'https://r.example/search?q={search_term_string}',
    )
    expect(node?.publisher).toEqual({ '@id': 'https://r.example/#organization' })
    expect(node).not.toHaveProperty('alternateName')
  })
  it('has no SearchAction without a search path', () => {
    expect(webSiteJsonLd({ name: 'Rivya', url: 'https://r.example' })).not.toHaveProperty(
      'potentialAction',
    )
  })
})

describe('breadcrumbJsonLd', () => {
  it('numbers the positions from 1', () => {
    const node = breadcrumbJsonLd([
      { name: 'Home', url: 'https://r.example/' },
      { name: 'Journal', url: 'https://r.example/journal' },
      { name: 'Post', url: 'https://r.example/journal/post' },
    ])
    expect(node?.itemListElement.map((i) => i.position)).toEqual([1, 2, 3])
  })
  it('drops a crumb with no name or a relative url, and is null below two', () => {
    expect(
      breadcrumbJsonLd([
        { name: 'Home', url: 'https://r.example/' },
        { name: null, url: 'https://r.example/x' },
      ]),
    ).toBeNull()
    expect(
      breadcrumbJsonLd([
        { name: 'Home', url: 'https://r.example/' },
        { name: 'X', url: '/x' },
      ]),
    ).toBeNull()
  })
})

describe('faqPageJsonLd', () => {
  it('keeps VERIFIED and PUBLISHED rows only', () => {
    const node = faqPageJsonLd([
      { question: 'A?', answer: 'a', owner_verification: 'VERIFIED', status: 'PUBLISHED' },
      { question: 'B?', answer: 'b', owner_verification: 'VERIFIED', status: 'DRAFT' },
      { question: 'C?', answer: 'c', owner_verification: 'NOT_REQUIRED', status: 'PUBLISHED' },
    ])
    expect(node?.mainEntity.map((q) => q.name)).toEqual(['A?'])
  })
})

describe('contactPointJsonLd', () => {
  it('emits what the verified section holds and nothing else', () => {
    const node = contactPointJsonLd({
      verified: true,
      email: 'hello@r.example',
      phone: null,
      url: 'https://r.example/contact',
    })
    expect(node).toEqual({
      '@type': 'ContactPoint',
      email: 'hello@r.example',
      url: 'https://r.example/contact',
    })
  })
  it('is null when verified but empty', () => {
    expect(contactPointJsonLd({ verified: true, email: null, phone: null, url: null })).toBeNull()
  })
})

describe('graphOf and serialiseJsonLd', () => {
  it('drops nulls and is null when nothing survived', () => {
    expect(graphOf([null, undefined])).toBeNull()
    expect(graphOf([null, { '@type': 'WebSite' }])).toEqual({
      '@context': 'https://schema.org',
      '@graph': [{ '@type': 'WebSite' }],
    })
  })
  it('escapes a sequence that would close the script element', () => {
    const out = serialiseJsonLd({ name: '</script><script>alert(1)</script>' })
    expect(out).not.toContain('</script>')
    expect(JSON.parse(out)).toEqual({ name: '</script><script>alert(1)</script>' })
  })
})
