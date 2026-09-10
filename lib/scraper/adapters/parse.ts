import { parse, type HTMLElement } from 'node-html-parser'

/**
 * The one place in this repository where a third party's bytes become a tree.
 *
 * IT EXISTS BECAUSE A PAGE CAN WEDGE THE CRON FUNCTION, AND ONE DID. `node-html-parser` is
 * forgiving and fast on real documents and its cost is super-quadratic in NESTING DEPTH, which is
 * the one dimension nothing else bounds. Measured on this repository's own dependency:
 *
 *     500 nested unclosed divs      29 ms
 *   1,000                           97 ms
 *   2,000                          791 ms
 *   4,000                        5,955 ms
 *
 * A hundred kilobytes of `<div>` — well inside the 2 MB body cap in `lib/scraper/core/fetch.ts`,
 * and trivially served by anybody who would like Rivya to stop crawling them — is twenty thousand
 * levels, and takes hours. The adapter contract's own malformed-input case is exactly that string,
 * and it hung the test suite indefinitely the first time the generic adapter was actually
 * registered. That is the honest version of the discovery: the bound was missing, a test that
 * existed for a different reason found it, and it is fixed here rather than by making the test
 * smaller.
 *
 * THE CPU BUDGET DOES NOT COVER THIS AND CANNOT. `lib/scraper/core/run-adapter.ts` measures how
 * long a call took and `ctx.budgetSpent()` lets a well-behaved LOOP stop itself — but the runaway
 * here is a single synchronous call INTO A DEPENDENCY, with no loop of ours to ask. JavaScript
 * cannot pre-empt it. The only defence is to refuse the input before handing it over, which is what
 * this module does.
 *
 * DEPTH IS ESTIMATED WITHOUT PARSING, in one linear pass over the tag names. That is the whole
 * trick: the expensive thing is building the tree, so the guard must not build one. Counting
 * opens and closes over-estimates depth on markup that closes tags out of order and
 * under-estimates nothing, which is the direction a refusal should err in.
 *
 * IT IS THE ONLY SANCTIONED PARSE, and `tests/unit/adapter-contract.test.ts` asserts that no file
 * under `lib/scraper/adapters/**` imports `parse` from `node-html-parser` except this one. A second
 * call site is a second place with no depth guard, and it would be added by somebody writing a
 * vendor adapter who had never met this failure.
 */

/**
 * How deep a document may nest before it is refused.
 *
 * REAL PAGES DO NOT COME NEAR IT. A heavily-templated product page nests thirty to sixty levels;
 * two hundred is generous enough that no honest document is refused and small enough that the parse
 * stays in single-digit milliseconds. The number is a ceiling on COST, not a judgement about
 * markup quality — a page refused here is recorded as unreadable rather than as malformed.
 */
export const MAX_NESTING_DEPTH = 200

/**
 * How many tags a document may contain.
 *
 * The second dimension, and a much less dangerous one — parsing is roughly linear in tag count, so
 * this is a memory bound rather than a time bound. Forty thousand elements is several times the
 * largest real catalogue page and a fraction of what the 2 MB body cap admits.
 */
export const MAX_TAG_COUNT = 40_000

/** Bytes handed to the parser. The fetcher caps the response at 2 MB; this caps what is parsed. */
export const MAX_PARSE_BYTES = 2 * 1024 * 1024

export type ParseRefusal = 'EMPTY' | 'TOO_DEEP' | 'TOO_MANY_TAGS' | 'UNPARSEABLE'

export type ParseOutcome =
  | { readonly ok: true; readonly root: HTMLElement; readonly truncated: boolean }
  | { readonly ok: false; readonly reason: ParseRefusal; readonly detail: string }

/**
 * Tags that never nest, so an unclosed one is not a level.
 *
 * WITHOUT THIS THE ESTIMATE IS USELESS ON ORDINARY PAGES. A gallery of forty `<img>` tags and a
 * `<head>` full of `<meta>` and `<link>` would count as eighty-odd unclosed levels on a document
 * nesting six, and a cap tuned to that noise would have to be so high it stopped bounding anything.
 */
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

/**
 * Elements whose CONTENT is not markup. `<script>` and `<style>` bodies routinely contain `<` and
 * comparison operators, and counting those as tags is how a page of minified JavaScript reads as a
 * thousand levels deep. Their contents are skipped to the matching close.
 */
const RAW_TEXT_ELEMENTS = new Set(['script', 'style'])

/** `<div`, `</div`, `<img/`, `<!--`. One pass, no tree, no backtracking. */
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)|<!--/g

export interface DepthEstimate {
  readonly maxDepth: number
  readonly tagCount: number
}

/**
 * The deepest nesting the markup could reach, and how many tags it holds.
 *
 * AN ESTIMATE, AND DELIBERATELY THE PESSIMISTIC ONE. It does not reconcile mismatched closes — a
 * `</p>` with no open is ignored rather than unwinding to it — so a document that closes tags out
 * of order reads as deeper than a real parser would build. That is the correct direction: the
 * number is used to REFUSE, and over-estimating refuses a page that would have been slow while
 * under-estimating admits one that hangs.
 */
export function estimateDepth(body: string): DepthEstimate {
  let depth = 0
  let maxDepth = 0
  let tagCount = 0

  TAG.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TAG.exec(body)) !== null) {
    // A comment. Skip to its close so `<!-- <div><div><div> -->` is not three levels.
    if (match[0] === '<!--') {
      const end = body.indexOf('-->', match.index + 4)
      if (end === -1) break
      TAG.lastIndex = end + 3
      continue
    }

    const closing = match[1] === '/'
    const name = (match[2] ?? '').toLowerCase()
    tagCount += 1

    if (VOID_ELEMENTS.has(name)) continue

    if (!closing && RAW_TEXT_ELEMENTS.has(name)) {
      const end = body.toLowerCase().indexOf(`</${name}`, TAG.lastIndex)
      if (end === -1) break
      TAG.lastIndex = end
      continue
    }

    if (closing) {
      if (depth > 0) depth -= 1
      continue
    }

    // A self-closing tag — `<br/>`, and the XHTML habit of writing `<div/>` — closes itself.
    const gt = body.indexOf('>', match.index)
    if (gt !== -1 && body[gt - 1] === '/') continue

    depth += 1
    if (depth > maxDepth) maxDepth = depth

    // NOTHING IS GAINED BY COUNTING FURTHER once both bounds are exceeded, and a pathological
    // document is exactly where the guard should stop early.
    if (maxDepth > MAX_NESTING_DEPTH && tagCount > MAX_TAG_COUNT) break
  }

  return { maxDepth, tagCount }
}

/**
 * Turn a page body into a tree, or say why not.
 *
 * IT NEVER THROWS. Every caller is an adapter, and an adapter's whole promise is that nothing
 * reaching it comes back out as an exception — one malformed page in a run of four hundred must
 * cost one item. A refusal here is a draft with low confidence and a recorded reason, which is a
 * thing a person can act on; an exception is a batch that stopped.
 */
export function parseDocument(body: string): ParseOutcome {
  if (body.trim() === '') {
    return { ok: false, reason: 'EMPTY', detail: 'the page had no body to read' }
  }

  const truncated = body.length > MAX_PARSE_BYTES
  const source = truncated ? body.slice(0, MAX_PARSE_BYTES) : body

  const { maxDepth, tagCount } = estimateDepth(source)

  if (maxDepth > MAX_NESTING_DEPTH) {
    return {
      ok: false,
      reason: 'TOO_DEEP',
      detail: `the markup nests at least ${String(maxDepth)} levels, past the ${String(MAX_NESTING_DEPTH)} this parser can read in bounded time`,
    }
  }

  if (tagCount > MAX_TAG_COUNT) {
    return {
      ok: false,
      reason: 'TOO_MANY_TAGS',
      detail: `the page holds at least ${String(tagCount)} tags, past the ${String(MAX_TAG_COUNT)} cap`,
    }
  }

  try {
    return { ok: true, root: parse(source), truncated }
  } catch {
    // Reached only if the library changes its mind about being forgiving. Kept because "never
    // throws" has to be true of this function whatever the dependency does next.
    return { ok: false, reason: 'UNPARSEABLE', detail: 'the page could not be parsed as html' }
  }
}
