import 'server-only'

import { selectArticles, selectProducts, selectProjects } from '@/lib/cms/selectors'
import type { EntityCard, SelectorClient, SelectorResult } from '@/lib/cms/selectors'
import { listMediaAssetsByIds } from '@/lib/supabase/repositories/media'
import type { MediaAsset, PageSection } from '@/lib/supabase/schemas'

import { journalStripBlock } from '@/content/blocks/journal-strip'
import { portfolioStripBlock } from '@/content/blocks/portfolio-strip'
import { selectedWorksBlock } from '@/content/blocks/selected-works'
import { parseBlockPayload } from './registry'

/**
 * Resolving what the reference blocks refer to, before rendering starts.
 *
 * WHY NOT IN THE RENDERER. `components/sections/types.ts` states the rule and the reason:
 * a section renderer is synchronous and pure, because a renderer that fetched its own data would
 * be a round trip per section, in sequence, inside the render — and would be untestable without a
 * database and unusable in the Studio preview. Media already works this way: `loadPageMedia`
 * hydrates a whole page's assets in one step and the renderers receive them. This is the same
 * arrangement for entities.
 *
 * ONE PASS, IN PARALLEL, AND ONLY FOR THE SECTIONS THAT NEED IT. A page with no reference block
 * issues no query at all; a homepage with three issues three at once. The alternative — resolving
 * every block type in case — would query `products` on `/privacy`.
 *
 * A FAILURE HERE IS AN EMPTY BAND, NOT A DEAD PAGE. `selectProjects` answers `NOT_YET_BUILT` for a
 * table Phase 17 has not created, which is an ordinary state rather than an error, and the
 * renderer draws its seeded editorial fallback. Only a genuine query failure throws, and that is
 * `app/(site)/error.tsx`'s business.
 */

/** One reference block's answer, plus the assets its cards named. */
export type SectionReference = {
  readonly result: SelectorResult
  /** Hero assets for the cards, by `media_assets.id`. Absent where RLS hid one. */
  readonly assets: ReadonlyMap<string, MediaAsset>
}

/** By `page_sections.id`. A section with no entry here is not a reference block. */
export type PageReferences = ReadonlyMap<string, SectionReference>

/**
 * Which selector answers which block, and how many cards it is asked for.
 *
 * KEYED BY BLOCK TYPE so that adding a fourth reference block is one entry here plus a renderer,
 * and so that `renderCmsPage` never learns the names of any of them.
 */
const SELECTORS = {
  'selected-works': {
    select: selectProducts,
    limit: (section: PageSection) => parseBlockPayload(selectedWorksBlock, section.payload).limit,
    categorySlug: (section: PageSection) =>
      parseBlockPayload(selectedWorksBlock, section.payload).category_slug,
  },
  'portfolio-strip': {
    select: selectProjects,
    limit: (section: PageSection) => parseBlockPayload(portfolioStripBlock, section.payload).limit,
    categorySlug: () => null,
  },
  'journal-strip': {
    select: selectArticles,
    limit: (section: PageSection) => parseBlockPayload(journalStripBlock, section.payload).limit,
    categorySlug: (section: PageSection) =>
      parseBlockPayload(journalStripBlock, section.payload).category_slug,
  },
} as const

export type ReferenceBlockType = keyof typeof SELECTORS

export function isReferenceBlock(blockType: string): blockType is ReferenceBlockType {
  return Object.hasOwn(SELECTORS, blockType)
}

export async function loadPageReferences(
  client: SelectorClient,
  sections: readonly PageSection[],
): Promise<PageReferences> {
  const referencing = sections.filter((section) => isReferenceBlock(section.block_type))
  if (referencing.length === 0) return new Map()

  const resolved = await Promise.all(
    referencing.map(async (section) => {
      const config = SELECTORS[section.block_type as ReferenceBlockType]
      const result = await config.select(client, {
        limit: config.limit(section),
        categorySlug: config.categorySlug(section),
      })

      // One media query per block rather than one per card. With no cards it issues none at all,
      // because `listMediaAssetsByIds` short-circuits an empty list.
      const mediaIds = result.cards
        .map((card: EntityCard) => card.mediaId)
        .filter((id): id is string => id !== null)
      const assets = await listMediaAssetsByIds(client, mediaIds)

      return [section.id, { result, assets }] as const
    }),
  )

  return new Map(resolved)
}
