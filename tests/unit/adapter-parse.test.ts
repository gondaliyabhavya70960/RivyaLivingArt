import { describe, expect, it } from 'vitest'

import {
  MAX_NESTING_DEPTH,
  MAX_TAG_COUNT,
  estimateDepth,
  parseDocument,
} from '@/lib/scraper/adapters/parse'

/**
 * The depth guard, and the measurement that made it necessary.
 *
 * THIS FILE EXISTS BECAUSE A TEST WRITTEN FOR SOMETHING ELSE HUNG. `tests/unit/adapter-contract.
 * test.ts` feeds every registered adapter a hundred kilobytes of unclosed `<div>` to prove that
 * malformed input produces a low-confidence draft rather than a throw — and the first time the
 * generic adapter was actually registered, the suite stopped dead. `node-html-parser` is
 * super-quadratic in nesting depth: 500 levels is 29 ms, 2,000 is 791 ms, 4,000 is nearly six
 * seconds, and twenty thousand — the contract suite's own case, and well inside the fetcher's 2 MB
 * body cap — is hours.
 *
 * SO THE INTERESTING ASSERTION IN THIS FILE IS A CLOCK. Everything else here is grammar; the one
 * that matters is that a pathological document is REFUSED IN MILLISECONDS rather than parsed
 * slowly, because "slowly" on a Vercel cron function means the invocation is killed holding its
 * leases and the next tick starts the same page again.
 *
 * THE ESTIMATE IS PESSIMISTIC ON PURPOSE and the tests say so where it shows: mismatched closes
 * are not reconciled, so a document that closes tags out of order reads as deeper than a real
 * parser would build. Over-estimating refuses a page that would have been slow; under-estimating
 * admits one that hangs. Only one of those is recoverable.
 */

const nest = (n: number, tag = 'div'): string => `<${tag}>`.repeat(n)

describe('estimateDepth', () => {
  it('counts a plain nest', () => {
    expect(estimateDepth('<div><div><div></div></div></div>').maxDepth).toBe(3)
  })

  it('unwinds on close, so siblings do not accumulate', () => {
    const markup = '<div></div>'.repeat(50)
    expect(estimateDepth(markup).maxDepth).toBe(1)
    expect(estimateDepth(markup).tagCount).toBe(100)
  })

  it('does not count a void element as a level', () => {
    // Without this, a gallery of forty images and a head full of meta tags reads as eighty levels
    // on a document nesting six.
    const markup = `<div>${'<img src="/a.png">'.repeat(40)}${'<meta charset="utf-8">'.repeat(20)}</div>`
    expect(estimateDepth(markup).maxDepth).toBe(1)
  })

  it('does not count a self-closing tag as a level', () => {
    expect(estimateDepth('<div><br/><hr/><span/></div>').maxDepth).toBe(1)
  })

  it('skips the contents of a script, which are not markup', () => {
    // A page of minified JavaScript is full of `<` and `<=`. Counting those is how an ordinary
    // page reads as a thousand levels deep.
    const markup = `<div><script>const a = 1 < 2; const b = "<div><div><div>"</script></div>`
    expect(estimateDepth(markup).maxDepth).toBe(1)
  })

  it('skips the contents of a style for the same reason', () => {
    expect(estimateDepth('<div><style>a{content:"<div>"}</style></div>').maxDepth).toBe(1)
  })

  it('skips a comment rather than counting the tags inside it', () => {
    expect(estimateDepth('<div><!-- <div><div><div> --></div>').maxDepth).toBe(1)
  })

  it('ignores a close with no open rather than going negative', () => {
    expect(estimateDepth('</p></p></p><div></div>').maxDepth).toBe(1)
  })

  it('over-estimates mismatched closes, which is the direction a refusal should err in', () => {
    // A real parser would treat `<p><p><p>` as siblings (a `<p>` closes the previous one). The
    // estimate reads three levels. Refusing a page that would have been fine is recoverable;
    // admitting one that hangs is not.
    expect(estimateDepth('<p><p><p>').maxDepth).toBe(3)
  })

  it('counts tags as well as depth', () => {
    expect(estimateDepth('<a></a><b></b><i></i>').tagCount).toBe(6)
  })
})

describe('parseDocument', () => {
  it('refuses an empty body without calling the parser', () => {
    const outcome = parseDocument('   \n  ')
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.reason).toBe('EMPTY')
  })

  it('parses an ordinary document', () => {
    const outcome = parseDocument('<html><body><h1>A Console</h1></body></html>')
    expect(outcome.ok).toBe(true)
    if (outcome.ok) expect(outcome.root.querySelector('h1')?.text).toBe('A Console')
  })

  it('parses a document at the depth limit', () => {
    const outcome = parseDocument(nest(MAX_NESTING_DEPTH))
    expect(outcome.ok).toBe(true)
  })

  it('refuses one past it, and names the reason', () => {
    const outcome = parseDocument(nest(MAX_NESTING_DEPTH + 1))
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.reason).toBe('TOO_DEEP')
      expect(outcome.detail).toContain(String(MAX_NESTING_DEPTH))
    }
  })

  it('refuses a document with too many tags', () => {
    const outcome = parseDocument('<span></span>'.repeat(MAX_TAG_COUNT))
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.reason).toBe('TOO_MANY_TAGS')
  })

  it('REFUSES THE PATHOLOGICAL CASE IN MILLISECONDS, which is the whole point', () => {
    /*
     * THE ASSERTION THIS MODULE EXISTS FOR. Twenty thousand unclosed divs is a hundred kilobytes —
     * a page anybody can serve, well inside every other bound this system has — and parsing it
     * takes hours. Refusing it takes a single linear pass.
     *
     * The budget is generous (250 ms against a measured single-digit) because a shared CI runner
     * under load is not a benchmark rig. What it catches is the regression that matters: somebody
     * removing the guard, or moving it after the parse.
     */
    const body = nest(20_000)
    const startedAt = Date.now()
    const outcome = parseDocument(body)
    const elapsed = Date.now() - startedAt

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.reason).toBe('TOO_DEEP')
    expect(elapsed).toBeLessThan(250)
  })

  it('still reads a real page that happens to be large', () => {
    // The guard must not refuse an honest catalogue page. Eight thousand shallow elements is a
    // long listing, and it parses.
    const body = `<html><body>${'<div class="card"><a href="/p/1">A</a></div>'.repeat(2_000)}</body></html>`
    const startedAt = Date.now()
    const outcome = parseDocument(body)

    expect(outcome.ok).toBe(true)
    expect(Date.now() - startedAt).toBeLessThan(2_000)
  })

  it('reports truncation rather than hiding it', () => {
    const outcome = parseDocument(`<div>${'a'.repeat(3 * 1024 * 1024)}</div>`)
    expect(outcome.ok).toBe(true)
    if (outcome.ok) expect(outcome.truncated).toBe(true)
  })

  it('never throws, whatever it is given', () => {
    for (const body of [
      '<x',
      '<<<<<<',
      '<!--',
      '<script>',
      '<div',
      Array.from({ length: 256 }, (_entry, index) => String.fromCharCode(index)).join(''),
    ]) {
      expect(() => parseDocument(body)).not.toThrow()
    }
  })
})
