import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  coverage,
  summarisePrices,
  tallyByBand,
  tallyThreeValued,
} from '@/lib/scraper/analytics/coverage'
import { SCALE_BANDS } from '@/lib/scraper/analytics/scale'

/**
 * Coverage honesty: the rules that stop a chart implying knowledge Rivya does not have.
 *
 * FEAT §28 — **do not manufacture unavailable analytics data; clearly state coverage** — is the
 * requirement, and these are the four ways it is kept:
 *
 *   1. Zero in scope is 0 %, not 100 %.
 *   2. The unknown bucket is counted, never inferred by subtraction.
 *   3. Every band is present at zero, so a distribution's shape does not change as it fills.
 *   4. Currencies are never mixed, and quote-only rows are counted rather than dropped.
 *
 * Each of these is a place where the tidier arithmetic is the dishonest one, which is exactly why
 * they are written down as assertions rather than left to whoever writes the next panel.
 */

describe('coverage', () => {
  it('reports zero in scope as 0 %, never 100 %', () => {
    /*
     * THE TEMPTING ARITHMETIC IS THE MISLEADING ONE: no rows, nothing missing, therefore complete
     * coverage. That produces a banner reading "100 %" above an empty chart, which is the single
     * most misleading thing this module could output. An empty workspace should say it is empty.
     */
    expect(coverage(0, 0)).toEqual({ inScope: 0, parsed: 0, unknown: 0, pct: 0 })
  })

  it('computes the unknown bucket rather than leaving it to be inferred', () => {
    expect(coverage(412, 190)).toEqual({ inScope: 412, parsed: 190, unknown: 222, pct: 46 })
  })

  it('never reports more parsed than in scope', () => {
    // A caller passing a parsed count from one query and a scope from another would otherwise
    // produce coverage above 100 %, which reads as a bug in the data rather than in the call.
    expect(coverage(10, 40)).toEqual({ inScope: 10, parsed: 10, unknown: 0, pct: 100 })
  })

  it('refuses negative counts', () => {
    expect(coverage(-5, -2)).toEqual({ inScope: 0, parsed: 0, unknown: 0, pct: 0 })
  })
})

describe('the three-valued tally', () => {
  it('counts null and undefined as unknown rather than as false', () => {
    // THE WHOLE POINT OF THE COLUMN. A row whose dimensions could not be read is not a small table.
    const tally = tallyThreeValued([true, false, null, undefined, true])
    expect(tally).toEqual({ yes: 2, no: 1, unknown: 2 })
  })

  it('reports all three even when two are zero', () => {
    expect(tallyThreeValued([null, null])).toEqual({ yes: 0, no: 0, unknown: 2 })
  })
})

describe('the band tally', () => {
  it('includes every band at zero', () => {
    /*
     * A DISTRIBUTION THAT RENDERS ONLY THE BANDS WITH ROWS CHANGES SHAPE AS IT FILLS, and the shape
     * is what a person is reading. An empty `SIDE` column is information; its absence is
     * indistinguishable from the band not existing.
     */
    const counts = tallyByBand(SCALE_BANDS, ['DINING', 'DINING', 'UNKNOWN'])
    expect(Object.keys(counts).sort()).toEqual([...SCALE_BANDS].sort())
    expect(counts.DINING).toBe(2)
    expect(counts.UNKNOWN).toBe(1)
    expect(counts.SIDE).toBe(0)
    expect(counts.MONUMENTAL).toBe(0)
  })

  it('ignores a value that is not a band rather than inventing a bucket for it', () => {
    const counts = tallyByBand(SCALE_BANDS, ['DINING', null, undefined])
    expect(counts.DINING).toBe(1)
    expect(Object.values(counts).reduce((sum, value) => sum + value, 0)).toBe(1)
  })
})

describe('price summaries', () => {
  const rows = [
    { currency: 'GBP', priceState: 'FIXED', priceMinMinor: 120_000 },
    { currency: 'GBP', priceState: 'FIXED', priceMinMinor: 180_000 },
    { currency: 'EUR', priceState: 'FIXED', priceMinMinor: 200_000 },
    { currency: null, priceState: 'REQUEST_QUOTE', priceMinMinor: null },
    { currency: null, priceState: null, priceMinMinor: null },
  ]

  it('never mixes currencies and produces no combined total', () => {
    /*
     * PHASE 28'S RULE, ENFORCED HERE. No conversion exists anywhere under `lib/scraper/`, because a
     * rate is a fact about a day and inventing one would fabricate every figure computed from it.
     * There is no honest total, so the summary has no field for one — a shape that cannot express
     * the wrong answer.
     */
    const summary = summarisePrices(rows)
    expect(summary.groups.map((group) => group.currency).sort()).toEqual(['EUR', 'GBP'])
    expect(summary).not.toHaveProperty('total')
    expect(summary).not.toHaveProperty('meanMinor')
  })

  it('counts quote-only rows rather than dropping them', () => {
    // A competitor who withdraws public prices is telling us something. Excluding those rows would
    // make an expensive source look cheap by removing exactly its expensive half.
    const summary = summarisePrices(rows)
    expect(summary.quoteOnly).toBe(1)
    expect(summary.unpriced).toBe(1)
  })

  it('computes min, max and mean within a currency only', () => {
    const gbp = summarisePrices(rows).groups.find((group) => group.currency === 'GBP')
    expect(gbp).toEqual({
      currency: 'GBP',
      count: 2,
      minMinor: 120_000,
      maxMinor: 180_000,
      meanMinor: 150_000,
    })
  })

  it('accounts for every row exactly once', () => {
    const summary = summarisePrices(rows)
    const counted =
      summary.groups.reduce((sum, group) => sum + group.count, 0) +
      summary.quoteOnly +
      summary.unpriced
    expect(counted).toBe(rows.length)
  })
})

describe('the workspace composes rather than reimplements', () => {
  it('builds no filter predicate of its own', () => {
    /*
     * THE RISK THIS PHASE CARRIES, NAMED IN ITS OWN DOCUMENT: becoming a second explorer with
     * duplicated filtering code. The workspace page may read `searchParams` and hand a filter
     * OBJECT to the repository; what it may not do is assemble a query — the moment it calls
     * `.from(...)` or `.eq(...)` there are two query layers to keep in step, and the second one is
     * always the one that forgets a rule the first learnt.
     *
     * `db:check-data-layer` already forbids `.from(` outside the repositories; this adds the finer
     * point, which that gate does not cover: no filter methods either.
     */
    const source = readFileSync(
      join(
        resolve(__dirname, '../..'),
        'app/(studio)/studio/(shell)/research/large-format/page.tsx',
      ),
      'utf8',
    )
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[ \t]*\/\/.*$/gm, '')

    for (const forbidden of ['.from(', '.eq(', '.ilike(', '.in(', '.gte(', '.order(']) {
      expect(source, forbidden).not.toContain(forbidden)
    }
  })

  it('renders the coverage banner before any panel', () => {
    // ORDER IS THE DESIGN. A person should have read the coverage figure before they read anything
    // drawn from it, and a footnote below three charts is not that.
    const source = readFileSync(
      join(
        resolve(__dirname, '../..'),
        'app/(studio)/studio/(shell)/research/large-format/page.tsx',
      ),
      'utf8',
    )
    const banner = source.indexOf('<CoverageBanner')
    expect(banner).toBeGreaterThan(-1)
    for (const panel of [
      '<BandDistribution',
      '<DimensionScatter',
      '<PriceByBand',
      '<MaterialsByBand',
      '<GapPanel',
    ]) {
      expect(source.indexOf(panel), panel).toBeGreaterThan(banner)
    }
  })

  it('says nothing about opportunity, gaps in the market, or the Rivya catalogue', () => {
    /*
     * THE GAP PANEL REPORTS RESEARCH COVERAGE AND SAYS SO. Rivya has no published products, so any
     * comparison against its own catalogue would be an artefact of an empty catalogue wearing the
     * clothes of a finding — and the person reading it would have no way to tell. Opportunity
     * scoring is Phase 32, after there is something to compare against.
     */
    const panels = readFileSync(
      join(resolve(__dirname, '../..'), 'components/studio/research/BandPanels.tsx'),
      'utf8',
    )
    const gap = panels.slice(panels.indexOf('export function GapPanel'))
    for (const forbidden of ['opportunity', 'market gap', 'underserved', 'whitespace']) {
      expect(gap.toLowerCase(), forbidden).not.toContain(forbidden)
    }
  })
})
