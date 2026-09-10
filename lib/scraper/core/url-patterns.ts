import type { RobotsDecision } from '@/lib/scraper/core/robots'

/**
 * What a URL of one source looks like — and whether Rivya would fetch it.
 *
 * NOTHING IN THIS FILE MAKES A NETWORK REQUEST, AND THAT PROHIBITION IS THE WHOLE VALUE OF THE
 * TESTER BUILT ON IT. FEAT §26's URL pattern tester answers two questions about URLs an operator
 * has pasted into a form — "would this be fetched, and would robots allow it" — and it has to
 * answer them WITHOUT ASKING ANYBODY, because the URLs being tested belong to a site nobody has
 * yet decided may be read. A tester that fetched to find out would make Rivya's first twenty
 * requests to a source the requests it made while deciding whether that source may be requested at
 * all. So `testPatterns` takes the robots verdict as a FUNCTION the caller supplies from
 * `research_robots_cache`, and this module holds no client, no `fetch`, no repository import and
 * nothing whatever to make a request with. `tests/unit/url-patterns.test.ts` reads this file's own
 * source to keep it that way.
 *
 * NO `server-only` MARKER, FOR THE REASON `core/cron.ts` AND `core/source-schema.ts` BOTH RECORD.
 * The pattern editor is a Studio form and the tester runs beside it, so both halves are reachable
 * from a Client Component; a module that throws on import inside a client bundle could not be
 * reached from either, and the alternative — a second matcher written for the form — is two
 * definitions of "does this URL count", which is precisely the drift FEAT §26 exists to prevent.
 * Purity is what makes the missing marker safe: no I/O, no database, and no ambient clock, since
 * `matchUrl` takes its `now`.
 *
 * GLOB IS THE DEFAULT AND REGEX IS OPT-IN, and that default is a safety property rather than a
 * convenience. A glob compiles to an expression that cannot backtrack catastrophically; a regex an
 * operator typed can, against a URL a third party chose. `research_source_url_patterns.is_regex`
 * defaults to `false` at the column for the same reason, so the dangerous case stays rare and
 * deliberate.
 *
 * EXCLUDE WINS, ALWAYS, WHATEVER THE PRIORITY. See `matchUrl`.
 *
 * THE BUDGET BOUNDS HOW MANY EXPRESSIONS ARE TRIED, NOT HOW LONG ONE OF THEM RUNS, and being
 * honest about that is the difference between a bound and a comforting number. JavaScript cannot
 * interrupt a regular expression mid-match, so nothing here can stop one pathological expression
 * from running for a minute; what the budget stops is a LIST of expressions from doing it once
 * each, per URL, across a queue. The bound on the single expression is the 200-character cap in
 * `compilePattern` and the glob default above.
 */

/**
 * Two hundred characters, and this is the third statement of the same number rather than the
 * first.
 *
 * `research_source_url_patterns_length_capped` in `0240` is the authority; `URL_PATTERN_MAX_LENGTH`
 * in `core/source-schema.ts` is what the drawer refuses with while the operator is still typing;
 * this one is what the MATCHER refuses with, and it is not redundant. The row check and the form
 * check both run before a pattern is stored — this check runs against whatever is stored, whenever
 * it is read, which is the only one of the three that still holds for a row written by a direct
 * SQL statement or saved before the cap existed. A pathological expression is a denial of service
 * aimed at Rivya's own cron function; the length cap is the one bound that holds whatever the
 * expression says.
 */
export const URL_PATTERN_MAX_LENGTH = 200

/**
 * Twenty-five milliseconds of matching per URL, then stop and say so.
 *
 * PER URL, NOT PER RUN OR PER BATCH. A run drains thousands of URLs through this matcher, and a
 * budget shared across them would be spent by the first slow one and refuse every URL after it —
 * turning one bad pattern into a run that discovers nothing and reports no reason. Each URL starts
 * its own clock; a URL that overruns is reported `BUDGET_EXCEEDED` and the next one is judged on
 * its own merits.
 *
 * TWENTY-FIVE IS GENEROUS FOR THE HONEST CASE, WHICH IS THE POINT. A source with a dozen sane
 * patterns spends microseconds here, so the budget is invisible until something is wrong; when it
 * does bite, what it caught was never going to be a healthy configuration.
 */
export const MATCH_BUDGET_MS = 25

/**
 * The four kinds, as `0240`'s CHECK allowlists them.
 *
 * Restated here rather than imported from `core/source-schema.ts` because that module is the
 * validation boundary and this one is the matcher: a matcher that could not run without the Zod
 * schema loaded would drag zod into every caller for four string literals. The two are held to
 * each other structurally — a `UrlPatternKind` from either module is assignable to the other — and
 * by the CHECK they both copy.
 */
export type UrlPatternKind = 'PRODUCT' | 'CATEGORY' | 'EXCLUDE' | 'PAGINATION'

/** One stored `research_source_url_patterns` row, reduced to what matching actually needs. */
export interface SourceUrlPattern {
  readonly id: string
  readonly kind: UrlPatternKind
  readonly pattern: string
  readonly isRegex: boolean
  readonly priority: number
}

/**
 * Why the matcher answered as it did.
 *
 * `NO_MATCH` AND `BUDGET_EXCEEDED` ARE NOT THE SAME ANSWER and are deliberately not folded
 * together. The first says the configuration has nothing to say about this URL; the second says
 * the configuration could not be read in time, which is an operator's problem to fix rather than a
 * fact about the URL. Both end in the URL not being fetched, and only one of them should send
 * somebody to look at the patterns.
 */
export type UrlMatchReason = 'EXCLUDED' | 'MATCHED' | 'NO_MATCH' | 'BUDGET_EXCEEDED'

export interface UrlMatch {
  readonly kind: UrlPatternKind | null
  readonly patternId: string | null
  readonly reason: UrlMatchReason
}

/**
 * The outcome of compiling one pattern. NEVER A THROW — see `compilePattern`.
 */
export type CompiledPattern =
  { readonly ok: true; readonly regex: RegExp } | { readonly ok: false; readonly reason: string }

/** One row of the tester's table. */
export interface TestedUrl {
  readonly url: string
  readonly match: UrlMatch
  readonly robots: RobotsDecision
  readonly wouldFetch: boolean
}

/* --- 1. The glob grammar ------------------------------------------------------------------------ */

/**
 * The characters that mean something to `RegExp` and must not be allowed to mean it here.
 *
 * `/` is escaped along with the rest although a `RegExp` constructor does not require it, so that
 * the `.source` this module produces can be pasted into a regex literal — which is exactly what an
 * operator does when a glob has taken them as far as it goes and they tick `is_regex`.
 */
const REGEX_METACHARACTER = /[.*+?^${}()|[\]\\/]/

function escapeLiteral(char: string): string {
  return REGEX_METACHARACTER.test(char) ? `\\${char}` : char
}

/**
 * Compile a glob into an anchored regular expression.
 *
 * THE GRAMMAR IS THREE RULES AND EVERY OTHER CHARACTER IS A LITERAL. `*` matches any run of
 * characters except `/`; `**` matches any run including `/`; `?` matches exactly one character
 * that is not `/`. The slash exclusion is what makes a glob describe a URL rather than a string:
 * `/product/*` is "one path segment under /product", which is what an operator means and what
 * `.*` would silently widen to include `/product/a/b/c` and every page beneath it. A PRODUCT rule
 * widened that way starts fetching a whole site; an EXCLUDE rule widened that way is harmless,
 * which is precisely why the widening must not be automatic — it is only ever safe in one
 * direction and the matcher cannot know which one the operator meant.
 *
 * ANCHORED AT BOTH ENDS, ALWAYS. A glob has no notation for "anywhere in the string", so an
 * unanchored glob would make `product` match `https://example.com/not-a-product-page`, and there
 * would be no way to write the rule that does not. `**` at either end is how an operator asks for
 * the loose reading, deliberately and visibly.
 *
 * NO FLAGS, AND `g` IN PARTICULAR IS NEVER SET. A global regular expression carries `lastIndex`
 * between calls, so the same pattern tested twice against the same URL answers differently the
 * second time. Matching is not case-folded either: a URL path is case-sensitive per RFC 3986, and
 * folding it here would quietly declare `/Products/x` and `/products/x` the same page at a host
 * that may serve two different ones.
 */
export function globToRegExp(glob: string): RegExp {
  let source = '^'
  let index = 0

  while (index < glob.length) {
    const char = glob[index]!

    if (char === '*') {
      // A run of three or more stars reads as `**` followed by whatever is left, which matches the
      // same set of strings as `**`. Nothing needs to be done about it beyond not crashing.
      if (glob[index + 1] === '*') {
        source += '.*'
        index += 2
        continue
      }
      source += '[^/]*'
      index += 1
      continue
    }

    if (char === '?') {
      source += '[^/]'
      index += 1
      continue
    }

    source += escapeLiteral(char)
    index += 1
  }

  return new RegExp(`${source}$`)
}

/* --- 2. Compiling one stored row ---------------------------------------------------------------- */

/**
 * Turn one stored pattern into the expression that matches it, or say why it cannot be one.
 *
 * THIS FUNCTION NEVER THROWS, BECAUSE ITS CALLER IS A FORM. The pattern editor calls it on every
 * keystroke to tell an operator what is wrong with what they are typing, and `matchUrl` calls it
 * on rows already in the database. A thrown `SyntaxError` from `new RegExp` would be an unhandled
 * exception in a Server Action for the first case and a crashed cron invocation for the second —
 * for an input a person is allowed to get wrong.
 *
 * THREE REFUSALS, AND THE LENGTH ONE IS NOT COSMETIC. An empty pattern would compile to `^$` and
 * match nothing but the empty string, which reads as "this rule is off" rather than "this rule is
 * broken". A pattern over the cap is refused here as well as at the row and at the form, for the
 * reason `URL_PATTERN_MAX_LENGTH` records. And a regex `new RegExp` will not accept is returned
 * as a sentence rather than a stack trace, because somebody has to read it.
 *
 * A REGEX IS NOT ANCHORED AND A GLOB ALWAYS IS. Regular expressions are a notation with settled
 * conventions, and `test()` on an unanchored expression matching anywhere in the string is the
 * settled one; silently wrapping an operator's expression in `^…$` would change what a notation
 * they already know means, and would break the very expressions that motivated ticking the box.
 * `^` and `$` are available to anybody who wants them.
 */
export function compilePattern(pattern: SourceUrlPattern): CompiledPattern {
  const text = pattern.pattern

  if (text.trim() === '') {
    return { ok: false, reason: 'A pattern cannot be empty.' }
  }

  if (text.length > URL_PATTERN_MAX_LENGTH) {
    return {
      ok: false,
      reason: `A pattern is at most ${URL_PATTERN_MAX_LENGTH} characters; this one is ${text.length}.`,
    }
  }

  try {
    return { ok: true, regex: pattern.isRegex ? new RegExp(text) : globToRegExp(text) }
  } catch (error) {
    // The glob branch cannot reach this today — every character it emits is either a fixed
    // fragment or an escaped literal — but the catch covers both branches so that the promise in
    // this function's name does not depend on that argument staying true after an edit.
    const detail = error instanceof Error ? error.message : String(error)
    return { ok: false, reason: `This is not a valid regular expression: ${detail}` }
  }
}

/* --- 3. Matching one URL ------------------------------------------------------------------------ */

/**
 * The tie-break order after `priority`: PRODUCT, then CATEGORY, then PAGINATION.
 *
 * EXCLUDE IS RANKED LAST AND NEVER REACHES THIS COMPARISON, because it is decided in a pass of its
 * own before any of these are considered. It is given a rank anyway so that the comparator is a
 * total order over every value the type admits rather than a function with a hole in it.
 */
const KIND_RANK: Record<UrlPatternKind, number> = {
  PRODUCT: 0,
  CATEGORY: 1,
  PAGINATION: 2,
  EXCLUDE: 3,
}

/**
 * Highest priority first, then kind, then pattern text, then id.
 *
 * THE LAST TWO KEYS EXIST TO MAKE THE ANSWER DETERMINISTIC RATHER THAN MERELY STABLE. Two rows
 * that agree on priority and kind are ordered by their pattern text, and two rows that agree on
 * all three — possible only across sources, since `(source_id, kind, pattern)` is unique — by
 * their id. The comparator therefore never returns 0 for two different rows, so the result does
 * not depend on the engine's sort being stable, nor on the order PostgREST happened to return the
 * rows in. An operator who reports "it matched the wrong rule" must be able to be shown the same
 * answer twice.
 */
function comparePatterns(a: SourceUrlPattern, b: SourceUrlPattern): number {
  if (a.priority !== b.priority) return b.priority - a.priority
  if (a.kind !== b.kind) return KIND_RANK[a.kind] - KIND_RANK[b.kind]
  if (a.pattern !== b.pattern) return a.pattern < b.pattern ? -1 : 1
  if (a.id !== b.id) return a.id < b.id ? -1 : 1
  return 0
}

const defaultNow = (): number => Date.now()

/**
 * The strings one URL is offered to a pattern as.
 *
 * TWO, AND THE SECOND IS WHAT MAKES THE NOTATION USABLE. A glob is anchored at both ends, so
 * `/collection/*` compiled against the whole address `https://host/collection/tables` matches
 * nothing — the expression begins at `/` and the string begins at `h`. An operator who has just
 * been shown a source's `base_url` and asked to describe its URL shapes writes exactly that
 * pattern, every time, and the failure it produces is the worst kind: no error, no match, and a
 * discovery run that queues nothing for a reason nobody can see. Requiring a leading double star
 * instead would be a notation whose most obvious form is wrong.
 *
 * So a pattern is tested against the ABSOLUTE URL and against the PATH-AND-QUERY, and matching
 * either is a match. A double-star prefix claims the first; a leading slash claims the second;
 * both mean what their author meant.
 *
 * IT WIDENS ONLY TOWARDS WHAT WAS WRITTEN DOWN. The second target is not a looser reading of the
 * pattern — it is the same anchored expression against a shorter string, so nothing matches that
 * the operator did not describe. And it is applied to EXCLUDE rules first, where widening is
 * always the safe direction, before any PRODUCT rule is considered at all.
 *
 * A URL THAT WILL NOT PARSE OFFERS ONLY ITSELF. That is the honest fallback: the path of an
 * unparseable address is not a thing this module is entitled to guess at.
 */
function candidateTargets(url: string): readonly string[] {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return [url]
  }
  const pathAndQuery = `${parsed.pathname}${parsed.search}`
  return pathAndQuery === url ? [url] : [url, pathAndQuery]
}

const BUDGET_EXCEEDED: UrlMatch = { kind: null, patternId: null, reason: 'BUDGET_EXCEEDED' }
const NO_MATCH: UrlMatch = { kind: null, patternId: null, reason: 'NO_MATCH' }

/**
 * Which pattern claims this URL, if any.
 *
 * EXCLUDE WINS, ALWAYS, WHATEVER THE PRIORITY, and that is why there are two passes rather than
 * one sorted list. Every EXCLUDE is evaluated first and a match returns immediately; no `priority`
 * a person can type lets a PRODUCT rule beat one. Folding the kinds into a single ordering would
 * make the priority column a way to CONFIGURE A REFUSAL AWAY — somebody could raise a PRODUCT rule
 * to 1000 and start fetching the paths an earlier reviewer wrote an EXCLUDE for, with nothing in
 * the audit trail saying a refusal had been overridden, because as far as the matcher was
 * concerned none had been. A refusal that a number can outrank is not a refusal.
 *
 * AN EXCLUDE THAT WILL NOT COMPILE STILL EXCLUDES. It is the one place this module refuses to
 * treat a broken row as absent, and the direction is the point: skipping a broken PRODUCT rule
 * means matching less and therefore fetching less, while skipping a broken EXCLUDE means fetching
 * a path somebody wrote a rule to keep Rivya out of. A refusal we cannot read is still a refusal
 * somebody made. The row is reported by id so the tester names the pattern that needs fixing
 * rather than leaving an operator to guess which of the four is malformed.
 *
 * THE CLOCK IS INJECTED so this is a pure function of its arguments, testable to the millisecond
 * and identical in a cron invocation and in a test. `Date.now()` is the default rather than the
 * mechanism.
 */
export function matchUrl(
  url: string,
  patterns: readonly SourceUrlPattern[],
  options?: { readonly now?: () => number },
): UrlMatch {
  const now = options?.now ?? defaultNow
  const startedAt = now()
  const budgetSpent = (): boolean => now() - startedAt >= MATCH_BUDGET_MS

  const ordered = [...patterns].sort(comparePatterns)
  const targets = candidateTargets(url)
  const claims = (regex: RegExp): boolean => targets.some((target) => regex.test(target))

  // Pass one: the refusals.
  for (const pattern of ordered) {
    if (pattern.kind !== 'EXCLUDE') continue
    if (budgetSpent()) return BUDGET_EXCEEDED

    const compiled = compilePattern(pattern)
    if (!compiled.ok || claims(compiled.regex)) {
      return { kind: 'EXCLUDE', patternId: pattern.id, reason: 'EXCLUDED' }
    }
  }

  // Pass two: the claims, highest priority first.
  for (const pattern of ordered) {
    if (pattern.kind === 'EXCLUDE') continue
    if (budgetSpent()) return BUDGET_EXCEEDED

    const compiled = compilePattern(pattern)
    // A rule that cannot be compiled is skipped rather than fatal: one malformed PRODUCT pattern
    // must not make every URL of a source unmatchable, and skipping it errs towards fetching less.
    if (!compiled.ok) continue

    if (claims(compiled.regex)) {
      return { kind: pattern.kind, patternId: pattern.id, reason: 'MATCHED' }
    }
  }

  return NO_MATCH
}

/* --- 4. The host rule --------------------------------------------------------------------------- */

/** An absolute URL, or a protocol-relative one — anything that can name a host of its own. */
const NAMES_A_HOST = /^(?:[A-Za-z][A-Za-z0-9+.-]*:)?\/\//

function parseOrNull(value: string, base?: string): URL | null {
  try {
    return base === undefined ? new URL(value) : new URL(value, base)
  } catch {
    return null
  }
}

/**
 * Does this pattern stay on the site somebody approved?
 *
 * FEAT §26 FIELD 2 SAYS THE BASE URL'S HOST MUST MATCH EVERY PATTERN'S HOST, and the reason is the
 * failure it prevents: a pattern pointing at another host is how a run walks off the site a policy
 * review approved and onto one nobody has read the terms of. That review is recorded against a
 * source, and a source is a host; a pattern that names a different one is asking for permission
 * that was never granted to be applied to a site it was never granted for.
 *
 * A RELATIVE PATTERN ALWAYS PASSES, because it cannot name a host — `/product/*` is a shape, and
 * whatever it is matched against supplies the host. Almost every pattern an operator writes is
 * this one, which is why the check is a narrow guard against a pasted absolute URL rather than a
 * hurdle in the ordinary path.
 *
 * PORT INCLUDED, DELIBERATELY. `host` rather than `hostname`, so `example.com:8443` does not match
 * a base of `example.com`: a different port is a different server, whatever the name says. The
 * case that makes this matter is the loopback fixture server `0240` admits `http://` for — two
 * ports on `127.0.0.1` are two different test servers and must not be interchangeable.
 *
 * A SCHEME THAT IS NOT http(s) IS REFUSED rather than ignored. The fetcher speaks nothing else, so
 * such a pattern describes URLs that can never be fetched; passing it would tell an operator their
 * configuration is sound when part of it is unreachable.
 *
 * THE KNOWN GAP IS A REGEX. A regular expression is a notation for a SET of strings, not a URL, so
 * one beginning `^https://…` is read here as relative and passes. Parsing it as a URL would refuse
 * legitimate expressions — `example\.com` is not a host — and refusing every regex outright would
 * make the safer notation the harder one to use. What covers the gap is the tester below, which
 * shows an operator exactly which URLs their expression claims, and the run-time robots check,
 * which is answered per host: a pattern naming a foreign host cannot borrow the approved host's
 * permission, because that host's own robots.txt is what will be consulted.
 */
export function hostMatchesBase(pattern: string, baseUrl: string): boolean {
  const base = parseOrNull(baseUrl)
  // No base to match against is not a pass. A source with an unparseable `base_url` should fail
  // its own validation; until it does, nothing is approved and nothing here should say otherwise.
  if (base === null) return false

  const candidate = pattern.trim()
  if (!NAMES_A_HOST.test(candidate)) return true

  // The base is passed so a protocol-relative `//host/path` resolves with the source's own scheme
  // and its own host — which is exactly the case this function has to catch.
  const target = parseOrNull(candidate, baseUrl)
  if (target === null) return false
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return false

  // `URL` already lower-cases a host; the fold is stated rather than assumed, because the rule is
  // "case-insensitive" and a reader should not have to know the parser to see that it holds.
  return target.host.toLowerCase() === base.host.toLowerCase()
}

/* --- 5. The tester, which asks nobody anything -------------------------------------------------- */

/**
 * Answer, for each pasted URL: which pattern claims it, what robots.txt said, and whether a run
 * would fetch it.
 *
 * `robots` IS A FUNCTION THE CALLER SUPPLIES, and it is the reason this module cannot fetch even
 * by accident: there is nothing here to fetch with. The Studio action reads
 * `research_robots_cache` through a repository, closes over the answer and passes it in; a cache
 * miss is that caller's decision to report (`NO_ROBOTS` is a fact about a site, not a missing
 * row), which is a decision that belongs beside the cache rather than inside a matcher.
 *
 * `wouldFetch` IS AN UPPER BOUND ON WHAT A RUN WOULD DO, NEVER AN UNDER-STATEMENT. It is true when
 * a non-EXCLUDE pattern matched and robots did not say DISALLOWED — so an `ERROR` verdict reads as
 * would-fetch here, while `permitsRequest()` in `core/robots.ts` admits only `ALLOWED` and
 * `NO_ROBOTS` and the fetcher will in fact refuse it. That asymmetry is deliberate. This screen
 * exists to test PATTERNS, and folding a transient fact about somebody else's server into its
 * answer would make the same configuration pass or fail depending on whether a host was unwell an
 * hour ago — sending an operator to debug their patterns over a cached 503. The robots column is
 * returned beside `wouldFetch` precisely so the screen can show both, and the direction of the
 * looseness is the safe one: nothing is ever marked would-fetch that a run would decline to fetch
 * for a reason the operator cannot see.
 *
 * ONE ROW PER URL, IN THE ORDER THEY WERE PASTED, DUPLICATES INCLUDED. An operator pastes a list
 * out of a spreadsheet and reads the answers against it; silently de-duplicating or reordering
 * would break that correspondence, and a URL that appears twice is a thing worth seeing.
 */
export function testPatterns(
  urls: readonly string[],
  patterns: readonly SourceUrlPattern[],
  robots: (url: string) => RobotsDecision,
  options?: { readonly now?: () => number },
): readonly TestedUrl[] {
  return urls.map((url) => {
    // Each URL is matched under its own budget — see MATCH_BUDGET_MS.
    const match = matchUrl(url, patterns, options)
    const decision = robots(url)

    return {
      url,
      match,
      robots: decision,
      wouldFetch: match.reason === 'MATCHED' && decision !== 'DISALLOWED',
    }
  })
}
