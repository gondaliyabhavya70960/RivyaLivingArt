import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import {
  MATCH_BUDGET_MS,
  URL_PATTERN_MAX_LENGTH,
  compilePattern,
  globToRegExp,
  hostMatchesBase,
  matchUrl,
  testPatterns,
  type SourceUrlPattern,
  type UrlPatternKind,
} from '@/lib/scraper/core/url-patterns'

/**
 * The URL pattern matcher, and the two directions it is allowed to be wrong in.
 *
 * EVERY AMBIGUITY IN THIS FILE RESOLVES TOWARDS FETCHING LESS, which is the posture
 * `core/robots.ts` sets for the whole subsystem. A rule that cannot be read, a budget that runs
 * out, a URL nothing claims — each one ends in no request. The single exception is an EXCLUDE that
 * will not compile, which is asserted here to refuse anyway: skipping it would be the only failure
 * mode in the module that ends in MORE traffic, aimed at a path somebody wrote a rule to stay out
 * of.
 *
 * NO HOST IN THIS FILE IS REAL. `example.com`, its subdomains, `other.example` and loopback are
 * the only ones used, and no competitor is named anywhere — the same rule the repository applies
 * to its seeds applies to its fixtures.
 */

const rule = (
  id: string,
  kind: UrlPatternKind,
  pattern: string,
  extra: { readonly isRegex?: boolean; readonly priority?: number } = {},
): SourceUrlPattern => ({
  id,
  kind,
  pattern,
  isRegex: extra.isRegex ?? false,
  priority: extra.priority ?? 0,
})

/** A clock that reads out the supplied instants in order and then holds the last one for ever. */
const clock = (...instants: readonly number[]): (() => number) => {
  let index = 0
  return () => {
    const value = instants[Math.min(index, instants.length - 1)] ?? 0
    index += 1
    return value
  }
}

/** A clock that advances by `stepMs` on every reading, whoever is reading it. */
const ticking = (stepMs: number): (() => number) => {
  let elapsed = 0
  return () => {
    const value = elapsed
    elapsed += stepMs
    return value
  }
}

type RobotsAnswer = 'ALLOWED' | 'DISALLOWED' | 'NO_ROBOTS' | 'ERROR'
const always = (decision: RobotsAnswer) => (): RobotsAnswer => decision

describe('the glob grammar', () => {
  /**
   * THE SLASH IS THE WHOLE POINT OF `*`. A glob that let `*` cross a slash would make
   * `/product/*` mean "everything beneath /product", and a PRODUCT rule written that way starts
   * fetching a site rather than a page.
   */
  it('matches within one path segment with a single star', () => {
    expect(globToRegExp('/product/*').test('/product/small-table')).toBe(true)
  })

  it('refuses to cross a slash with a single star', () => {
    expect(globToRegExp('/product/*').test('/product/seating/small-table')).toBe(false)
  })

  it('crosses a slash with a double star', () => {
    expect(globToRegExp('/product/**').test('/product/seating/small-table')).toBe(true)
  })

  it('lets a double star match nothing at all', () => {
    expect(globToRegExp('/product/**').test('/product/')).toBe(true)
  })

  it('matches exactly one character with a question mark', () => {
    expect(globToRegExp('/p/?').test('/p/a')).toBe(true)
  })

  it('does not let a question mark match two characters', () => {
    expect(globToRegExp('/p/?').test('/p/ab')).toBe(false)
  })

  it('does not let a question mark match a slash', () => {
    expect(globToRegExp('/p/?/x').test('/p//x')).toBe(false)
  })

  /**
   * ANCHORED AT BOTH ENDS. A glob has no notation for "anywhere in the string", so an unanchored
   * one would make `product` match `/not-a-product-page` with no way to write the rule that does
   * not.
   */
  it('is anchored at the start', () => {
    expect(globToRegExp('/product/*').test('https://example.com/product/x')).toBe(false)
  })

  it('is anchored at the end', () => {
    expect(globToRegExp('/product/*').test('/product/x/reviews')).toBe(false)
  })

  it('treats a full stop as a literal, not as "any character"', () => {
    const regex = globToRegExp('/p/item.html')
    expect(regex.test('/p/item.html')).toBe(true)
    expect(regex.test('/p/itemXhtml')).toBe(false)
  })

  it('treats a plus as a literal, not as "one or more"', () => {
    const regex = globToRegExp('/p/a+b')
    expect(regex.test('/p/a+b')).toBe(true)
    expect(regex.test('/p/aaab')).toBe(false)
  })

  it('treats brackets, braces, pipes and parentheses as literals', () => {
    // Real URLs carry every one of these, and a matcher that read them as syntax would either
    // throw or quietly match a different set of pages.
    const regex = globToRegExp('/p/(x)[y]{z}|w')
    expect(regex.test('/p/(x)[y]{z}|w')).toBe(true)
    expect(regex.test('/p/xyzw')).toBe(false)
  })

  it('treats the anchors themselves as literals', () => {
    expect(globToRegExp('/p/$x^y').test('/p/$x^y')).toBe(true)
  })

  it('treats a backslash as a literal', () => {
    expect(globToRegExp('/p/a\\b').test('/p/a\\b')).toBe(true)
  })

  /**
   * A GLOB CANNOT EXPRESS A LITERAL QUESTION MARK, and the query string is where that shows. `?`
   * matches the `?` that starts a query — and would equally match any other single character in
   * its place. An operator who needs the distinction ticks `is_regex`; the alternative, inventing
   * an escape character for globs, would be a second notation nobody asked for.
   */
  it('matches a query string, with the question mark read as a single-character wildcard', () => {
    const regex = globToRegExp('/p/*?ref=*')
    expect(regex.test('/p/item?ref=spring')).toBe(true)
    expect(regex.test('/p/itemXref=spring')).toBe(true)
  })

  it('reads a run of three stars as a double star', () => {
    expect(globToRegExp('/p/***').test('/p/a/b')).toBe(true)
  })

  /**
   * NO FLAGS, AND `g` IN PARTICULAR. A global expression carries `lastIndex` between calls, so the
   * same pattern asked twice about the same URL answers differently the second time — a matcher
   * whose answer depends on how many times it has been asked.
   */
  it('compiles with no flags at all', () => {
    expect(globToRegExp('/p/*').flags).toBe('')
  })

  it('gives the same answer when the same expression is asked twice', () => {
    const regex = globToRegExp('/p/*')
    expect(regex.test('/p/a')).toBe(true)
    expect(regex.test('/p/a')).toBe(true)
  })

  it('is case-sensitive, because a URL path is', () => {
    expect(globToRegExp('/product/*').test('/Product/x')).toBe(false)
  })
})

describe('compiling a stored pattern', () => {
  it('compiles a glob', () => {
    const compiled = compilePattern(rule('a', 'PRODUCT', '/product/*'))
    expect(compiled.ok).toBe(true)
    expect(compiled.ok && compiled.regex.test('/product/x')).toBe(true)
  })

  it('compiles a regular expression when the flag is set', () => {
    const compiled = compilePattern(rule('a', 'PRODUCT', '^/p/[0-9]+$', { isRegex: true }))
    expect(compiled.ok).toBe(true)
    expect(compiled.ok && compiled.regex.test('/p/1234')).toBe(true)
  })

  it('refuses an empty pattern', () => {
    const compiled = compilePattern(rule('a', 'PRODUCT', ''))
    expect(compiled.ok).toBe(false)
    expect(compiled.ok || compiled.reason).toMatch(/empty/i)
  })

  it('refuses a pattern that is only whitespace', () => {
    // `^ $` would compile happily and match nothing but a single space, which reads as a rule that
    // is switched off rather than one that is broken.
    expect(compilePattern(rule('a', 'PRODUCT', '   ')).ok).toBe(false)
  })

  it('accepts a pattern of exactly the maximum length', () => {
    const text = `/p/${'a'.repeat(URL_PATTERN_MAX_LENGTH - 3)}`
    expect(text).toHaveLength(URL_PATTERN_MAX_LENGTH)
    expect(compilePattern(rule('a', 'PRODUCT', text)).ok).toBe(true)
  })

  it('refuses a pattern one character over the maximum, and says both numbers', () => {
    const text = `/p/${'a'.repeat(URL_PATTERN_MAX_LENGTH - 2)}`
    expect(text).toHaveLength(URL_PATTERN_MAX_LENGTH + 1)
    const compiled = compilePattern(rule('a', 'PRODUCT', text))
    expect(compiled.ok).toBe(false)
    expect(compiled.ok || compiled.reason).toContain(String(URL_PATTERN_MAX_LENGTH))
    expect(compiled.ok || compiled.reason).toContain(String(URL_PATTERN_MAX_LENGTH + 1))
  })

  /**
   * THE CALLER IS A FORM, so an expression a person got wrong has to come back as a sentence. A
   * thrown `SyntaxError` here is an unhandled exception in a Server Action, or a crashed cron
   * invocation when the row is read months later.
   */
  it('refuses an unparseable regular expression instead of throwing', () => {
    const broken = rule('a', 'PRODUCT', '/p/(unclosed', { isRegex: true })
    expect(() => compilePattern(broken)).not.toThrow()
    const compiled = compilePattern(broken)
    expect(compiled.ok).toBe(false)
    expect(compiled.ok || compiled.reason).toMatch(/regular expression/i)
  })

  it('compiles the same text happily as a glob, which is why glob is the default', () => {
    const compiled = compilePattern(rule('a', 'PRODUCT', '/p/(unclosed'))
    expect(compiled.ok).toBe(true)
    expect(compiled.ok && compiled.regex.test('/p/(unclosed')).toBe(true)
  })

  it('leaves a regular expression unanchored, as the notation says', () => {
    const compiled = compilePattern(rule('a', 'PRODUCT', '/p/[0-9]+', { isRegex: true }))
    expect(compiled.ok && compiled.regex.test('https://example.com/p/12?ref=x')).toBe(true)
  })

  it('anchors the equivalent glob, so the two notations differ visibly', () => {
    const compiled = compilePattern(rule('a', 'PRODUCT', '/p/*'))
    expect(compiled.ok && compiled.regex.test('https://example.com/p/12')).toBe(false)
  })
})

describe('EXCLUDE wins, whatever the priority', () => {
  const url = 'https://example.com/private/ledger'

  /**
   * THE ASSERTION THIS WHOLE FILE EXISTS FOR. If a priority number could lift a PRODUCT rule over
   * an EXCLUDE, the priority column would be a way to configure a refusal away — and nothing in
   * the audit trail would record that a refusal had been overridden, because as far as the matcher
   * was concerned none had been.
   */
  it('beats a PRODUCT rule of far higher priority', () => {
    const product = rule('product', 'PRODUCT', '**', { priority: 1000 })
    const exclude = rule('exclude', 'EXCLUDE', '**/private/**', { priority: 0 })
    // Both of these match this URL on their own — asserted first, so that the test below cannot
    // pass because the PRODUCT rule happened to miss.
    expect(matchUrl(url, [product]).reason).toBe('MATCHED')

    expect(matchUrl(url, [product, exclude])).toEqual({
      kind: 'EXCLUDE',
      patternId: 'exclude',
      reason: 'EXCLUDED',
    })
  })

  it('names the excluding pattern, so the tester can point at the rule', () => {
    const result = matchUrl(url, [rule('exclude', 'EXCLUDE', '**/private/**')])
    expect(result.patternId).toBe('exclude')
    expect(result.reason).toBe('EXCLUDED')
  })

  it('does not interfere when it does not match', () => {
    const result = matchUrl('https://example.com/p/lamp', [
      rule('exclude', 'EXCLUDE', '**/private/**', { priority: 1000 }),
      rule('product', 'PRODUCT', '**/p/*'),
    ])
    expect(result).toEqual({ kind: 'PRODUCT', patternId: 'product', reason: 'MATCHED' })
  })

  it('reports the highest-priority EXCLUDE when two of them match', () => {
    const result = matchUrl(url, [
      rule('low', 'EXCLUDE', '**/private/**', { priority: 1 }),
      rule('high', 'EXCLUDE', '**/ledger', { priority: 9 }),
    ])
    expect(result.patternId).toBe('high')
  })

  /**
   * A REFUSAL WE CANNOT READ IS STILL A REFUSAL SOMEBODY MADE. This is the one place the module
   * refuses to treat a broken row as absent, because it is the only failure that would end in more
   * traffic rather than less — at a path a reviewer wrote a rule to keep Rivya out of.
   */
  it('excludes anyway when the EXCLUDE pattern will not compile', () => {
    const result = matchUrl(url, [
      rule('broken', 'EXCLUDE', '/private/(unclosed', { isRegex: true }),
      rule('product', 'PRODUCT', '**', { priority: 1000 }),
    ])
    expect(result).toEqual({ kind: 'EXCLUDE', patternId: 'broken', reason: 'EXCLUDED' })
  })

  it('skips a PRODUCT rule that will not compile and lets the next one answer', () => {
    // The other direction: one malformed claim must not make every URL of a source unmatchable,
    // and skipping it errs towards fetching less rather than more.
    const result = matchUrl('https://example.com/p/lamp', [
      rule('broken', 'PRODUCT', '/p/(unclosed', { isRegex: true, priority: 10 }),
      rule('good', 'PRODUCT', '**/p/*', { priority: 5 }),
    ])
    expect(result).toEqual({ kind: 'PRODUCT', patternId: 'good', reason: 'MATCHED' })
  })

  it('excludes with no other rule present at all', () => {
    const result = matchUrl(url, [rule('exclude', 'EXCLUDE', '**')])
    expect(result.reason).toBe('EXCLUDED')
  })
})

describe('ordering', () => {
  const url = 'https://example.com/shop/seating/page/2'

  it('prefers the higher priority', () => {
    const result = matchUrl(url, [
      rule('low', 'PRODUCT', '**', { priority: 1 }),
      rule('high', 'PRODUCT', '**/page/*', { priority: 2 }),
    ])
    expect(result.patternId).toBe('high')
  })

  it('breaks a priority tie with PRODUCT before CATEGORY', () => {
    const result = matchUrl(url, [
      rule('category', 'CATEGORY', '**', { priority: 5 }),
      rule('product', 'PRODUCT', '**', { priority: 5 }),
    ])
    expect(result).toEqual({ kind: 'PRODUCT', patternId: 'product', reason: 'MATCHED' })
  })

  it('breaks a priority tie with CATEGORY before PAGINATION', () => {
    const result = matchUrl(url, [
      rule('pagination', 'PAGINATION', '**', { priority: 5 }),
      rule('category', 'CATEGORY', '**', { priority: 5 }),
    ])
    expect(result.kind).toBe('CATEGORY')
  })

  it('breaks a priority and kind tie on the pattern text, ascending', () => {
    const result = matchUrl(url, [
      rule('second', 'PRODUCT', '**/seating/**'),
      rule('first', 'PRODUCT', '**'),
    ])
    // '**' sorts before '**/seating/**', and the ordering is stated rather than incidental so that
    // an operator who reports "it matched the wrong rule" can be shown the same answer twice.
    expect(result.patternId).toBe('first')
  })

  it('breaks a complete tie on the id, so the comparator is a total order', () => {
    const result = matchUrl(url, [rule('bbb', 'PRODUCT', '**'), rule('aaa', 'PRODUCT', '**')])
    expect(result.patternId).toBe('aaa')
  })

  it('does not depend on the order the rows arrived in', () => {
    const rules = [
      rule('a', 'PRODUCT', '**/page/*', { priority: 3 }),
      rule('b', 'CATEGORY', '**/seating/**', { priority: 7 }),
      rule('c', 'PAGINATION', '**', { priority: 7 }),
    ]
    const forwards = matchUrl(url, rules)
    const backwards = matchUrl(url, [...rules].reverse())
    expect(forwards).toEqual(backwards)
    expect(forwards.patternId).toBe('b')
  })
})

describe('when nothing claims the URL', () => {
  it('answers NO_MATCH with nothing to point at', () => {
    expect(matchUrl('https://example.com/about', [rule('p', 'PRODUCT', '**/p/*')])).toEqual({
      kind: null,
      patternId: null,
      reason: 'NO_MATCH',
    })
  })

  it('answers NO_MATCH for a source with no patterns configured', () => {
    expect(matchUrl('https://example.com/p/lamp', []).reason).toBe('NO_MATCH')
  })

  it('reports a PAGINATION match as a match, with its own kind', () => {
    const result = matchUrl('https://example.com/shop?page=3', [
      rule('pages', 'PAGINATION', '**?page=*'),
    ])
    expect(result).toEqual({ kind: 'PAGINATION', patternId: 'pages', reason: 'MATCHED' })
  })
})

describe('the per-URL time budget', () => {
  const url = 'https://example.com/p/lamp'
  const rules = [rule('product', 'PRODUCT', '**/p/*')]

  /**
   * A CATASTROPHICALLY BACKTRACKING REGEX, AGAINST A URL A THIRD PARTY CHOSE, IS A DENIAL OF
   * SERVICE AIMED AT RIVYA'S OWN CRON FUNCTION. The budget is what bounds the list; the
   * 200-character cap in `compilePattern` is what makes any single expression unlikely to need it.
   */
  it('stops once the budget is spent', () => {
    const result = matchUrl(url, rules, { now: clock(0, MATCH_BUDGET_MS + 1) })
    expect(result.reason).toBe('BUDGET_EXCEEDED')
  })

  it('reports nothing to point at when the budget is spent', () => {
    const result = matchUrl(url, rules, { now: clock(0, MATCH_BUDGET_MS + 1) })
    expect(result.kind).toBeNull()
    expect(result.patternId).toBeNull()
  })

  it('treats exactly the budget as spent', () => {
    const result = matchUrl(url, rules, { now: clock(0, MATCH_BUDGET_MS) })
    expect(result.reason).toBe('BUDGET_EXCEEDED')
  })

  it('matches normally one millisecond inside the budget', () => {
    const result = matchUrl(url, rules, { now: clock(0, MATCH_BUDGET_MS - 1) })
    expect(result.reason).toBe('MATCHED')
  })

  it('gives up in the EXCLUDE pass rather than falling through to a match', () => {
    // The dangerous shape: a budget spent before the refusals have been read must never end in a
    // MATCHED answer, because that is a fetch nobody checked the EXCLUDE rules for.
    const result = matchUrl(
      url,
      [rule('exclude', 'EXCLUDE', '**/never/**'), rule('product', 'PRODUCT', '**/p/*')],
      { now: clock(0, MATCH_BUDGET_MS + 5) },
    )
    expect(result.reason).toBe('BUDGET_EXCEEDED')
  })

  it('answers normally when the clock never advances', () => {
    expect(matchUrl(url, rules, { now: () => 1_000 }).reason).toBe('MATCHED')
  })

  it('uses the wall clock when no clock is injected', () => {
    expect(matchUrl(url, rules).reason).toBe('MATCHED')
  })
})

describe('the host rule', () => {
  const base = 'https://example.com'

  it('passes a relative pattern, which cannot name a host', () => {
    expect(hostMatchesBase('/product/*', base)).toBe(true)
  })

  it('passes a pattern that is only a shape', () => {
    expect(hostMatchesBase('**/p/*', base)).toBe(true)
  })

  it('passes an absolute pattern on the same host', () => {
    expect(hostMatchesBase('https://example.com/product/*', base)).toBe(true)
  })

  /**
   * A PATTERN POINTING AT ANOTHER HOST IS HOW A RUN WALKS OFF THE SITE SOMEBODY APPROVED. The
   * policy review is recorded against a source, and a source is a host.
   */
  it('refuses an absolute pattern on another host', () => {
    expect(hostMatchesBase('https://other.example/product/*', base)).toBe(false)
  })

  it('refuses a subdomain of the approved host', () => {
    expect(hostMatchesBase('https://shop.example.com/product/*', base)).toBe(false)
  })

  it('ignores the case of the scheme and the host', () => {
    expect(hostMatchesBase('HTTPS://EXAMPLE.COM/product/*', base)).toBe(true)
  })

  it('refuses a different port, because a different port is a different server', () => {
    expect(hostMatchesBase('https://example.com:8443/p/*', base)).toBe(false)
  })

  it('passes the loopback fixture server on its own port', () => {
    expect(hostMatchesBase('http://127.0.0.1:3999/p/*', 'http://127.0.0.1:3999')).toBe(true)
  })

  it('refuses the loopback fixture server on another port', () => {
    expect(hostMatchesBase('http://127.0.0.1:4000/p/*', 'http://127.0.0.1:3999')).toBe(false)
  })

  it('refuses a protocol-relative pattern naming another host', () => {
    expect(hostMatchesBase('//other.example/product/*', base)).toBe(false)
  })

  it('passes a protocol-relative pattern naming the same host', () => {
    expect(hostMatchesBase('//example.com/product/*', base)).toBe(true)
  })

  it('refuses a scheme the fetcher does not speak', () => {
    // Such a pattern describes URLs that can never be fetched; passing it would tell an operator
    // their configuration is sound while part of it is unreachable.
    expect(hostMatchesBase('ftp://example.com/p/*', base)).toBe(false)
  })

  it('refuses a wildcard in the host position, because a host pattern is not a host', () => {
    expect(hostMatchesBase('https://*.example.com/p/*', base)).toBe(false)
  })

  it('refuses everything when the base URL itself cannot be parsed', () => {
    expect(hostMatchesBase('/product/*', 'not a url')).toBe(false)
  })

  it('reads an anchored regular expression as relative, which is the documented gap', () => {
    // A regular expression is a notation for a SET of strings, not a URL. Parsing it as one would
    // refuse legitimate expressions (`example\.com` is not a host); the tester below is what shows
    // an operator which URLs their expression actually claims.
    expect(hostMatchesBase('^https://other\\.example/p/', base)).toBe(true)
  })
})

describe('the tester, which asks nobody anything', () => {
  const rules = [
    rule('product', 'PRODUCT', '**/p/*'),
    rule('exclude', 'EXCLUDE', '**/private/**', { priority: 100 }),
  ]

  it('returns one row per URL, in the order they were pasted', () => {
    const rows = testPatterns(
      ['https://example.com/p/a', 'https://example.com/about', 'https://example.com/p/b'],
      rules,
      always('ALLOWED'),
    )
    expect(rows.map((row) => row.url)).toEqual([
      'https://example.com/p/a',
      'https://example.com/about',
      'https://example.com/p/b',
    ])
  })

  it('keeps a duplicate rather than tidying it away', () => {
    const rows = testPatterns(
      ['https://example.com/p/a', 'https://example.com/p/a'],
      rules,
      always('ALLOWED'),
    )
    expect(rows).toHaveLength(2)
  })

  it('would fetch a matched URL that robots allows', () => {
    const [row] = testPatterns(['https://example.com/p/a'], rules, always('ALLOWED'))
    expect(row?.match.reason).toBe('MATCHED')
    expect(row?.wouldFetch).toBe(true)
  })

  /**
   * THE CASE THE SCREEN EXISTS FOR. A PRODUCT rule matched, so the configuration says yes; robots
   * says no, and no is the answer. An operator seeing `wouldFetch: true` here would be told a
   * disallowed path was in scope.
   */
  it('would NOT fetch a matched URL that robots disallows', () => {
    const [row] = testPatterns(['https://example.com/p/a'], rules, always('DISALLOWED'))
    expect(row?.match).toEqual({ kind: 'PRODUCT', patternId: 'product', reason: 'MATCHED' })
    expect(row?.robots).toBe('DISALLOWED')
    expect(row?.wouldFetch).toBe(false)
  })

  it('would fetch when there is no robots file, because no rules means nothing forbidden', () => {
    const [row] = testPatterns(['https://example.com/p/a'], rules, always('NO_ROBOTS'))
    expect(row?.wouldFetch).toBe(true)
  })

  /**
   * `wouldFetch` IS AN UPPER BOUND, NOT A PREDICTION. `permitsRequest()` in `core/robots.ts`
   * admits only ALLOWED and NO_ROBOTS, so a run would decline this URL — but a cached ERROR is a
   * transient fact about somebody else's server, and folding it in would make the same patterns
   * pass or fail depending on whether a host was unwell an hour ago. The decision is returned
   * beside the flag so the screen shows both.
   */
  it('still reports would-fetch when robots could not be read, and returns the reason beside it', () => {
    const [row] = testPatterns(['https://example.com/p/a'], rules, always('ERROR'))
    expect(row?.robots).toBe('ERROR')
    expect(row?.wouldFetch).toBe(true)
  })

  it('would not fetch an excluded URL however permissive robots is', () => {
    const [row] = testPatterns(['https://example.com/private/p/a'], rules, always('ALLOWED'))
    expect(row?.match.reason).toBe('EXCLUDED')
    expect(row?.wouldFetch).toBe(false)
  })

  it('would not fetch a URL no pattern claims', () => {
    const [row] = testPatterns(['https://example.com/about'], rules, always('ALLOWED'))
    expect(row?.match.reason).toBe('NO_MATCH')
    expect(row?.wouldFetch).toBe(false)
  })

  it('would not fetch a URL whose match ran out of budget', () => {
    const [row] = testPatterns(['https://example.com/p/a'], rules, always('ALLOWED'), {
      now: clock(0, MATCH_BUDGET_MS + 1),
    })
    expect(row?.match.reason).toBe('BUDGET_EXCEEDED')
    expect(row?.wouldFetch).toBe(false)
  })

  it('asks the robots function once per URL and no more', () => {
    const robots = vi.fn((): RobotsAnswer => 'ALLOWED')
    testPatterns(
      ['https://example.com/p/a', 'https://example.com/p/b', 'https://example.com/about'],
      rules,
      robots,
    )
    expect(robots).toHaveBeenCalledTimes(3)
  })

  it('returns nothing for an empty list', () => {
    expect(testPatterns([], rules, always('ALLOWED'))).toEqual([])
  })

  /**
   * THE BUDGET IS PER URL, NOT PER PASTED LIST. A clock advancing ten milliseconds every reading
   * runs far past the budget across five URLs; each one is judged on its own clock, so all five
   * still answer. A shared budget would be spent by the first slow URL and refuse every URL after
   * it, turning one bad pattern into a run that discovers nothing.
   */
  it('gives every URL its own budget', () => {
    const urls = [
      'https://example.com/p/a',
      'https://example.com/p/b',
      'https://example.com/p/c',
      'https://example.com/p/d',
      'https://example.com/p/e',
    ]
    const rows = testPatterns(urls, [rule('product', 'PRODUCT', '**/p/*')], always('ALLOWED'), {
      now: ticking(10),
    })
    expect(rows.map((row) => row.match.reason)).toEqual([
      'MATCHED',
      'MATCHED',
      'MATCHED',
      'MATCHED',
      'MATCHED',
    ])
  })
})

/**
 * The no-network claim, made mechanical.
 *
 * THE HEADER OF `url-patterns.ts` PROMISES THAT NOTHING IN IT MAKES A REQUEST, and a promise in a
 * comment is worth what the next edit says it is. These three read the module rather than its
 * behaviour, for the reason `no-pricing.test.ts` gives: a behavioural test asserts that today's
 * code does not fetch, which stays true right up until somebody adds a "just resolve the redirect
 * first" call to the tester.
 */
describe('no network, and the module says so', () => {
  const SOURCE = readFileSync(join(process.cwd(), 'lib/scraper/core/url-patterns.ts'), 'utf8')
  const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

  it('imports nothing at run time', () => {
    const imports = SOURCE.match(/^import .*/gm) ?? []
    expect(imports.length).toBeGreaterThan(0)
    for (const line of imports) {
      // `import type` is erased by `verbatimModuleSyntax`, so the compiled module has no imports
      // at all — which is what makes "it cannot fetch by accident" a structural fact.
      expect(line.startsWith('import type ')).toBe(true)
    }
  })

  it('contains no request-making code of any kind', () => {
    expect(CODE).not.toMatch(/(?<![A-Za-z])fetch\s*\(/)
    expect(CODE).not.toMatch(/XMLHttpRequest|WebSocket|require\(|node:|@\/lib\/supabase/)
  })

  it('carries no server-only marker, so the Studio form can reach it', () => {
    expect(CODE).not.toContain("'server-only'")
  })

  it('makes no call to a global fetch while testing a list of URLs', () => {
    const original = globalThis.fetch
    const spy = vi.fn()
    globalThis.fetch = spy as unknown as typeof globalThis.fetch
    try {
      testPatterns(
        ['https://example.com/p/a', 'https://example.com/private/x'],
        [rule('product', 'PRODUCT', '**/p/*'), rule('exclude', 'EXCLUDE', '**/private/**')],
        always('ALLOWED'),
      )
    } finally {
      globalThis.fetch = original
    }
    expect(spy).not.toHaveBeenCalled()
  })
})

/*
 * THE PATH TARGET, ADDED WITH `candidateTargets`.
 *
 * The notation's most obvious form used to be the broken one: an operator shown a source's address
 * and asked to describe its URL shapes writes a leading-slash glob, and an anchored expression
 * compiled against the whole address matched nothing, silently. These cases make sure the two
 * readings both work and that neither has widened the other.
 */
describe('a path-relative glob, which is what an operator actually writes', () => {
  it('claims a URL by its path alone', () => {
    const result = matchUrl('https://example.com/collection/tables', [
      rule('product', 'PRODUCT', '/collection/*'),
    ])
    expect(result).toEqual({ kind: 'PRODUCT', patternId: 'product', reason: 'MATCHED' })
  })

  it('still claims a URL written against the whole address', () => {
    const result = matchUrl('https://example.com/p/lamp', [rule('product', 'PRODUCT', '**/p/*')])
    expect(result.reason).toBe('MATCHED')
  })

  it('does not widen: a path glob still respects the slash rule', () => {
    const result = matchUrl('https://example.com/collection/tables/oak', [
      rule('product', 'PRODUCT', '/collection/*'),
    ])
    expect(result.reason).toBe('NO_MATCH')
  })

  it('matches a path carrying a query string, because the query is part of the target', () => {
    const result = matchUrl('https://example.com/collection/tables?page=2', [
      rule('page', 'PAGINATION', '/collection/*?page=*'),
    ])
    expect(result.reason).toBe('MATCHED')
  })

  it('lets a path-relative EXCLUDE refuse a URL a full-URL PRODUCT rule claims', () => {
    const result = matchUrl('https://example.com/account/orders', [
      rule('product', 'PRODUCT', '**', { priority: 1000 }),
      rule('exclude', 'EXCLUDE', '/account/**'),
    ])
    expect(result).toEqual({ kind: 'EXCLUDE', patternId: 'exclude', reason: 'EXCLUDED' })
  })

  it('offers only itself when the URL will not parse', () => {
    const result = matchUrl('not a url at all', [rule('product', 'PRODUCT', '/p/*')])
    expect(result.reason).toBe('NO_MATCH')
  })
})
