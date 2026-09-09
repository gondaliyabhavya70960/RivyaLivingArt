import type { BlockType } from '@/lib/cms/block-types'
import { blockModule } from '@/lib/cms/registry'

/**
 * The project story template — the bands a delivered project's page starts with.
 *
 * SHORTER THAN THE EXHIBITION TEMPLATE, AND NOT BECAUSE IT IS UNFINISHED. FEAT §8 enumerates eleven
 * elements for a collection's exhibition page; nothing in the specifications enumerates a project
 * story, so this file does not invent a ten-band structure and present it as one that was asked
 * for. Four bands is what a project page needs to exist at all: what it is, a few words about it,
 * the photographs, and a way to talk to Rivya about something similar.
 *
 * THE GALLERY IS THE REASON THE PAGE IS A CMS PAGE. `project-gallery` carries
 * `allowedPages: ['/portfolio/[slug]']` — it reads `portfolio_project_media` for whichever project
 * owns the page it sits on, so it is meaningless anywhere else and the Studio picker will not offer
 * it anywhere else. Every other band here is an ordinary block that an editor may remove.
 *
 * `testimonial-strip` IS NOT IN THE LIST. A quote from the client of this project would be the most
 * natural band to pre-place, and pre-placing it would be an invitation: an empty testimonial band on
 * a new project page is a box asking to be filled, and `testimonials` ships with zero rows for
 * exactly the reason D10 gives. An editor who has a real, consented quote can add the band.
 *
 * THE TEMPLATE WRITES NO COPY, as the exhibition template does not: every entry carries the block's
 * own defaults and nothing else. A pre-filled heading would be marketing copy written by this
 * repository rather than by the owner.
 */

export type ProjectStoryElement = {
  /** Studio-facing, like a block's `label`. */
  readonly label: string
  readonly blockType: BlockType
  /** Merged over the block's own defaults. */
  readonly payload?: Readonly<Record<string, unknown>>
}

export const PROJECT_STORY_TEMPLATE: readonly ProjectStoryElement[] = [
  { label: 'Hero', blockType: 'hero' },
  { label: 'What this project was', blockType: 'statement' },
  { label: 'Photographs', blockType: 'project-gallery' },
  { label: 'Commission CTA', blockType: 'commission-cta' },
]

/**
 * What to insert, in order.
 *
 * `parse`, NOT `safeParse`, for the reason the exhibition template gives: an entry whose override
 * does not fit its block's schema is a defect in this file, and it should fail in the test that
 * calls this function rather than half-way through creating an editor's page.
 */
export function projectStorySections(): readonly {
  readonly blockType: BlockType
  readonly payload: unknown
}[] {
  return PROJECT_STORY_TEMPLATE.map((entry) => {
    const block = blockModule(entry.blockType)
    const defaults = block.defaults as Record<string, unknown>
    return {
      blockType: entry.blockType,
      payload: block.schema.parse({ ...defaults, ...(entry.payload ?? {}) }),
    }
  })
}
