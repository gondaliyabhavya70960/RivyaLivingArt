import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { emptyDraft, rawProductDraftSchema } from '@/lib/scraper/adapters/draft-schema'
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

  it('holds exactly the crossings somebody argued for, by name', () => {
    /*
     * THE ASSERTION MOST WORTH HAVING, AND IT IS NOW A LIST RATHER THAN A ZERO. It was written in
     * Phase 25 as "the allowlist is empty", which was the right assertion for a phase with no
     * crossings and the wrong one to keep: the point was never the number, it was that every entry
     * is a decision somebody wrote down. Phase 26 added the first — a staff-typed taxonomy
     * pointer, `on delete set null`, recorded as amendment A26 — and Phase 28 adds the second and
     * last. A THIRD, or a different one, means somebody joined the two halves of the schema
     * without the argument, and failing here is what forces that argument to happen.
     */
    // COMMENTS STRIPPED FIRST. The entries are read by matching quoted strings, and the block's
    // own prose explains each one — so an apostrophe in a comment used to be read as an allowlist
    // entry, which is a test failing on punctuation rather than on the rule it exists for.
    const code = stripCommentsAndStrings(GUARD, { strings: false })
    const block = /const ALLOWED_CROSSINGS = new Set\(\[([\s\S]*?)\]\)/.exec(code)
    expect(block).not.toBeNull()
    const entries = [...block![1]!.matchAll(/'([^']+)'/g)].map((match) => match[1])
    expect(entries).toEqual(['research_source_category_map_category_fk'])
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

/**
 * PHASE 25 CALLED THIS "the RAW schema refuses a Phase 27 shortcut" AND PHASE 27 ARRIVED.
 *
 * The schema is unchanged and the assertions below still hold, because what they describe is still
 * true of it: `rawItemSchema` is the shape the generic adapter's DISCOVERY half produces — a title,
 * a canonical URL and a bounded list of links — and it still refuses anything richer. What moved is
 * which schema the WRITE parses with: `recordRawItem` now parses `rawProductDraftSchema`, because
 * an adapter exists and a draft is what it produces.
 *
 * THE COMMITMENT WAS KEPT RATHER THAN ABANDONED, and the last two tests here are what say so. The
 * point of the strict three-key shape was never the three keys; it was that a "quick price regex"
 * could not land before the architecture that owns parsing. It did not, and the schema that
 * replaced it at the write refuses a parsed number just as firmly.
 */
describe('the RAW schema, and what replaced it at the write', () => {
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

  it('hands the write to a draft schema that refuses a parsed number just as firmly', () => {
    // THE COMMITMENT, KEPT. Phase 25's schema existed to stop parsing landing before the
    // architecture that owns it; Phase 27 built that architecture, and its schema is what
    // `recordRawItem` parses now. A price as a NUMBER — the exact shortcut the original was written
    // against — still fails, at the write, in the same place.
    const parsed = rawProductDraftSchema.safeParse({
      ...emptyDraft(),
      priceText: 1299 as unknown as string,
    })
    expect(parsed.success).toBe(false)
  })

  it('is the schema the repository actually parses with, not merely one that exists', () => {
    // A schema nothing calls is a comment. This reads the repository and asserts the swap happened
    // there rather than only in a file somebody could later stop importing.
    const source = readFileSync('lib/supabase/repositories/research/raw-items.ts', 'utf8')
    expect(source).toContain('rawProductDraftSchema.parse(')
    expect(source).not.toMatch(/\brawItemSchema\.parse\(/)
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
