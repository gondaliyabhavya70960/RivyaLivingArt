import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { MAX_LINKS_PER_PAGE, rawItemSchema, readRawItem } from '@/lib/scraper/core/raw'
import {
  FETCH_TIMEOUT_MS,
  MAX_BODY_BYTES,
  MAX_REDIRECTS,
  snapshotKey,
} from '@/lib/scraper/core/fetch'
import { stripCommentsAndStrings } from '@/scripts/db/strip-code.mjs'

/**
 * The four isolation invariants, and the prohibitions that sit alongside them.
 *
 * `scripts/research/check-research-isolation.mjs` IS THE GATE AND THIS IS ITS COMPANION. The gate
 * runs in `npm run check` and fails a build; this suite asserts the things the gate cannot see —
 * that the guard itself still checks what it claims to, that the fetcher's bounds are the ones the
 * phase document specifies, and that the RAW schema is still narrow enough to refuse a Phase 27
 * shortcut. A guard nobody tests is a guard that can be quietly weakened by editing its own
 * allowlist.
 *
 * THE DATABASE HALF — no anon row is readable from any research table — is proved against a real
 * PostgreSQL in `tests/unit/rls/phase25.test.ts`, where an anon session can actually be assumed.
 */

const GUARD = readFileSync('scripts/research/check-research-isolation.mjs', 'utf8')
const FETCH = stripCommentsAndStrings(readFileSync('lib/scraper/core/fetch.ts', 'utf8'), {
  strings: false,
})

describe('the guard still guards', () => {
  it('checks all four invariants', () => {
    for (const check of [
      'checkForeignKeys()',
      'checkAnonPolicies()',
      'checkPublicTrees()',
      'checkScraperImports()',
      'checkCatalogImports()',
      'checkStageWriter()',
    ]) {
      expect(GUARD).toContain(check)
    }
  })

  it('keeps the I1 allowlist EMPTY at this phase', () => {
    /*
     * THE ASSERTION MOST WORTH HAVING. Phase 26 adds `research_source_category_map.category_id`
     * and Phase 28 adds `research_products.matched_category_id`, each with a D5 amendment. A THIRD
     * entry — or an early one — means somebody joined the two halves of the schema without the
     * argument. Failing here forces that argument to happen.
     */
    const block = /const ALLOWED_CROSSINGS = new Set\(\[([\s\S]*?)\]\)/.exec(GUARD)
    expect(block).not.toBeNull()
    const entries = [...block![1]!.matchAll(/'([^']+)'/g)]
    expect(entries).toHaveLength(0)
  })

  it('names the browser-automation and proxy packages it refuses', () => {
    for (const forbidden of ['puppeteer', 'playwright', 'selenium', 'webdriver', '2captcha']) {
      expect(GUARD).toContain(forbidden)
    }
  })

  it('polices every public tree the invariant names', () => {
    for (const tree of ["'(site)'", "'cms'", "'catalog'", "'seo'", "'sections'", "'content'"]) {
      expect(GUARD).toContain(tree)
    }
  })

  it('says so rather than passing when it cannot reach a database', () => {
    // A GATE THAT REPORTS SUCCESS FOR A CHECK IT DID NOT RUN is worse than a missing one, because
    // it is trusted.
    expect(GUARD).toContain('I1 not checked: DATABASE_URL is not set')
  })
})

describe('the fetcher makes no request it was not told to', () => {
  it('carries the three bounds the phase document specifies', () => {
    expect(FETCH_TIMEOUT_MS).toBe(15_000)
    expect(MAX_BODY_BYTES).toBe(2 * 1024 * 1024)
    expect(MAX_REDIRECTS).toBe(5)
  })

  it('follows redirects MANUALLY, so each hop can be re-checked', () => {
    // `redirect: 'follow'` would hand the decision to the runtime and let a redirect walk off the
    // approved host with nothing noticing.
    expect(FETCH).toContain("redirect: 'manual'")
    expect(FETCH).not.toContain("redirect: 'follow'")
  })

  it('sends the configured agent and never invents one', () => {
    expect(FETCH).toContain("requiredEnv('SCRAPER_USER_AGENT')")
    // NO FALLBACK. A default would mean an unconfigured deployment crawling anonymously.
    expect(FETCH).not.toMatch(/SCRAPER_USER_AGENT[^)]*\?\?/)
  })

  it('reads the body as a stream so the cap protects memory, not only the database', () => {
    expect(FETCH).toContain('getReader()')
    expect(FETCH).toContain('MAX_BODY_BYTES')
  })

  it('names no browser, proxy or captcha machinery', () => {
    for (const forbidden of ['puppeteer', 'playwright', 'chromium', 'proxy', 'captcha']) {
      expect(FETCH.toLowerCase()).not.toContain(forbidden)
    }
  })
})

describe('the RAW schema refuses a Phase 27 shortcut', () => {
  it('accepts exactly title, canonicalUrl and links', () => {
    const parsed = rawItemSchema.safeParse({ title: 'A', canonicalUrl: null, links: [] })
    expect(parsed.success).toBe(true)
  })

  it('refuses a richer payload rather than ignoring the extra keys', () => {
    // THE COMMITMENT DEVICE. "Just a quick price regex" fails at the write rather than at review.
    const parsed = rawItemSchema.safeParse({
      title: 'A',
      canonicalUrl: null,
      links: [],
      price: 1200,
    })
    expect(parsed.success).toBe(false)
  })

  it('caps the links one page may contribute', () => {
    const many = Array.from({ length: MAX_LINKS_PER_PAGE + 1 }, (_, i) => `https://e.com/${i}`)
    expect(rawItemSchema.safeParse({ title: null, canonicalUrl: null, links: many }).success).toBe(
      false,
    )
  })
})

describe('reading a page', () => {
  const page = `
    <html><head><title> A  Piece &amp; Another </title>
    <link rel="canonical" href="/canonical"></head>
    <body>
      <a href="/a">a</a>
      <a href="/a#spec">same page</a>
      <a href="https://elsewhere.example/x">off host</a>
      <a href="mailto:hi@e.com">mail</a>
      <a href="javascript:alert(1)">js</a>
      <a href='https://e.com/b'>b</a>
    </body></html>`

  it('reads and tidies the title', () => {
    expect(readRawItem(page, 'https://e.com/p').title).toBe('A Piece & Another')
  })

  it('resolves the canonical link against the page', () => {
    expect(readRawItem(page, 'https://e.com/p').canonicalUrl).toBe('https://e.com/canonical')
  })

  it('keeps same-host links, drops the rest, and strips fragments', () => {
    const links = readRawItem(page, 'https://e.com/p').links
    // `/a` and `/a#spec` ARE ONE PAGE. Keeping both would double the queue and fetch the same
    // document twice — the politeness budget spent on nothing.
    expect(links).toEqual(['https://e.com/a', 'https://e.com/b'])
  })

  it('drops every non-http scheme', () => {
    const links = readRawItem(page, 'https://e.com/p')
    expect(links.links.some((url) => url.startsWith('mailto'))).toBe(false)
    expect(links.links.some((url) => url.startsWith('javascript'))).toBe(false)
  })

  it('survives a page that is not really HTML', () => {
    expect(() => readRawItem('\x00\x01 not html <<<', 'https://e.com/p')).not.toThrow()
    expect(readRawItem('', 'https://e.com/p')).toEqual({
      title: null,
      canonicalUrl: null,
      links: [],
    })
  })

  it('produces a snapshot key that is date-partitioned and content-addressed', () => {
    const key = snapshotKey('acme', 'abc123', new Date('2026-03-04T00:00:00Z'))
    // The date prefix makes "delete everything older than 180 days" a prefix listing; the hash
    // makes an unchanged page cost one object rather than one per day.
    expect(key).toBe('research/acme/2026/03/04/abc123.html.gz')
  })
})
