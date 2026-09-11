import { describe, expect, it } from 'vitest'

import {
  MAX_URLS_PER_FILE,
  SITEMAP_TYPES,
  isSitemapType,
  sitemapChildPath,
  sitemapEntries,
  sitemapIndexXml,
  urlsetXml,
} from '@/lib/seo/sitemap'

/**
 * Published-only, six children, no image sitemap, no priority, no changefreq — Phase 39.
 *
 * The rows below carry a DRAFT of every kind beside a PUBLISHED one; the entries must contain
 * the published address and nothing else. The database half of this — that the anonymous client
 * never returns the DRAFT row in the first place — is `tests/unit/rls/phase39.test.ts`.
 */
const ORIGIN = 'https://rivya.example'
const at = '2026-01-15T12:00:00.000Z'

describe('the index', () => {
  it('lists exactly six children and none is an image sitemap', () => {
    const xml = sitemapIndexXml(ORIGIN)
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    expect(locs).toHaveLength(6)
    expect(locs).toEqual(SITEMAP_TYPES.map((type) => `${ORIGIN}${sitemapChildPath(type)}`))
    expect(xml).not.toContain('images')
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
  })

  it('names the six types and refuses a seventh', () => {
    expect([...SITEMAP_TYPES]).toEqual([
      'pages',
      'categories',
      'products',
      'collections',
      'portfolio',
      'journal',
    ])
    expect(isSitemapType('images')).toBe(false)
    expect(isSitemapType('products')).toBe(true)
  })
})

describe('the entries', () => {
  const rows = [
    { path: '/about', status: 'PUBLISHED', publishedAt: at, updatedAt: '2026-02-01T00:00:00.000Z' },
    { path: '/process', status: 'DRAFT', publishedAt: null, updatedAt: at },
    { path: '/product/draft-piece', status: 'DRAFT', publishedAt: at, updatedAt: at },
    { path: '/product/live-piece', status: 'PUBLISHED', publishedAt: null, updatedAt: at },
    { path: '/collections/hidden', status: 'ARCHIVED', publishedAt: at, updatedAt: at },
    { path: '/about', status: 'PUBLISHED', publishedAt: at, updatedAt: at },
  ]

  it('keeps PUBLISHED rows only, once each, as absolute URLs', () => {
    const entries = sitemapEntries(rows, ORIGIN)
    expect(entries.map((e) => e.loc)).toEqual([`${ORIGIN}/about`, `${ORIGIN}/product/live-piece`])
  })

  it('takes lastmod from published_at, falling back to updated_at', () => {
    const entries = sitemapEntries(rows, ORIGIN)
    expect(entries[0]?.lastModified).toBe(at)
    expect(entries[1]?.lastModified).toBe(at)
  })

  it('caps a file at 5 000 URLs', () => {
    const many = Array.from({ length: MAX_URLS_PER_FILE + 5 }, (_, i) => ({
      path: `/product/p${String(i)}`,
      status: 'PUBLISHED',
      publishedAt: at,
      updatedAt: at,
    }))
    expect(sitemapEntries(many, ORIGIN)).toHaveLength(MAX_URLS_PER_FILE)
  })
})

describe('the urlset', () => {
  it('writes loc and lastmod and nothing else', () => {
    const xml = urlsetXml(
      sitemapEntries(
        [{ path: '/about', status: 'PUBLISHED', publishedAt: at, updatedAt: at }],
        ORIGIN,
      ),
    )
    expect(xml).toContain(`<loc>${ORIGIN}/about</loc>`)
    expect(xml).toContain(`<lastmod>${at}</lastmod>`)
    expect(xml).not.toContain('priority')
    expect(xml).not.toContain('changefreq')
    expect(xml).not.toContain('image:')
  })

  it('escapes what XML needs escaped', () => {
    const xml = urlsetXml([{ loc: 'https://x.example/a?b=1&c=2', lastModified: at }])
    expect(xml).toContain('a?b=1&amp;c=2')
  })

  it('is a valid empty document for a site with nothing published', () => {
    expect(urlsetXml([])).toContain('<urlset')
    expect(urlsetXml([])).not.toContain('<url>')
  })
})
