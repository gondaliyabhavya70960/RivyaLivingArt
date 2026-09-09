import type { BlockType } from '@/lib/cms/block-types'
import { blockModule } from '@/lib/cms/registry'

/**
 * The exhibition page template — FEAT §8's element order, as blocks.
 *
 * TEN ELEMENTS, NOT ELEVEN, AND THE MISSING ONE IS RECORDED RATHER THAN QUIETLY DROPPED. FEAT §8
 * element 9 is "Editorial copy", which the phase document maps to `rich-text` — one of the eight
 * blocks that is declared and explicitly unbuilt: no renderer, nothing on the public site, and not
 * offered in the Studio picker. Inserting it here would give an editor a band that renders nothing,
 * which is worse than its absence: they would apply the template, count ten bands, and have no way
 * to tell that the eleventh is missing rather than empty. Amendment A14 records the decision and
 * why building a rich-text renderer is not this phase's work. Until then `statement` carries
 * editorial copy, and it is already element 2.
 *
 * `signature-media` APPEARS TWICE, which is not a mistake in the list. FEAT §8 asks for a signature
 * image at 3 and a film at 6; they are the same band with the same shape and the same caption, and
 * the block was built once for both. Element 6 overrides `is_video`.
 *
 * THE TEMPLATE WRITES NO COPY. Every entry carries the block's own defaults and nothing else — no
 * heading, no body, no eyebrow. A template that pre-filled "A new collection from Rivya" would be
 * marketing copy written by this repository rather than by the owner, which is the thing D2 and
 * D10 both forbid from opposite directions. What an editor gets is ten empty bands in the right
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
  // Element 9, "Editorial copy", is `rich-text` and is PLANNED. See the header and amendment A14.
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
