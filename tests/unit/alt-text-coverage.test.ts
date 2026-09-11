import { describe, expect, it } from 'vitest'

import { ALT_TEXT } from '@/content/media/alt-text'
import { altTextWarnings, needsAltTextReview } from '@/lib/media/alt-text-quality'
import { parseManifest } from '@/lib/media/manifest'
import manifestJson from '@/data/higgsfield/asset-manifest.json'

/**
 * ALT TEXT FOR ALL 250 — Phase 43, tested in Phase 42.
 *
 * The imported drafts were the first ~160 characters of each generation prompt, cut at a character
 * count: 124 ended mid-clause and the rest carried the prompt's instructions. This suite is what
 * stops the rewrite from silently regressing — a value edited by hand, a regeneration with a
 * loosened rule, a new asset appended without a sentence.
 *
 * IT ASSERTS THE PROPERTY, NOT THE PROSE. Pinning a sentence would make every editorial improvement
 * a failing test, which is the opposite of what the queue is for.
 */

const MANIFEST = parseManifest(manifestJson)

describe('the quality rules', () => {
  it('catches a value cut off mid-sentence', () => {
    expect(
      altTextWarnings('A studio tool wall photographed straight on: heat guns, notched…'),
    ).toContain('TRUNCATED')
    expect(altTextWarnings('A studio tool wall above a working bench...')).toContain('TRUNCATED')
  })

  it('catches the vocabulary of a prompt rather than of a picture', () => {
    // "Warm afternoon light" describes the scene; "a single soft key light" describes the rig.
    expect(altTextWarnings('A resin table under a single soft key light.')).toContain(
      'PROMPT_VOCABULARY',
    )
    expect(altTextWarnings('A resin table in warm afternoon light.')).not.toContain(
      'PROMPT_VOCABULARY',
    )
  })

  it('catches an alternative that opens by announcing it is an image', () => {
    // A screen reader already says "image"; repeating it spends the words the reader is given.
    expect(altTextWarnings('An image of a resin table in a room.')).toContain('REDUNDANT_PREFIX')
    expect(altTextWarnings('A resin table in a room.')).not.toContain('REDUNDANT_PREFIX')
  })

  it('catches a label pretending to be a description', () => {
    expect(altTextWarnings('Teak console')).toContain('TOO_SHORT')
  })

  it('says nothing about a value that reads as a description', () => {
    expect(
      altTextWarnings('A resin coaster and a domed paperweight arranged across a dark bench.'),
    ).toEqual([])
    expect(needsAltTextReview('A resin coaster and a domed paperweight on a dark bench.')).toBe(
      false,
    )
  })
})

describe('the 250 rewritten values', () => {
  it('covers every manifest asset', () => {
    /*
     * A MISSING KEY IS THE FAILURE MODE OF A GENERATED FILE. If an asset is appended to the manifest
     * and nobody writes a sentence for it, the gate that would catch it is this one — the row would
     * otherwise carry its imported draft into the database and pass every constraint.
     */
    for (const asset of MANIFEST.assets) {
      expect(
        ALT_TEXT[asset.rivya_asset_id],
        `${asset.rivya_asset_id} has no text alternative`,
      ).toBeDefined()
    }
    expect(Object.keys(ALT_TEXT)).toHaveLength(MANIFEST.assets.length)
  })

  it('names no asset the manifest does not have', () => {
    const known = new Set(MANIFEST.assets.map((asset) => asset.rivya_asset_id))
    for (const id of Object.keys(ALT_TEXT)) {
      expect(known.has(id), `${id} is not in the manifest`).toBe(true)
    }
  })

  it('passes every quality rule', () => {
    const failing = Object.entries(ALT_TEXT).filter(
      ([, value]) => altTextWarnings(value).length > 0,
    )
    expect(failing.map(([id]) => id)).toEqual([])
  })

  it('carries no hex code and never says "AI"', () => {
    /*
     * A HEX CODE IS A PALETTE INSTRUCTION and describes nothing to a person who cannot see the
     * image. "AI" spends the words a screen reader gives on provenance rather than on subject — and
     * the provenance is already recorded structurally in `is_ai_generated`.
     */
    for (const [id, value] of Object.entries(ALT_TEXT)) {
      expect(/#[0-9a-f]{3,8}\b/i.test(value), `${id} carries a hex code`).toBe(false)
      expect(/\bAI\b/.test(value), `${id} says AI`).toBe(false)
    }
  })

  it('is a sentence rather than a fragment', () => {
    for (const [id, value] of Object.entries(ALT_TEXT)) {
      expect(value.trim().length, `${id} is too short`).toBeGreaterThanOrEqual(15)
      expect(/[.!?]$/.test(value.trim()), `${id} does not end a sentence`).toBe(true)
      // Long enough to describe, short enough that a screen reader is not reading an essay.
      expect(value.length, `${id} is longer than a text alternative should be`).toBeLessThanOrEqual(
        400,
      )
    }
  })
})
