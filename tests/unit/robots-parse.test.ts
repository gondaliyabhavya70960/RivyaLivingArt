import { describe, expect, it } from 'vitest'

import {
  EMPTY_RULES,
  MAX_CRAWL_DELAY_S,
  agentToken,
  effectiveDelayMs,
  hostOf,
  isAllowedByRules,
  isExpired,
  matchesRobotsPattern,
  parseRobots,
  permitsRequest,
} from '@/lib/scraper/core/robots'

/**
 * robots.txt, and the direction every ambiguity resolves in.
 *
 * THE ASSERTION THIS FILE EXISTS FOR is that every uncertain case makes Rivya fetch LESS. A file
 * we cannot parse, an agent block we do not match, a pattern we cannot compile, a host that will
 * not answer — each one must end in fewer requests, never more. A parser that is merely "correct"
 * on well-formed input is not enough here, because the input is written by strangers and the cost
 * of being wrong is somebody else's server.
 */

describe('grouping', () => {
  it('applies the wildcard block when no agent matches', () => {
    const rules = parseRobots('User-agent: *\nDisallow: /private', 'rivya-research')
    expect(rules.disallow).toEqual(['/private'])
  })

  it('prefers the specific agent over the wildcard, and does NOT merge them', () => {
    const body = [
      'User-agent: *',
      'Disallow: /',
      '',
      'User-agent: rivya-research',
      'Disallow: /admin',
    ].join('\n')
    const rules = parseRobots(body, 'rivya-research')
    // NOT ['/', '/admin']. A site that blocks everyone and then names us is permitting us; merging
    // would keep the `/` and leave us fetching nothing, which is the harmless direction — but the
    // MIRROR case is the dangerous one, and it is the next test.
    expect(rules.disallow).toEqual(['/admin'])
  })

  it('honours a block aimed at us over a permissive wildcard', () => {
    const body = [
      'User-agent: rivya-research',
      'Disallow: /',
      '',
      'User-agent: *',
      'Disallow:',
    ].join('\n')
    const rules = parseRobots(body, 'rivya-research')
    // THE CASE THAT MATTERS. Somebody has specifically asked us to leave. Merging or preferring
    // the wildcard would have us crawling a site whose owner named us and said no.
    expect(rules.disallow).toEqual(['/'])
    expect(isAllowedByRules(rules, 'https://example.com/anything')).toBe(false)
  })

  it('shares one rule block between consecutive agent lines', () => {
    const body = ['User-agent: alpha', 'User-agent: rivya-research', 'Disallow: /x'].join('\n')
    expect(parseRobots(body, 'rivya-research').disallow).toEqual(['/x'])
  })

  it('starts a new group when an agent line follows a rule', () => {
    const body = [
      'User-agent: alpha',
      'Disallow: /a',
      'User-agent: rivya-research',
      'Disallow: /b',
    ].join('\n')
    // Getting this wrong merges every group in the file into one — in this case applying alpha's
    // restrictions to us as well.
    expect(parseRobots(body, 'rivya-research').disallow).toEqual(['/b'])
  })

  it('ignores a rule that appears before any user-agent line', () => {
    expect(parseRobots('Disallow: /orphan\nUser-agent: *\nDisallow: /x', '*').disallow).toEqual([
      '/x',
    ])
  })
})

describe('directives', () => {
  it('reads an empty Disallow as "nothing is disallowed", not as "everything"', () => {
    const rules = parseRobots('User-agent: *\nDisallow:', '*')
    // AN EMPTY PREFIX WOULD MATCH EVERY URL. Storing it would invert the file's meaning entirely.
    expect(rules.disallow).toEqual([])
    expect(isAllowedByRules(rules, 'https://example.com/anything')).toBe(true)
  })

  it('strips comments without treating a comment line as a group break', () => {
    const body = ['User-agent: *  # us', '# a note', 'Disallow: /x  # why'].join('\n')
    expect(parseRobots(body, '*').disallow).toEqual(['/x'])
  })

  it('reads Crawl-delay and caps a preposterous one', () => {
    expect(parseRobots('User-agent: *\nCrawl-delay: 10', '*').crawlDelaySeconds).toBe(10)
    expect(parseRobots('User-agent: *\nCrawl-delay: 999999', '*').crawlDelaySeconds).toBe(
      MAX_CRAWL_DELAY_S,
    )
  })

  it('ignores a Crawl-delay that is not a number', () => {
    expect(parseRobots('User-agent: *\nCrawl-delay: soon', '*').crawlDelaySeconds).toBeNull()
  })

  it('survives a malformed file rather than throwing', () => {
    const body = 'not a directive\n\x00\x01\nUser-agent\nDisallow /x\n:::'
    expect(() => parseRobots(body, '*')).not.toThrow()
    expect(parseRobots(body, '*')).toEqual(EMPTY_RULES)
  })

  it('treats a file with no groups as no rules', () => {
    expect(parseRobots('', '*')).toEqual(EMPTY_RULES)
  })
})

describe('matching', () => {
  it('matches a prefix', () => {
    expect(matchesRobotsPattern('/private', '/private/thing')).toBe(true)
    expect(matchesRobotsPattern('/private', '/public')).toBe(false)
  })

  it('supports * and a trailing $', () => {
    expect(matchesRobotsPattern('/*/edit', '/things/edit')).toBe(true)
    expect(matchesRobotsPattern('/x$', '/x')).toBe(true)
    expect(matchesRobotsPattern('/x$', '/x/y')).toBe(false)
  })

  it('treats regex metacharacters in a pattern as literals', () => {
    // A ROBOTS FILE IS NOT A REGEX. Without escaping, a third party could write a pattern that
    // backtracks catastrophically and hang the fetcher — a denial of service delivered through a
    // politeness file.
    expect(matchesRobotsPattern('/a+b', '/a+b')).toBe(true)
    expect(matchesRobotsPattern('/a+b', '/aaab')).toBe(false)
    expect(matchesRobotsPattern('/(x)', '/(x)')).toBe(true)
  })

  it('refuses a URL it cannot parse rather than permitting it', () => {
    expect(isAllowedByRules({ ...EMPTY_RULES, disallow: [] }, 'not a url')).toBe(false)
  })

  it('gives the longest match precedence, and a tie to Allow', () => {
    const rules = { disallow: ['/p'], allow: ['/p/public'], crawlDelaySeconds: null }
    expect(isAllowedByRules(rules, 'https://e.com/p/private')).toBe(false)
    expect(isAllowedByRules(rules, 'https://e.com/p/public/x')).toBe(true)

    const tie = { disallow: ['/x'], allow: ['/x'], crawlDelaySeconds: null }
    expect(isAllowedByRules(tie, 'https://e.com/x')).toBe(true)
  })

  it('matches against the query string as well as the path', () => {
    const rules = { disallow: ['/search?'], allow: [], crawlDelaySeconds: null }
    expect(isAllowedByRules(rules, 'https://e.com/search?q=1')).toBe(false)
    expect(isAllowedByRules(rules, 'https://e.com/search')).toBe(true)
  })
})

describe('the crawl delay is a floor', () => {
  it('slows a source configured faster than the host asked', () => {
    expect(effectiveDelayMs(3000, 10)).toBe(10_000)
  })

  it('never speeds one up', () => {
    // THE ASSERTION THE WHOLE DIRECTIVE HANGS ON. Crawl-delay is not in the RFC; honouring it as
    // anything other than a floor would let a third party's file make Rivya faster.
    expect(effectiveDelayMs(30_000, 5)).toBe(30_000)
  })

  it('leaves the configured delay alone when the host said nothing', () => {
    expect(effectiveDelayMs(3000, null)).toBe(3000)
  })
})

describe('decisions', () => {
  it('permits only ALLOWED and NO_ROBOTS', () => {
    expect(permitsRequest('ALLOWED')).toBe(true)
    expect(permitsRequest('NO_ROBOTS')).toBe(true)
    // A HOST TOO UNWELL TO SERVE A SMALL TEXT FILE is not one to start requesting pages from.
    expect(permitsRequest('ERROR')).toBe(false)
    expect(permitsRequest('DISALLOWED')).toBe(false)
  })
})

describe('helpers', () => {
  it('takes the product token out of a full agent string', () => {
    expect(agentToken('Rivya-Research/1.0 (+https://rivya.example/bot)')).toBe('rivya-research')
  })

  it('lower-cases a host and returns null for a non-URL', () => {
    expect(hostOf('https://Example.COM/x')).toBe('example.com')
    expect(hostOf('nonsense')).toBeNull()
  })

  it('treats a cache row at its expiry as expired', () => {
    const at = new Date('2026-01-01T00:00:00Z')
    expect(isExpired({ expires_at: at.toISOString() }, at)).toBe(true)
    expect(isExpired({ expires_at: new Date(at.getTime() + 1).toISOString() }, at)).toBe(false)
  })
})
