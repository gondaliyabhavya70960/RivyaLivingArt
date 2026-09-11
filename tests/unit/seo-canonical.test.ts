import { describe, expect, it } from 'vitest'

import {
  canonicalFor,
  paginatedPath,
  sameOriginCanonical,
  siteOrigin,
  stripTrailingSlash,
} from '@/lib/seo/canonical'

/**
 * The canonical rule table — Phase 39, one row per case, no exceptions.
 */
const SITE = 'https://rivya.example'

describe('canonicalFor — the table', () => {
  it('a static path is the origin plus the path, no trailing slash, no query', () => {
    const c = canonicalFor({ siteUrl: SITE, path: '/about/' })
    expect(c).toEqual({ path: '/about', href: `${SITE}/about`, source: 'PATH', noindex: false })
  })

  it('a filtered listing is canonical to the UNFILTERED path and noindex', () => {
    const c = canonicalFor({
      siteUrl: SITE,
      path: '/collection/furniture',
      filtered: true,
      page: 3,
    })
    expect(c.path).toBe('/collection/furniture')
    expect(c.source).toBe('UNFILTERED')
    expect(c.noindex).toBe(true)
  })

  it('page n > 1 of a bare listing is canonical to itself', () => {
    const c = canonicalFor({ siteUrl: SITE, path: '/collection/furniture', page: 2 })
    expect(c.path).toBe('/collection/furniture?page=2')
    expect(c.href).toBe(`${SITE}/collection/furniture?page=2`)
    expect(c.source).toBe('PAGINATED')
    expect(c.noindex).toBe(false)
  })

  it('page 1 is the bare path', () => {
    expect(canonicalFor({ siteUrl: SITE, path: '/journal', page: 1 }).path).toBe('/journal')
  })

  it('/search has no canonical and is noindex', () => {
    const c = canonicalFor({ siteUrl: SITE, path: '/search', searchSurface: true })
    expect(c).toEqual({ path: null, href: null, source: 'NONE', noindex: true })
  })

  it('an owner-set canonical wins when it is absolute and same-origin', () => {
    const c = canonicalFor({
      siteUrl: SITE,
      path: '/product/wave-table-ii',
      ownerCanonical: 'https://rivya.example/product/wave-table',
    })
    expect(c.href).toBe(`${SITE}/product/wave-table`)
    expect(c.path).toBe('/product/wave-table')
    expect(c.source).toBe('OWNER')
  })

  it('refuses an owner canonical on another host, and falls back to the rule', () => {
    const c = canonicalFor({
      siteUrl: SITE,
      path: '/about',
      ownerCanonical: 'https://other.example/about',
    })
    expect(c.source).toBe('PATH')
    expect(c.href).toBe(`${SITE}/about`)
  })

  it('an owner canonical never overrides a filtered view', () => {
    const c = canonicalFor({
      siteUrl: SITE,
      path: '/collection/furniture',
      filtered: true,
      ownerCanonical: `${SITE}/elsewhere`,
    })
    expect(c.source).toBe('UNFILTERED')
  })

  it('without an origin the relative path still exists and the absolute one does not', () => {
    const c = canonicalFor({ siteUrl: null, path: '/about' })
    expect(c.path).toBe('/about')
    expect(c.href).toBeNull()
  })
})

describe('the helpers', () => {
  it('siteOrigin parses to an origin and refuses junk', () => {
    expect(siteOrigin('https://rivya.example/some/path')).toBe('https://rivya.example')
    expect(siteOrigin('not a url')).toBeNull()
    expect(siteOrigin('ftp://x.example')).toBeNull()
    expect(siteOrigin('')).toBeNull()
    expect(siteOrigin(undefined)).toBeNull()
  })

  it('stripTrailingSlash keeps the root', () => {
    expect(stripTrailingSlash('/')).toBe('/')
    expect(stripTrailingSlash('/a/b/')).toBe('/a/b')
  })

  it('paginatedPath emits only ?page=n and only past page 1', () => {
    expect(paginatedPath('/journal/', 1)).toBe('/journal')
    expect(paginatedPath('/journal', 4)).toBe('/journal?page=4')
  })

  it('sameOriginCanonical normalises and validates', () => {
    expect(sameOriginCanonical(`${SITE}/a/b/#frag`, SITE)).toBe(`${SITE}/a/b`)
    expect(sameOriginCanonical('/relative', SITE)).toBeNull()
    expect(sameOriginCanonical('https://other.example/', SITE)).toBeNull()
    expect(sameOriginCanonical(`${SITE}/a`, null)).toBeNull()
  })
})
