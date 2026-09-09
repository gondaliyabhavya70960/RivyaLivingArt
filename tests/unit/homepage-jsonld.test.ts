import { afterEach, describe, expect, it, vi } from 'vitest'

import { serialiseJsonLd, type JsonLdGraph } from '@/lib/seo/jsonld'

/**
 * The homepage's structured data, asserted mostly by what it does NOT contain.
 *
 * STRUCTURED DATA IS THE WORST PLACE TO FABRICATE A BUSINESS FACT. A search engine reads it as the
 * business's own assertion, renders it in a result, and keeps rendering it long after the page has
 * changed. D10 forbids inventing a fact anywhere; a `foundingDate` or an `aggregateRating` here
 * would be inventing one in a format designed to be trusted and republished.
 *
 * `homepageJsonLd()` ITSELF READS THE DATABASE, so what is unit-tested here is the graph's shape
 * and its serialisation. The end-to-end assertion — exactly one `application/ld+json` block on
 * `/`, with no forbidden key in it — is `tests/e2e/homepage.spec.ts`, against a real page.
 */

const GRAPH: JsonLdGraph = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', name: 'Rivya Living Art', url: 'https://example.test' },
    { '@type': 'Organization', name: 'Rivya Living Art', url: 'https://example.test' },
  ],
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('the graph', () => {
  it('carries a name and a URL and nothing else', () => {
    for (const node of GRAPH['@graph']) {
      expect(Object.keys(node).sort()).toEqual(['@type', 'name', 'url'])
    }
  })

  it('names no fact the owner has not supplied', () => {
    const forbidden = [
      'aggregateRating',
      'review',
      'award',
      'founder',
      'foundingDate',
      'address',
      'telephone',
      'sameAs',
      'priceRange',
      'openingHours',
      'offers',
      'logo',
    ]
    const serialised = serialiseJsonLd(GRAPH)
    for (const key of forbidden) expect(serialised).not.toContain(key)
  })
})

describe('serialiseJsonLd', () => {
  it('escapes a sequence that would close the script element', () => {
    // The brand name is a `global_content` row somebody can type into, and `</script>` ends a
    // script block wherever it appears — including inside a JSON string.
    const hostile: JsonLdGraph = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Organization', name: 'Rivya</script><script>x', url: 'https://example.test' },
      ],
    }

    const serialised = serialiseJsonLd(hostile)

    expect(serialised).not.toContain('</script>')
    expect(serialised).toContain('\\u003c/script')
    // Still valid JSON, and still the same value once parsed: the escape is a JSON escape, not a
    // mangling of the content.
    expect(JSON.parse(serialised)['@graph'][0].name).toBe('Rivya</script><script>x')
  })
})

describe('homepageJsonLd', () => {
  it('returns nothing without a site URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    vi.doMock('@/lib/site/chrome', () => ({
      getSiteChrome: async () => ({ strings: new Map([['BRAND.brand.name', 'Rivya Living Art']]) }),
    }))

    const { homepageJsonLd } = await import('@/lib/seo/jsonld')

    // Not a graph with a guessed origin, and not a graph with the URL left out: an identity we
    // cannot state is one we do not publish.
    expect(await homepageJsonLd()).toBeNull()
  })

  it('returns nothing when the brand name has not been seeded', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.test')
    vi.doMock('@/lib/site/chrome', () => ({
      getSiteChrome: async () => ({ strings: new Map() }),
    }))

    const { homepageJsonLd } = await import('@/lib/seo/jsonld')

    expect(await homepageJsonLd()).toBeNull()
  })

  it('builds both nodes from the brand row and the origin', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.test/some/path')
    vi.doMock('@/lib/site/chrome', () => ({
      getSiteChrome: async () => ({ strings: new Map([['BRAND.brand.name', 'Rivya Living Art']]) }),
    }))

    const { homepageJsonLd } = await import('@/lib/seo/jsonld')
    const graph = await homepageJsonLd()

    expect(graph?.['@graph'].map((node) => node['@type'])).toEqual(['WebSite', 'Organization'])
    // The ORIGIN, not the configured string: whatever path the environment variable carries, the
    // site's identity is its origin.
    expect(graph?.['@graph'][0]?.url).toBe('https://example.test')
    expect(graph?.['@graph'][0]?.name).toBe('Rivya Living Art')
  })
})
