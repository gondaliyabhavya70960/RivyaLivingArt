import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  emptyDraft,
  rawProductDraftSchema,
  type RawProductDraft,
} from '@/lib/scraper/adapters/draft-schema'
import { priceExtractionSchema } from '@/lib/scraper/core/source-schema'
import { applyOverrides, normalizeDraft, type Lexicon } from '@/lib/scraper/normalization'
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  parseArgs,
  plan,
  summarise,
  type StoredRow,
} from '../../scripts/research/renormalize'

/**
 * Re-normalisation, and the one thing it must never do.
 *
 * **IT MUST NOT UNDO A PERSON'S CORRECTION.** That is the phase document's named risk and it is the
 * one that would be invisible: re-normalisation is a background pass over rows nobody is watching,
 * so a lexicon fix that silently reverted a researcher's corrected price would be discovered weeks
 * later, by somebody looking at a comparison chart, with no way to tell which figures had moved.
 * `normalized_overrides` freezes the corrected keys and `plan()` reports how many it left alone.
 *
 * `plan()` IS GIVEN NO CLIENT, WHICH IS WHY `--dry-run` IS STRUCTURAL. It cannot write because it
 * has nothing to write with; the flag is the absence of an apply step afterwards rather than a
 * branch somebody has to remember to check.
 *
 * NO FETCHER IS IMPORTED, ASSERTED BY READING THE SCRIPT OFF DISK. The failure guarded against is a
 * future edit — "just refresh the page if the draft looks stale" — not a bug present today, which
 * is exactly the shape `reextract.ts`'s own no-fetch assertion takes.
 */

const LEXICON: Lexicon = [
  { token: 'oak', patterns: ['oak'], family: 'wood', isEnabled: true },
  { token: 'walnut', patterns: ['walnut'], family: 'wood', isEnabled: true },
]

const CONFIG = priceExtractionSchema.parse({
  strategy: 'NONE',
  decimalSeparator: '.',
  thousandsSeparator: ',',
})

function draft(overrides: Partial<RawProductDraft> = {}): RawProductDraft {
  const base = emptyDraft()
  return rawProductDraftSchema.parse({
    ...base,
    ...overrides,
    confidence: { ...base.confidence, ...(overrides.confidence ?? {}) },
    provenance: { ...base.provenance, ...(overrides.provenance ?? {}) },
  })
}

const RAW = draft({
  title: '  A Long   Oak Table ',
  priceText: '£1,299.00',
  currencyText: 'GBP',
  materialTexts: ['Solid oak'],
  dimensionTexts: ['200 x 90 x 75 cm'],
})

function row(overrides: Partial<StoredRow> = {}): StoredRow {
  return {
    productId: 'p1',
    versionId: 'v1',
    raw: RAW,
    overrides: {},
    current: {
      titleNormalized: 'A Long Oak Table',
      priceMinMinor: 129900,
      materialTokens: ['oak'],
      dimensionParseState: 'PARSED',
    },
    ...overrides,
  }
}

const CONTEXT = { declaredCurrency: 'GBP', priceExtraction: CONFIG, lexicon: LEXICON }

describe('parseArgs', () => {
  it('requires a source', () => {
    const parsed = parseArgs([])
    expect(parsed.ok).toBe(false)
  })

  it('reads a source, a dry-run flag and a limit', () => {
    const parsed = parseArgs(['--source=fixture', '--dry-run', '--limit=50'])
    expect(parsed).toEqual({ ok: true, value: { sourceSlug: 'fixture', dryRun: true, limit: 50 } })
  })

  it('defaults the limit', () => {
    const parsed = parseArgs(['--source=fixture'])
    expect(parsed.ok && parsed.value.limit).toBe(DEFAULT_LIMIT)
  })

  it('refuses a truncated limit rather than reading 50 out of "50x"', () => {
    // `parseInt('50x')` is 50, and a silently truncated limit is the one kind of wrong an operator
    // cannot see in the output.
    expect(parseArgs(['--source=fixture', '--limit=50x']).ok).toBe(false)
    expect(parseArgs(['--source=fixture', `--limit=${String(MAX_LIMIT + 1)}`]).ok).toBe(false)
    expect(parseArgs(['--source=fixture', '--limit=0']).ok).toBe(false)
  })

  it('refuses an argument it does not recognise', () => {
    expect(parseArgs(['--source=fixture', '--force']).ok).toBe(false)
  })
})

describe('plan', () => {
  it('reports no change when the rules read a row the same way it is stored', () => {
    const [entry] = plan([row()], CONTEXT)
    expect(entry?.changed).toBe(false)
    expect(entry?.failure).toBeNull()
  })

  it('reports a change when a lexicon addition finds a material that was missed', () => {
    const stored = row({
      raw: draft({ ...RAW, materialTexts: ['Oak and walnut'] }),
      current: { ...row().current, materialTokens: ['oak'] },
    })
    const [entry] = plan([stored], CONTEXT)
    expect(entry?.changed).toBe(true)
    expect([...(entry?.product?.materialTokens ?? [])].sort()).toEqual(['oak', 'walnut'])
  })

  it('NEVER RECOMPUTES A FROZEN FIELD', () => {
    /*
     * THE ASSERTION THIS FILE EXISTS FOR. A researcher decided this table's price is £1,499 — they
     * read the page and the parser did not. Re-normalisation re-derives everything from the same
     * stored evidence, would arrive at £1,299 again, and must leave their figure alone.
     */
    const stored = row({
      overrides: { priceMinMinor: 149900 },
      current: { ...row().current, priceMinMinor: 149900 },
    })
    const [entry] = plan([stored], CONTEXT)
    expect(entry?.product?.priceMinMinor).toBe(149900)
    expect(entry?.frozen).toContain('priceMinMinor')
    expect(entry?.changed).toBe(false)
  })

  it('reports frozen keys per row and in total', () => {
    const stored = row({ overrides: { priceMinMinor: 149900, titleNormalized: 'The Halden' } })
    const report = summarise(plan([stored, row()], CONTEXT), 0)
    expect(report.frozenRows).toBe(1)
    expect(report.frozenKeys).toBe(2)
  })

  it('refuses to write a row whose stored draft cannot be parsed, and keeps going', () => {
    // One malformed version — written before a schema tightened, or hand-edited in SQL — must not
    // take every row behind it down with it.
    const broken = row({ productId: 'p-broken', raw: { title: 42 } })
    const plans = plan([broken, row()], CONTEXT)
    expect(plans[0]?.failure).not.toBeNull()
    expect(plans[0]?.product).toBeNull()
    expect(plans[1]?.failure).toBeNull()

    const report = summarise(plans, 0)
    expect(report.failures).toHaveLength(1)
    expect(report.failures[0]?.productId).toBe('p-broken')
  })

  it('counts examined, changed and unchanged so the totals add up', () => {
    const report = summarise(plan([row(), row({ productId: 'p2' })], CONTEXT), 0)
    expect(report.examined).toBe(2)
    expect(report.changed + report.unchanged + report.failures.length).toBe(2)
  })
})

describe('applyOverrides', () => {
  it('lets a person’s value win over the rules’', () => {
    const outcome = normalizeDraft(RAW, {
      declaredCurrency: 'GBP',
      priceExtraction: CONFIG,
      lexicon: LEXICON,
    })
    const merged = applyOverrides(outcome.product, { titleNormalized: 'The Halden' })
    expect(merged.product.titleNormalized).toBe('The Halden')
    expect(merged.frozen).toEqual(['titleNormalized'])
  })

  it('NEVER LETS A PERSON OVERRIDE THE RULES’ OWN RECORD OF WHAT THEY DID', () => {
    // An override of `parseStates` would make the audit trail describe an edit rather than the
    // parse it exists to describe — a row could then claim it read a value it never read.
    const outcome = normalizeDraft(RAW, {
      declaredCurrency: 'GBP',
      priceExtraction: CONFIG,
      lexicon: LEXICON,
    })
    const merged = applyOverrides(outcome.product, {
      parseStates: { price: 'PARSED' },
      normalizerVersion: '99.0.0',
    })
    expect(merged.product.parseStates).toEqual(outcome.product.parseStates)
    expect(merged.product.normalizerVersion).toBe(outcome.product.normalizerVersion)
    expect(merged.frozen).toEqual([])
  })

  it('keeps the rules’ answer when an override would make the row incoherent', () => {
    // A quote state carrying an amount is refused by `research_price_state_coherent`. Writing it
    // would be a constraint violation where a sentence belongs; the rules' answer stands and the
    // explorer shows the override as rejected.
    const outcome = normalizeDraft(RAW, {
      declaredCurrency: 'GBP',
      priceExtraction: CONFIG,
      lexicon: LEXICON,
    })
    const merged = applyOverrides(outcome.product, { priceState: 'REQUEST_QUOTE' })
    expect(merged.product.priceState).toBe(outcome.product.priceState)
    expect(merged.frozen).toEqual([])
  })
})

describe('the script reaches no network', () => {
  it('imports no fetcher, no HTTP client and no node HTTP module', () => {
    const source = readFileSync('scripts/research/renormalize.ts', 'utf8')
    const code = source
      .split('\n')
      .filter((line) => !/^\s*(\*|\/\/|\/\*)/u.test(line))
      .join('\n')

    for (const forbidden of [
      'lib/scraper/core/fetch',
      "from 'undici'",
      "from 'axios'",
      "from 'node:http'",
      "from 'node:https'",
      'globalThis.fetch',
    ]) {
      expect(code, forbidden).not.toContain(forbidden)
    }
    expect(code).not.toMatch(/(?<![A-Za-z.])fetch\s*\(/u)
  })

  it('gives plan() no client, so a dry run cannot write', () => {
    // The signature IS the guarantee. A planner holding a database handle would be one refactor
    // away from writing during a dry run, and the operator running one is precisely the person who
    // would not notice.
    expect(plan.length).toBe(2)
  })
})
