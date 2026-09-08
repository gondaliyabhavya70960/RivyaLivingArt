import { beforeEach, describe, expect, it, vi } from 'vitest'

import { siteStrings } from '@/lib/cms/strings'
import type { GlobalContent, SeoEntry } from '@/lib/supabase/schemas'

/**
 * The SEED §41 fallback chain: the path's own entry, then the single GLOBAL entry, then the
 * `SEO_DEFAULT` strings, and only then nothing.
 *
 * WHY THIS IS MOCKED RATHER THAN RUN AGAINST THE DATABASE. The rule being tested is the ORDER of
 * preference and what happens when a step is missing, and every interesting case is a state the
 * seeded database is not in: all eight per-path entries are DRAFT today, so a live read exercises
 * exactly one branch of four. Mocks let each rung of the chain be removed on purpose.
 *
 * THE `noindex` RULE IS THE ONE WITH TEETH. A page with no published sections must never be
 * indexable, whatever its row says — `renderCmsPage` already answers such a path with a 404, and
 * this stops a crawler keeping it if it saw the page in a window where it briefly resolved.
 */

const chrome = { strings: siteStrings([]) }

vi.mock('@/lib/site/chrome', () => ({ getSiteChrome: () => Promise.resolve(chrome) }))
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => ({}) }))
vi.mock('@/lib/supabase/repositories/media', () => ({
  listMediaAssetsByIds: () => Promise.resolve(new Map()),
}))

const repo = vi.hoisted(() => ({
  path: null as SeoEntry | null,
  global: null as SeoEntry | null,
}))

vi.mock('@/lib/supabase/repositories/cms', () => ({
  getSeoEntryByPath: () => Promise.resolve(repo.path),
  getGlobalSeoEntry: () => Promise.resolve(repo.global),
}))

const { buildPageMetadata } = await import('@/lib/seo/metadata')

function entry(partial: Partial<SeoEntry>): SeoEntry {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    scope: 'PATH',
    path: null,
    entity_type: null,
    entity_id: null,
    title: null,
    description: null,
    social_title: null,
    social_description: null,
    og_media_id: null,
    canonical_url: null,
    robots: null,
    ...partial,
  } as SeoEntry
}

function strings(pairs: Record<string, string>) {
  const rows = Object.entries(pairs).map(
    ([dotted, value], index) =>
      ({
        id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        group_key: dotted.slice(0, dotted.indexOf('.')),
        key: dotted.slice(dotted.indexOf('.') + 1),
        value,
        is_enabled: true,
      }) as GlobalContent,
  )
  chrome.strings = siteStrings(rows)
}

beforeEach(() => {
  repo.path = null
  repo.global = null
  chrome.strings = siteStrings([])
  delete process.env['NEXT_PUBLIC_SITE_URL']
})

describe('title', () => {
  it("applies §41's template to a path's own title", () => {
    strings({ 'SEO_DEFAULT.title_template': '%s | Rivya Living Art' })
    repo.path = entry({ title: 'About' })
    return expect(
      buildPageMetadata({ path: '/about', liveSectionCount: 3 }),
    ).resolves.toMatchObject({ title: 'About | Rivya Living Art' })
  })

  it('does not run the GLOBAL title through the template', async () => {
    // The GLOBAL entry's title is the brand itself. Through `%s | Rivya Living Art` it would read
    // "Rivya Living Art | Rivya Living Art", which is why the template is applied here rather than
    // through Next's `title.template` on a layout.
    strings({ 'SEO_DEFAULT.title_template': '%s | Rivya Living Art' })
    repo.global = entry({ scope: 'GLOBAL', title: 'Rivya Living Art' })
    const metadata = await buildPageMetadata({ path: '/about', liveSectionCount: 3 })
    expect(metadata.title).toBe('Rivya Living Art')
  })

  it('falls back to SEO_DEFAULT.site_name when there is no entry at all', async () => {
    strings({ 'SEO_DEFAULT.site_name': 'Rivya Living Art' })
    const metadata = await buildPageMetadata({ path: '/faq', liveSectionCount: 1 })
    expect(metadata.title).toBe('Rivya Living Art')
  })

  it('is empty rather than invented when every rung is missing', async () => {
    const metadata = await buildPageMetadata({ path: '/faq', liveSectionCount: 1 })
    expect(metadata.title).toBe('')
  })
})

describe('description and social', () => {
  it("prefers the path's description over the global one", async () => {
    repo.path = entry({ description: 'About the studio.' })
    repo.global = entry({ scope: 'GLOBAL', description: 'The site.' })
    const metadata = await buildPageMetadata({ path: '/about', liveSectionCount: 2 })
    expect(metadata.description).toBe('About the studio.')
  })

  it('falls back to the SOCIAL defaults for the card', async () => {
    strings({ 'SOCIAL.og_headline': 'Rivya — Functional Art', 'SOCIAL.og_description': 'Objects.' })
    const metadata = await buildPageMetadata({ path: '/about', liveSectionCount: 2 })
    expect(metadata.openGraph?.title).toBe('Rivya — Functional Art')
    expect(metadata.twitter?.description).toBe('Objects.')
  })

  it('treats a blank field as missing rather than as an empty description', async () => {
    repo.path = entry({ description: '   ' })
    repo.global = entry({ scope: 'GLOBAL', description: 'The site.' })
    const metadata = await buildPageMetadata({ path: '/about', liveSectionCount: 2 })
    expect(metadata.description).toBe('The site.')
  })
})

describe('robots', () => {
  it('is noindex when the page has no live sections', async () => {
    repo.path = entry({ robots: 'index,follow' })
    const metadata = await buildPageMetadata({ path: '/privacy', liveSectionCount: 0 })
    expect(metadata.robots).toEqual({ index: false, follow: true })
  })

  it('still follows links on a page it will not index', async () => {
    // `follow` keeps the page from becoming a dead end in the link graph while it is incomplete.
    const metadata = await buildPageMetadata({ path: '/privacy', liveSectionCount: 0 })
    expect(metadata.robots).toMatchObject({ follow: true })
  })

  it("honours the row's own directive once the page has content", async () => {
    repo.path = entry({ robots: 'noindex,nofollow' })
    const metadata = await buildPageMetadata({ path: '/about', liveSectionCount: 4 })
    expect(metadata.robots).toBe('noindex,nofollow')
  })
})

describe('canonical and metadataBase', () => {
  it('omits both when NEXT_PUBLIC_SITE_URL is unset', async () => {
    const metadata = await buildPageMetadata({ path: '/about', liveSectionCount: 1 })
    expect(metadata.metadataBase).toBeUndefined()
    expect(metadata.alternates).toBeUndefined()
  })

  it('sets the canonical to the path when an origin exists', async () => {
    process.env['NEXT_PUBLIC_SITE_URL'] = 'https://rivya.example'
    const metadata = await buildPageMetadata({ path: '/about', liveSectionCount: 1 })
    expect(metadata.alternates?.canonical).toBe('/about')
    expect(metadata.openGraph?.url).toBe('https://rivya.example/about')
  })

  it('omits both rather than throwing on a malformed origin', async () => {
    // A wrong metadataBase makes every relative OG image resolve to a domain that is not ours.
    process.env['NEXT_PUBLIC_SITE_URL'] = 'not a url'
    const metadata = await buildPageMetadata({ path: '/about', liveSectionCount: 1 })
    expect(metadata.metadataBase).toBeUndefined()
  })
})
