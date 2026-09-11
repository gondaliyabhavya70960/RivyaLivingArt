import { afterEach, describe, expect, it, vi } from 'vitest'

import type { GlobalContent } from '@/lib/supabase/schemas'

/**
 * The site graph — `Organization` and `WebSite` from the root layout — asserted mostly by what it
 * does NOT contain. Phase 39 moved it from the homepage to the layout; the rule is Phase 10's.
 */

const brandRow = (verification: GlobalContent['owner_verification']): GlobalContent =>
  ({
    id: '00000000-0000-4000-8000-000000000001',
    group_key: 'BRAND',
    key: 'brand.name',
    value: 'Rivya Living Art',
    is_enabled: true,
    owner_verification: verification,
  }) as GlobalContent

function mockSite(options: {
  strings: Map<string, string>
  brand: GlobalContent[]
  social?: GlobalContent[]
}) {
  vi.doMock('@/lib/site/chrome', () => ({
    getSiteChrome: async () => ({ strings: options.strings }),
  }))
  vi.doMock('@/lib/supabase/public', () => ({ createPublicClient: () => ({}) }))
  vi.doMock('@/lib/supabase/repositories/cms', () => ({
    listGlobalContent: async (_client: unknown, group: string) =>
      group === 'BRAND' ? options.brand : (options.social ?? []),
  }))
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('siteJsonLd', () => {
  it('returns nothing without a site URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    mockSite({
      strings: new Map([['BRAND.brand.name', 'Rivya Living Art']]),
      brand: [brandRow('NOT_REQUIRED')],
    })
    const { siteJsonLd } = await import('@/lib/seo/site-graph')
    expect(await siteJsonLd()).toBeNull()
  })

  it('returns nothing when the brand name has not been seeded', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.test')
    mockSite({ strings: new Map(), brand: [] })
    const { siteJsonLd } = await import('@/lib/seo/site-graph')
    expect(await siteJsonLd()).toBeNull()
  })

  it('builds both nodes from the brand row and the ORIGIN', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.test/some/path')
    mockSite({
      strings: new Map([['BRAND.brand.name', 'Rivya Living Art']]),
      brand: [brandRow('NOT_REQUIRED')],
    })
    const { siteJsonLd } = await import('@/lib/seo/site-graph')
    const graph = await siteJsonLd()
    const types = graph?.['@graph'].map((node) => (node as { '@type': string })['@type'])
    expect(types).toEqual(['Organization', 'WebSite'])
    const org = graph?.['@graph'][0] as { url: string; name: string }
    expect(org.url).toBe('https://example.test')
    expect(org.name).toBe('Rivya Living Art')
  })

  it('withholds the Organization while the brand row awaits verification, and keeps WebSite', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.test')
    mockSite({
      strings: new Map([['BRAND.brand.name', 'Rivya Living Art']]),
      brand: [brandRow('OWNER_VERIFICATION_REQUIRED')],
    })
    const { siteJsonLd } = await import('@/lib/seo/site-graph')
    const graph = await siteJsonLd()
    expect(graph?.['@graph'].map((node) => (node as { '@type': string })['@type'])).toEqual([
      'WebSite',
    ])
  })

  it('names no fact the owner has not supplied', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.test')
    mockSite({
      strings: new Map([['BRAND.brand.name', 'Rivya Living Art']]),
      brand: [brandRow('VERIFIED')],
    })
    const { siteJsonLd } = await import('@/lib/seo/site-graph')
    const { forbiddenKeysIn } = await import('@/lib/seo/jsonld')
    const graph = await siteJsonLd()
    expect(forbiddenKeysIn(graph)).toEqual([])
    for (const key of ['founder', 'sameAs', 'logo', 'offers'])
      expect(JSON.stringify(graph)).not.toContain(key)
  })
})
