import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { isFrozen, type ScaleRule } from '@/lib/scraper/analytics/scale'
import {
  parseArgs,
  plan,
  summarise,
  type StoredScaleRow,
} from '../../scripts/research/reclassify-scale'

/**
 * **AN EDITOR OVERRIDE IS PERMANENT AGAINST RULE CHANGES, AND THE SKIP IS REPORTED.**
 *
 * This is the promise that makes the whole scale workspace usable. A researcher who corrects a band
 * by hand has done it from evidence the rules do not have — a photograph, the source's own copy,
 * knowledge of the piece — and a threshold edit two months later must not quietly undo it. If it
 * could, nobody would correct anything, because the correction would be worthless.
 *
 * REPORTING THE SKIP IS THE OTHER HALF. Somebody editing the rules needs to know how many rows
 * their edit did NOT reach, because that number is the difference between "the rules now say X" and
 * "the corpus now says X". A pass that silently passed over frozen rows would let a person believe
 * a rule change had landed everywhere.
 *
 * THE PLANNER TAKES NO CLIENT, so `--dry-run` is structural: it is the absence of an apply step,
 * not a flag somebody remembered to check. A test can therefore exercise the whole decision without
 * a database.
 */

const RULES: readonly ScaleRule[] = [
  {
    id: 'rule-10',
    priority: 10,
    predicate: { parseState: 'NOT_PARSED' },
    resultBand: 'UNKNOWN',
    resultIsLarge: null,
    isEnabled: true,
  },
  {
    id: 'rule-20',
    priority: 20,
    predicate: { minLongestAxisMm: 1_800 },
    resultBand: null,
    resultIsLarge: true,
    isEnabled: true,
  },
  {
    id: 'rule-50',
    priority: 50,
    predicate: {},
    resultBand: null,
    resultIsLarge: false,
    isEnabled: true,
  },
]

function row(overrides: Partial<StoredScaleRow> = {}): StoredScaleRow {
  return {
    productId: 'p1',
    dimensionsMm: { length_mm: 2_000, height_mm: 750 },
    dimensionParseState: 'PARSED',
    categoryIsLargeFormat: false,
    currentBand: 'DINING',
    currentSource: 'RULE',
    ...overrides,
  }
}

describe('isFrozen', () => {
  it('is true for EDITOR and false for everything else', () => {
    expect(isFrozen('EDITOR')).toBe(true)
    expect(isFrozen('RULE')).toBe(false)
    expect(isFrozen('UNKNOWN')).toBe(false)
    expect(isFrozen(null)).toBe(false)
  })
})

describe('plan', () => {
  it('skips an overridden row and plans nothing for it', () => {
    const plans = plan([row({ currentSource: 'EDITOR', currentBand: 'MONUMENTAL' })], RULES)
    expect(plans[0]?.skipped).toBe(true)
    expect(plans[0]?.classification).toBeNull()
    expect(plans[0]?.moved).toBe(false)
  })

  it('keeps the skipped row in the examined count rather than omitting it', () => {
    // Omitting it would make `examined` smaller than the row count, and the report would quietly
    // describe a subset — the very thing the skip count exists to make visible.
    const plans = plan([row({ currentSource: 'EDITOR' }), row({ productId: 'p2' })], RULES)
    expect(plans).toHaveLength(2)
    expect(summarise(plans, 0).examined).toBe(2)
  })

  it('reclassifies a rule-owned row and reports the movement', () => {
    const plans = plan([row({ currentBand: 'SIDE' })], RULES)
    expect(plans[0]?.skipped).toBe(false)
    expect(plans[0]?.moved).toBe(true)
    expect(plans[0]?.from).toBe('SIDE')

    const report = summarise(plans, 1)
    expect(report.moved).toBe(1)
    expect(report.movements[0]?.from).toBe('SIDE')
  })

  it('does not report a movement when the band is unchanged', () => {
    // A 2 000 mm piece at dining height bands DINING, which is where this row already is.
    const plans = plan([row()], RULES)
    expect(plans[0]?.moved).toBe(false)
    expect(summarise(plans, 0).unchanged).toBe(1)
  })

  it('survives a threshold change that would otherwise move the overridden row', () => {
    /*
     * THE VERIFICATION STEP THE PHASE DOCUMENT ASKS FOR, exactly: override a row, raise rule 20's
     * threshold above it, and the override stands.
     */
    const raised: readonly ScaleRule[] = RULES.map((rule) =>
      rule.id === 'rule-20' ? { ...rule, predicate: { minLongestAxisMm: 2_500 } } : rule,
    )

    const frozen = plan([row({ currentSource: 'EDITOR', currentBand: 'MONUMENTAL' })], raised)
    expect(frozen[0]?.skipped).toBe(true)

    const notFrozen = plan([row({ currentSource: 'RULE', currentBand: 'MONUMENTAL' })], raised)
    expect(notFrozen[0]?.skipped).toBe(false)
    expect(notFrozen[0]?.classification?.isLargeFormat).toBe(false)
  })
})

describe('summarise', () => {
  it('separates skipped rows from unchanged ones', () => {
    // Both look like "nothing happened" and mean opposite things: one is a row the rules agreed
    // with, the other is a row they were not allowed to touch.
    const plans = plan(
      [
        row({ productId: 'frozen', currentSource: 'EDITOR' }),
        row({ productId: 'agreed' }),
        row({ productId: 'moved', currentBand: 'SIDE' }),
      ],
      RULES,
    )
    const report = summarise(plans, 1)
    expect(report.skipped).toBe(1)
    expect(report.unchanged).toBe(1)
    expect(report.moved).toBe(1)
    expect(report.examined).toBe(3)
  })
})

describe('parseArgs', () => {
  it('defaults to writing and accepts --dry-run', () => {
    const plain = parseArgs([])
    expect(plain.ok).toBe(true)
    expect(plain.ok && plain.value.dryRun).toBe(false)

    const dry = parseArgs(['--dry-run'])
    expect(dry.ok && dry.value.dryRun).toBe(true)
  })

  it('refuses a limit that is not a whole positive number', () => {
    for (const bad of ['--limit=0', '--limit=-1', '--limit=50x', '--limit=1e6']) {
      expect(parseArgs([bad]).ok, bad).toBe(false)
    }
  })

  it('refuses an argument it does not recognise rather than ignoring it', () => {
    // A typo'd flag that is silently ignored is a run that did something other than what was asked.
    expect(parseArgs(['--forces']).ok).toBe(false)
  })
})

describe('the script fetches nothing', () => {
  it('names no HTTP client', () => {
    /*
     * THE FAILURE GUARDED AGAINST IS A FUTURE EDIT, not a bug today: "just refresh the dimensions
     * if they look stale" is a reasonable-sounding change that would turn an offline recomputation
     * into a crawl nobody authorised, over sources whose politeness budget lives somewhere else
     * entirely. `renormalize.ts` carries the same assertion for the same reason.
     */
    const source = readFileSync(
      join(resolve(__dirname, '../..'), 'scripts/research/reclassify-scale.ts'),
      'utf8',
    )
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[ \t]*\/\/.*$/gm, '')

    for (const forbidden of [
      'lib/scraper/core/fetch',
      'undici',
      'axios',
      'node:http',
      'node:https',
      'fetch(',
    ]) {
      expect(source, forbidden).not.toContain(forbidden)
    }
  })
})
