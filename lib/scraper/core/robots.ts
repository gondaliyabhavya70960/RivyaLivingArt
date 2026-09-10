import { z } from 'zod'

/**
 * robots.txt: fetch it, read it, and let it say no.
 *
 * THIS FILE IS THE POSTURE, NOT A FORMALITY. Every rule below resolves ambiguity in the direction
 * of fetching LESS. A file we could not parse, a host that timed out, a `Crawl-delay` we do not
 * understand — each one makes Rivya slower or stops it, never the reverse. That asymmetry is the
 * whole design: a bug in a politeness control must fail towards politeness, because the cost of
 * being wrong in the other direction is somebody else's server.
 *
 * WHAT THE STANDARD ACTUALLY SAYS, AND WHERE THIS DEPARTS FROM IT. RFC 9309 gives the longest
 * matching rule precedence and breaks a tie in favour of ALLOW. This implementation follows both.
 * It departs from the RFC in exactly one place, deliberately: a `Crawl-delay` directive is not in
 * the RFC at all, but it is widely served and widely meant, so it is honoured as a FLOOR on the
 * configured delay. A source configured faster than robots asks is slowed; one configured slower
 * is left alone. Never the reverse — that is the point of calling it a floor.
 *
 * NO ROBOTS FILE IS NOT PERMISSION TO HURRY. A 404 means there are no rules, so nothing is
 * disallowed; it does not mean the host wants traffic, so the source's own delay still applies in
 * full. A 5xx or a timeout is different again and is treated as ERROR: the host is unwell, and the
 * fetcher does not proceed on the assumption that a server too busy to serve a 40-byte text file
 * would like several product pages instead.
 */

/** What robots.txt said about one URL. Recorded on every `research_fetches` row. */
export type RobotsDecision = 'ALLOWED' | 'DISALLOWED' | 'NO_ROBOTS' | 'ERROR'

export const ROBOTS_TTL_HOURS = 24

/**
 * The longest `Crawl-delay` this repository will honour, in seconds.
 *
 * NOT A WAY TO IGNORE A HOST — it is a guard against a malformed file. A `Crawl-delay: 86400`
 * (whether meant, mistyped or hostile) would park a run for a day holding leases; capping it at an
 * hour means such a source is effectively unfetchable within any run, which is the correct outcome,
 * while a garbled value cannot wedge the queue. The database enforces the same ceiling.
 */
export const MAX_CRAWL_DELAY_S = 3600

/** One agent's block, already narrowed to the rules that apply. */
export interface RobotsRules {
  /** Path prefixes that may not be fetched. An empty string means "the whole site is allowed". */
  readonly disallow: readonly string[]
  /** Path prefixes explicitly permitted, which can carve an exception out of a `Disallow`. */
  readonly allow: readonly string[]
  /** Seconds between requests this host asks for, if it said. */
  readonly crawlDelaySeconds: number | null
}

export const EMPTY_RULES: RobotsRules = { disallow: [], allow: [], crawlDelaySeconds: null }

/**
 * Parse a robots.txt body into the rules that apply to one agent.
 *
 * THE GROUPING RULE IS THE PART THAT IS EASY TO GET WRONG. Consecutive `User-agent` lines share
 * one block of rules — `User-agent: a` / `User-agent: b` / `Disallow: /x` disallows `/x` for both —
 * and a `Disallow` line ENDS the run of agent names, so a `User-agent` after it starts a new
 * group. Getting that wrong merges every group in the file into one, which in practice means
 * applying Googlebot's restrictions to everybody or, far worse, applying nobody's.
 *
 * THE SPECIFIC AGENT WINS OUTRIGHT OVER `*`, and does not merge with it. That is what the standard
 * says, and it matters in the direction you would not guess: a site that disallows everything for
 * `*` and permits a named crawler expects the named crawler to be permitted, and a site that
 * disallows a named agent and allows `*` expects that agent to stay out. Merging would break the
 * second case, which is the one where somebody has specifically asked us to leave.
 */
export function parseRobots(body: string, agentToken: string): RobotsRules {
  const wanted = agentToken.trim().toLowerCase()

  const groups: Array<{ agents: string[]; rules: RobotsRules }> = []
  let currentAgents: string[] = []
  let disallow: string[] = []
  let allow: string[] = []
  let crawlDelay: number | null = null
  // True while we are still reading `User-agent` lines that belong to the same group.
  let collectingAgents = false

  const flush = (): void => {
    if (currentAgents.length > 0) {
      groups.push({
        agents: [...currentAgents],
        rules: { disallow, allow, crawlDelaySeconds: crawlDelay },
      })
    }
    currentAgents = []
    disallow = []
    allow = []
    crawlDelay = null
  }

  for (const rawLine of body.split(/\r?\n/)) {
    // A `#` anywhere begins a comment, and a line that is only a comment is not a blank line —
    // it does not end a group.
    const line = rawLine.split('#')[0]?.trim() ?? ''
    if (line === '') continue

    const separator = line.indexOf(':')
    if (separator === -1) continue // Not a directive. Ignored rather than treated as an error.

    const field = line.slice(0, separator).trim().toLowerCase()
    const value = line.slice(separator + 1).trim()

    if (field === 'user-agent') {
      // A new agent line after a RULE starts a new group; after another agent line it joins this
      // one.
      if (!collectingAgents) flush()
      collectingAgents = true
      if (value !== '') currentAgents.push(value.toLowerCase())
      continue
    }

    collectingAgents = false
    if (currentAgents.length === 0) continue // A rule before any User-agent belongs to nobody.

    if (field === 'disallow') {
      // `Disallow:` WITH AN EMPTY VALUE MEANS "NOTHING IS DISALLOWED" and is the standard way to
      // say "everything is permitted". Storing it as an empty prefix would match every URL and
      // block the entire site — the exact inversion of what the file said.
      if (value !== '') disallow.push(value)
      continue
    }
    if (field === 'allow') {
      if (value !== '') allow.push(value)
      continue
    }
    if (field === 'crawl-delay') {
      const parsed = Number(value)
      if (Number.isFinite(parsed) && parsed >= 0) {
        crawlDelay = Math.min(parsed, MAX_CRAWL_DELAY_S)
      }
      continue
    }
    // Sitemap, Host and anything else: not this module's business.
  }
  flush()

  const specific = groups.find((group) => group.agents.includes(wanted))
  if (specific !== undefined) return specific.rules

  const wildcard = groups.find((group) => group.agents.includes('*'))
  return wildcard?.rules ?? EMPTY_RULES
}

/** The path-and-query a robots rule is matched against. */
function pathOf(url: string): string | null {
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return null
  }
}

/**
 * Does one robots pattern match this path?
 *
 * TWO WILDCARDS, AND THEY ARE NOT A REGULAR EXPRESSION. `*` matches any run of characters and a
 * trailing `$` anchors the end; everything else is literal. The pattern comes from a third party's
 * file, so it is escaped before the two wildcards are re-introduced — handing an unescaped remote
 * string to `new RegExp` would let a robots.txt author write a catastrophically backtracking
 * pattern and hang the fetcher, which is a denial of service delivered through a politeness file.
 */
export function matchesRobotsPattern(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$')
  const body = anchored ? pattern.slice(0, -1) : pattern

  const escaped = body.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  const expression = escaped.replace(/\*/g, '.*')

  try {
    return new RegExp(`^${expression}${anchored ? '$' : ''}`).test(path)
  } catch {
    // An unparseable pattern is not permission. A rule we cannot read is a rule we obey.
    return true
  }
}

/**
 * May this URL be fetched under these rules?
 *
 * LONGEST MATCH WINS, AND A TIE GOES TO ALLOW. RFC 9309, and both halves matter: `Disallow: /p`
 * with `Allow: /p/public` must permit the second, which only works if length decides; and
 * `Disallow: /x` with `Allow: /x` must permit, which only works if the tie-break favours allow.
 */
export function isAllowedByRules(rules: RobotsRules, url: string): boolean {
  const path = pathOf(url)
  // A URL we cannot even parse is not one we fetch.
  if (path === null) return false

  let longestDisallow = -1
  for (const pattern of rules.disallow) {
    if (matchesRobotsPattern(pattern, path)) {
      longestDisallow = Math.max(longestDisallow, pattern.length)
    }
  }
  if (longestDisallow === -1) return true

  let longestAllow = -1
  for (const pattern of rules.allow) {
    if (matchesRobotsPattern(pattern, path)) {
      longestAllow = Math.max(longestAllow, pattern.length)
    }
  }

  return longestAllow >= longestDisallow
}

/**
 * The delay to use, given what the source is configured for and what the host asked for.
 *
 * A FLOOR, EXPLICITLY. `Math.max` and not `Math.min`, and not "whichever is set". A source
 * configured at 3 s against a host asking for 10 s waits 10; a source configured at 30 s against a
 * host asking for 10 waits 30. The host can slow Rivya down and cannot speed it up, which is the
 * only reading of an unstandardised directive that is safe to act on.
 */
export function effectiveDelayMs(configuredMs: number, crawlDelaySeconds: number | null): number {
  if (crawlDelaySeconds === null) return configuredMs
  return Math.max(configuredMs, Math.round(crawlDelaySeconds * 1000))
}

/** What `research_robots_cache` stores, validated on the way back out of the database. */
export const robotsCacheRowSchema = z.object({
  host: z.string(),
  body: z.string().nullable(),
  expires_at: z.string(),
  crawl_delay_s: z.number().nullable(),
})

export type RobotsCacheRow = z.infer<typeof robotsCacheRowSchema>

/** Has this cached row passed its TTL? */
export function isExpired(row: Pick<RobotsCacheRow, 'expires_at'>, now = new Date()): boolean {
  return new Date(row.expires_at) <= now
}

/** The host a URL belongs to, lower-cased, or null if it is not a URL we can address. */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase()
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------------------------
// The cached gate: fetch robots.txt once per host per day, and answer one question about one URL.
//
// EVERYTHING ABOVE THIS LINE IS PURE and is unit-tested without a database or a network. What
// follows needs both, and is kept in the same module because "fetch, parse, cache, decide" is one
// idea and splitting it would let a caller reach the parser without the cache — which is a caller
// that re-fetches robots.txt before every request, the impolite behaviour the file exists to stop.
// ---------------------------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/database.types'
import { readRobotsCache, writeRobotsCache } from '@/lib/supabase/repositories/research/robots'

import { fetchPage, scraperUserAgent } from './fetch'

/** The token robots.txt files are matched against — the first word of the configured agent. */
export function agentToken(userAgent: string): string {
  // `Rivya-Research/1.0 (+https://…)` → `rivya-research`. Sites write `User-agent: Rivya-Research`,
  // not the whole string with its version and contact URL, so the product token is what to match.
  const first = userAgent.trim().split(/[\s/]+/)[0] ?? userAgent
  return first.toLowerCase()
}

export interface RobotsVerdict {
  readonly decision: RobotsDecision
  readonly crawlDelaySeconds: number | null
}

/**
 * May this URL be fetched?
 *
 * THE FOUR ANSWERS ARE NOT THREE PLUS AN ERROR CASE. `ALLOWED` and `DISALLOWED` are what the file
 * said. `NO_ROBOTS` means there is no file, so there are no rules and nothing is forbidden — but
 * it is recorded distinctly because "the host published no rules" and "the host permitted this"
 * are different facts, and only the second is a permission. `ERROR` means the file could not be
 * obtained, and it is treated as a refusal by the caller: a host too unwell to serve a small text
 * file is not a host to start requesting product pages from.
 */
export async function checkRobots(
  admin: SupabaseClient<Database>,
  url: string,
): Promise<RobotsVerdict> {
  const host = hostOf(url)
  if (host === null) return { decision: 'ERROR', crawlDelaySeconds: null }

  const cached = await readRobotsCache(admin, host)
  if (cached !== null && !isExpired({ expires_at: cached.expires_at })) {
    return verdictFrom(cached.body, cached.crawl_delay_s, url)
  }

  const origin = new URL(url).origin
  const outcome = await fetchPage(`${origin}/robots.txt`, { acceptHtmlOnly: false })

  if (outcome.httpStatus === 404 || outcome.httpStatus === 410) {
    // NO FILE MEANS NO RULES. Cached as an empty body so the next hundred URLs on this host do not
    // each ask again — the whole reason the cache exists.
    await writeRobotsCache(admin, { host, body: '', crawlDelaySeconds: null })
    return { decision: 'NO_ROBOTS', crawlDelaySeconds: null }
  }

  if (outcome.body === null) {
    // A NEGATIVE RESULT IS CACHED TOO. Otherwise a host that times out is asked for robots.txt
    // before every single queued URL, which is more traffic than the crawl itself would have been.
    await writeRobotsCache(admin, { host, body: null, crawlDelaySeconds: null })
    return { decision: 'ERROR', crawlDelaySeconds: null }
  }

  const rules = parseRobots(outcome.body, agentToken(scraperUserAgent()))
  await writeRobotsCache(admin, {
    host,
    body: outcome.body,
    crawlDelaySeconds: rules.crawlDelaySeconds,
  })
  return verdictFrom(outcome.body, rules.crawlDelaySeconds, url)
}

function verdictFrom(
  body: string | null,
  crawlDelaySeconds: number | null,
  url: string,
): RobotsVerdict {
  // A cached failure. Still an error, still a refusal — see the note in `checkRobots`.
  if (body === null) return { decision: 'ERROR', crawlDelaySeconds: null }
  if (body === '') return { decision: 'NO_ROBOTS', crawlDelaySeconds: null }

  const rules = parseRobots(body, agentToken(scraperUserAgent()))
  return {
    decision: isAllowedByRules(rules, url) ? 'ALLOWED' : 'DISALLOWED',
    crawlDelaySeconds: crawlDelaySeconds ?? rules.crawlDelaySeconds,
  }
}

/** Only ALLOWED and NO_ROBOTS permit a request. The other two are refusals. */
export function permitsRequest(decision: RobotsDecision): boolean {
  return decision === 'ALLOWED' || decision === 'NO_ROBOTS'
}
