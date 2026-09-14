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

  it('catches an instruction to the generator rather than a description', () => {
    /*
     * THE 45 THAT SHIPPED. `PROMPT_VOCABULARY` looks for the language of a camera, and a brief's
     * language is not a camera's — so a safe area, a continuity note and a negative prompt all
     * passed the gate and one of them reached the live `/large-format` mobile hero.
     */
    expect(
      altTextWarnings('Soft morning side-light, the upper third calm as headline safe area.'),
    ).toContain('PROMPT_DIRECTION')
    expect(
      altTextWarnings(
        'A bench of curing moulds, keeping the same subject as the horizontal master.',
      ),
    ).toContain('PROMPT_DIRECTION')
    expect(altTextWarnings('Workshop bench dolly (720p variant 2).')).toContain('PROMPT_DIRECTION')

    // A description that happens to mention the lower third is about the picture, not the type.
    expect(
      altTextWarnings('Deep ocean blue resin folds with a calm dark lower third.'),
    ).not.toContain('PROMPT_DIRECTION')
  })

  it('catches an alternative that calls a concept render a photograph', () => {
    /*
     * ALL 250 CATALOGUED ASSETS ARE `is_concept`. There is no photograph of a delivered Rivya piece
     * among them, so "Editorial photograph:" is not a stylistic tic — it is the claim the media rule
     * forbids, and it was live on two pages.
     */
    expect(altTextWarnings('Editorial photograph: a console table against plaster.')).toContain(
      'CLAIMS_CAPTURE',
    )
    expect(altTextWarnings('A vanity mirror on a dresser. luxury product photography.')).toContain(
      'CLAIMS_CAPTURE',
    )
    expect(altTextWarnings('One garland photographed twice on dark teak.')).toContain(
      'CLAIMS_CAPTURE',
    )

    /*
     * PHRASES, NOT THE BARE WORD. Reference photos lying on a bench are objects in the scene. A rule
     * that punished the word would push whoever hit it into describing the scene less accurately.
     */
    expect(
      altTextWarnings(
        'A custom figurine on a turntable beside reference photos, soft studio light.',
      ),
    ).not.toContain('CLAIMS_CAPTURE')
  })

  it('catches punctuation a hand-edit broke', () => {
    // Dropping a trailing clause leaves ".."; dropping a leading one leaves "Vertical :".
    expect(altTextWarnings('A dining table in a tall interior, upper third calm..')).toContain(
      'MALFORMED',
    )
    expect(altTextWarnings('Vertical : a dining table in a tall serene interior.')).toContain(
      'MALFORMED',
    )
    expect(altTextWarnings('Quiet luxury, realistic proportions., no neon.')).toContain('MALFORMED')

    // An ellipsis is TRUNCATED's finding. Reporting one defect under two names helps nobody.
    expect(altTextWarnings('A studio tool wall above a working bench...')).not.toContain(
      'MALFORMED',
    )
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
