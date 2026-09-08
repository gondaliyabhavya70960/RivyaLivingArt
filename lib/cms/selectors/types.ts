import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/database.types'

/**
 * The seam between a reference block and the entities it shows.
 *
 * WHY A SEAM AT ALL, when three blocks could each query what they need. Because the question those
 * blocks ask changes and the blocks do not: `selected-works` today means "the newest few products",
 * and in Phase 22 it means "whatever the owner curated in Studio → Merchandising → Homepage". If
 * the query lived in the renderer, Phase 22 would edit the renderer — and the renderer is where
 * layout, art direction and the empty state live, none of which is changing. The seam is what
 * makes that a swap of one file.
 *
 * EVERY SELECTOR MAY LEGITIMATELY RETURN NOTHING, and this is the property the whole design rests
 * on. `products` has no published rows, `portfolio_projects` does not exist until Phase 17 and
 * `journal_articles` until Phase 18. A selector that threw on a missing table would take the
 * homepage down; one that returned a placeholder would fabricate. Empty is the third answer, and
 * it is the true one.
 *
 * THE RESULT IS DELIBERATELY THIN. A selector returns what a CARD needs and nothing more — no
 * price, no dimensions, no availability — so that a block cannot accidentally render commercial
 * detail about an object nobody has confirmed exists. Phase 15 gives the product page richer data
 * through its own read path.
 */

export type SelectorClient = SupabaseClient<Database>

/** What a reference block draws for one entity. Nothing here is a commercial claim. */
export type EntityCard = {
  readonly id: string
  /** The card's own name, and its `data-entry-key`. */
  readonly key: string
  readonly title: string
  readonly summary: string | null
  readonly href: string
  /** `media_assets.id`, resolved by the caller through `lib/cms/media.ts`. */
  readonly mediaId: string | null
}

export type SelectorResult = {
  readonly cards: readonly EntityCard[]
  /**
   * Why there are none, when there are none.
   *
   * `'EMPTY'` — the table exists and holds nothing this selector may show.
   * `'NOT_YET_BUILT'` — the table does not exist; a later phase creates it.
   *
   * The two look identical on the page, and they are distinguished for the one reader who needs
   * the difference: whoever is deciding whether the site is broken or merely young. It is reported
   * through the block's `data-empty-reason` attribute, never as words a visitor sees.
   */
  readonly reason: 'OK' | 'EMPTY' | 'NOT_YET_BUILT'
}

export type EntitySelector = (
  client: SelectorClient,
  options: { readonly limit: number; readonly categorySlug?: string | null },
) => Promise<SelectorResult>

/** The answer every selector gives for a table that does not exist yet. */
export const NOT_YET_BUILT: SelectorResult = { cards: [], reason: 'NOT_YET_BUILT' }

/** The answer for a table that exists and has nothing to show. */
export const EMPTY: SelectorResult = { cards: [], reason: 'EMPTY' }

/**
 * PostgREST's answer for a relation that is not in the schema cache.
 *
 * `42P01` is PostgreSQL's own `undefined_table`; PostgREST also answers `PGRST205` when the table
 * is absent from its cached schema. Matching both means a selector behaves the same whether the
 * table was never created or was created after the cache was built — the second being exactly what
 * happens the first time Phase 17's migration runs against a live project.
 */
export function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}
