import type { BlockType } from '@/lib/cms/block-types'
import { blockModule } from '@/lib/cms/registry'

/**
 * What an article's page starts with: one band, and deliberately only one.
 *
 * A PROJECT'S STORY TEMPLATE LAYS DOWN FOUR AND A COLLECTION'S TEN. Both of those pages have a
 * known shape — FEAT §8 enumerates the exhibition, and a project page is a hero, a few words, the
 * photographs and a way to get in touch. An article has no shape: it is prose, and how a piece is
 * built is the writer's decision. Pre-placing a hero and a commission CTA would be this repository
 * deciding what the studio's editorial looks like, on ten drafts nobody has written yet.
 *
 * SO WHY ONE BAND AND NOT ZERO. `enforce_article_has_body` refuses to publish an article whose page
 * carries no visible section, and a page created with nothing on it puts an editor in front of an
 * empty screen with no indication of what to do next. One `statement` band is somewhere to write —
 * it is the block that carries editorial copy today, `rich-text` being declared and unbuilt
 * (amendment A14) — and it can be removed like any other.
 *
 * THE TEMPLATE WRITES NO COPY, as the other two do not: the band carries the block's own defaults
 * and nothing else.
 */

export const ARTICLE_BODY_TEMPLATE: readonly { label: string; blockType: BlockType }[] = [
  { label: 'Opening', blockType: 'statement' },
]

/** What to insert. `parse`, not `safeParse`: a bad default here is a defect in this file. */
export function articleBodySections(): readonly {
  readonly blockType: BlockType
  readonly payload: unknown
}[] {
  return ARTICLE_BODY_TEMPLATE.map((entry) => {
    const block = blockModule(entry.blockType)
    const defaults = block.defaults as Record<string, unknown>
    return { blockType: entry.blockType, payload: block.schema.parse({ ...defaults }) }
  })
}
