import type { BlockType } from '@/lib/cms/block-types'
import { blockModule } from '@/lib/cms/registry'

/**
 * The exhibition page template — FEAT §8's element order, as blocks.
 *
 * ELEVEN ELEMENTS AGAIN, BECAUSE THE REASON THERE WERE TEN HAS GONE. FEAT §8 element 9 is
 * "Editorial copy", which the phase document maps to `rich-text`. Amendment A14 left it out with a
 * precise reason: the block was PLANNED, so inserting it would have given an editor a band that
 * renders nothing — worse than its absence, because they would apply the template, count ten bands
 * and have no way to tell that the eleventh was missing rather than empty. Phase 45 built the
 * renderer (amendment A45), so the band renders, and the element returns to the position FEAT §8
 * gives it. Nothing else about A14's reasoning is disturbed: what Phase 45 built is a PLAIN-TEXT
 * prose band, not the markup block with a sanitiser and a rich editor that A14 declined.
 *
 * `signature-media` APPEARS TWICE, which is not a mistake in the list. FEAT §8 asks for a signature
 * image at 3 and a film at 6; they are the same band with the same shape and the same caption, and
 * the block was built once for both. Element 6 overrides `is_video`.
 *
 * THE TEMPLATE WRITES NO COPY. Every entry carries the block's own defaults and nothing else — no
 * heading, no body, no eyebrow. A template that pre-filled "A new collection from Rivya" would be
 * marketing copy written by this repository rather than by the owner, which is the thing D2 and
 * D10 both forbid from opposite directions. What an editor gets is eleven empty bands in the right
 * order, which is what a starting point is.
 *
 * EVERY BLOCK IS OPTIONAL AND REMOVABLE. The phase document says so and it is worth repeating here,
 * because a list this specific reads like a requirement: it is a starting point, not a constraint,
 * and a collection that needs six bands should end up with six.
 */

export type ExhibitionElement = {
  /** FEAT §8's own numbering, kept so a reader can check this list against the specification. */
  readonly element: number
  /** FEAT §8's name for the element. Studio-facing, like a block's `label`. */
  readonly label: string
  readonly blockType: BlockType
  /** Merged over the block's own defaults. Empty for every element that needs no variation. */
  readonly payload?: Readonly<Record<string, unknown>>
}

export const EXHIBITION_TEMPLATE: readonly ExhibitionElement[] = [
  { element: 1, label: 'Hero', blockType: 'hero' },
  { element: 2, label: 'Collection statement', blockType: 'statement' },
  { element: 3, label: 'Signature media', blockType: 'signature-media' },
  { element: 4, label: 'Products', blockType: 'collection-products' },
  { element: 5, label: 'Material story', blockType: 'material-story' },
  { element: 6, label: 'Video', blockType: 'signature-media', payload: { is_video: true } },
  { element: 7, label: 'Portfolio reference', blockType: 'portfolio-strip' },
  { element: 8, label: '3D element', blockType: 'three-d-resin' },
  { element: 9, label: 'Editorial copy', blockType: 'rich-text' },
  { element: 10, label: 'Related journal stories', blockType: 'journal-strip' },
  { element: 11, label: 'Commission CTA', blockType: 'commission-cta' },
]

/**
 * What to insert, in order: one `{ blockType, payload }` per band.
 *
 * THE PAYLOAD IS VALIDATED HERE, NOT AT THE SAVE. `parse` rather than `safeParse`: a template entry
 * whose override does not fit its block's schema is a defect in this file, and it should fail in
 * the test that calls this function rather than halfway through creating an editor's page — where
 * some bands would already exist and the rest would not.
 */
export function exhibitionSections(): readonly {
  readonly blockType: BlockType
  readonly payload: unknown
}[] {
  return EXHIBITION_TEMPLATE.map((entry) => {
    const block = blockModule(entry.blockType)
    const defaults = block.defaults as Record<string, unknown>
    return {
      blockType: entry.blockType,
      payload: block.schema.parse({ ...defaults, ...(entry.payload ?? {}) }),
    }
  })
}
