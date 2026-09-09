import { describe, expect, it } from 'vitest'

import { isEntryVisible, visibleEntries } from '@/lib/cms/entry-visibility'
import { blockModuleFor } from '@/lib/cms/registry'
import { seedModules } from '@/content/seed'

/**
 * The entry-level withholding contract, asserted against the seed modules themselves.
 *
 * WHY THE MODULES AND NOT THE DATABASE. A database test proves what one machine happens to hold;
 * this proves what anybody re-seeding will get, and it fails in the pull request rather than after
 * a deploy. The database is asserted separately by the phase's own SQL, which is what proves the
 * two agree.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO is judge whether a sentence is a capability claim. That needs
 * a list of capability words, and such a list is either short enough to miss the next claim or long
 * enough to report the whole site. The decidable things are asserted instead: keys exist, keys are
 * unique, and the entries the specification names are still withheld.
 */

/** Every declared entry array inside a seeded section payload, with where it came from. */
type SeededEntryArray = {
  readonly seedKey: string
  readonly field: string
  readonly entries: readonly Record<string, unknown>[]
}

/**
 * THE BLOCK DECLARES WHICH ARRAYS ARE EDITORIAL; THIS TEST DOES NOT GUESS.
 *
 * Two guesses were tried and both were wrong. "Any object array in the payload" sweeps in
 * `/contact`'s form `fields`, which are a schema rather than something a visitor reads — demanding
 * a key and a verification flag of a form field asks a structural list an editorial question.
 * "An object with a `title`" then misses the commission band's six capabilities, which have a
 * `label`; that is the exact failure that matters, because those six are capability claims and
 * skipping them means the test reports nine withheld entries and calls fifteen correct.
 *
 * `BlockModule.entryArrays` settles it at the only place that actually knows. A block that adds a
 * repeating editorial array and forgets to declare it is invisible here — which is why the seed's
 * own count is asserted below by NAME rather than by number: an undeclared array shows up as a
 * missing key in that list, not as a silently smaller sweep.
 */
function seededEntryArrays(): SeededEntryArray[] {
  const found: SeededEntryArray[] = []

  for (const seedModule of seedModules) {
    for (const record of seedModule.records) {
      const payload = record.fields['payload']
      if (payload === null || typeof payload !== 'object') continue

      const blockType = record.fields['block_type']
      if (typeof blockType !== 'string') continue
      const block = blockModuleFor(blockType)
      if (block === null) continue

      for (const field of block.entryArrays) {
        const value = (payload as Record<string, unknown>)[field]
        if (!Array.isArray(value)) continue
        const entries = value.filter(
          (item): item is Record<string, unknown> =>
            typeof item === 'object' && item !== null && !Array.isArray(item),
        )
        if (entries.length === 0) continue
        found.push({ seedKey: record.seedKey, field, entries })
      }
    }
  }
  return found
}

const ARRAYS = seededEntryArrays()

describe('every repeating payload entry', () => {
  it('carries a key', () => {
    // Without one the renderer falls back to the title for `data-entry-key`, and a test addressing
    // a withheld entry by name would silently address a title an editor can reword.
    const missing = ARRAYS.flatMap(({ seedKey, field, entries }) =>
      entries
        .filter((entry) => typeof entry['key'] !== 'string' || entry['key'] === '')
        .map(() => `${seedKey}.${field}`),
    )
    expect(missing).toEqual([])
  })

  it('has a key unique within its own array', () => {
    const collisions = ARRAYS.flatMap(({ seedKey, field, entries }) => {
      const keys = entries.map((entry) => String(entry['key']))
      return keys.length === new Set(keys).size ? [] : [`${seedKey}.${field}`]
    })
    expect(collisions).toEqual([])
  })

  it('uses one of the three verification states, or none', () => {
    const bad = ARRAYS.flatMap(({ seedKey, field, entries }) =>
      entries
        .filter((entry) => {
          const value = entry['owner_verification']
          return (
            value !== undefined &&
            value !== 'NOT_REQUIRED' &&
            value !== 'OWNER_VERIFICATION_REQUIRED' &&
            value !== 'VERIFIED'
          )
        })
        .map(() => `${seedKey}.${field}`),
    )
    expect(bad).toEqual([])
  })
})

describe('the homepage entries SEED §10 withholds', () => {
  const withheld = ARRAYS.flatMap(({ seedKey, entries }) =>
    seedKey.startsWith('section:home.')
      ? entries
          .filter((entry) => entry['owner_verification'] === 'OWNER_VERIFICATION_REQUIRED')
          .map((entry) => String(entry['key']))
      : [],
  )

  it('is exactly the fifteen the phase document names', () => {
    /*
     * The list, not just the count. A count passes when one claim is unflagged and an unrelated
     * one is flagged by mistake — which is the failure that matters, because the unflagged one
     * goes live.
     */
    expect([...withheld].sort()).toEqual(
      [
        // §10-03, two of five category cards
        '3d-resin',
        'architectural-pieces',
        // §10-06, the third material statement
        'fabricated-form',
        // §10-07, all six commission capabilities
        'custom-dimensions',
        'material-direction',
        'colour-direction',
        'form-exploration',
        'finish-selection',
        'reference-consultation',
        // §10-10, all five process statements
        'understand',
        'develop',
        'make',
        'finish',
        'deliver',
        // §10-11, the personalisation card
        'personalised-pieces',
      ].sort(),
    )
  })
})

describe('isEntryVisible', () => {
  it('withholds only an entry awaiting verification', () => {
    expect(isEntryVisible({ owner_verification: 'OWNER_VERIFICATION_REQUIRED' })).toBe(false)
  })

  it('shows an entry whose claim the owner has confirmed', () => {
    // VERIFIED and NOT_REQUIRED are different statements — one says the claim was checked, the
    // other that there was nothing to check — and both may be rendered.
    expect(isEntryVisible({ owner_verification: 'VERIFIED' })).toBe(true)
    expect(isEntryVisible({ owner_verification: 'NOT_REQUIRED' })).toBe(true)
  })

  it('shows an entry with no flag at all', () => {
    // Every payload seeded before the field existed omits it; treating that as withheld would
    // empty most of the site the moment the field shipped.
    expect(isEntryVisible({})).toBe(true)
  })

  it('preserves order when filtering', () => {
    const entries = [
      { key: 'a' },
      { key: 'b', owner_verification: 'OWNER_VERIFICATION_REQUIRED' as const },
      { key: 'c' },
    ]
    expect(visibleEntries(entries).map((e) => e.key)).toEqual(['a', 'c'])
  })
})
