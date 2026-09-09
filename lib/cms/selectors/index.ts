import 'server-only'

import {
  listReferenceArticles,
  listReferenceProducts,
  listReferenceProjects,
  type ReferenceRow,
} from '@/lib/supabase/repositories/reference'

import { EMPTY, NOT_YET_BUILT, type EntityCard, type EntitySelector } from './types'

export * from './types'

/**
 * The three Phase 11 selectors.
 *
 * ALL THREE RETURN NOTHING TODAY, and each for a different reason worth keeping distinct:
 * `products` exists and is empty and will stay empty until Phase 14 (nothing seeds it — `products`
 * is not a member of the seed runner's `SeedableTable` union); `portfolio_projects` and
 * `journal_articles` do not exist at all until Phases 17 and 18. The renderers cannot tell the
 * difference and should not — a visitor sees the same editorial fallback either way — but the
 * reason travels as far as `data-empty-reason` so that whoever is deciding whether the site is
 * broken or merely young can read it without opening a database.
 *
 * ONE MAPPING FUNCTION, THREE HREF SHAPES. What differs between the families is where a card
 * points; everything else about a card is the same three fields and a picture. Writing three
 * near-identical mappers is how one of them acquires a price six months from now.
 */

function toCards(rows: readonly ReferenceRow[], hrefPrefix: string): EntityCard[] {
  return rows
    .filter((row) => row.title !== null && row.title.trim() !== '')
    .map((row) => ({
      id: row.id,
      // The slug, not the id: it is stable, human-readable, and it is what the detail route uses.
      key: row.slug,
      title: row.title ?? '',
      summary: row.summary,
      href: `${hrefPrefix}/${row.slug}`,
      mediaId: row.hero_media_id,
    }))
}

/**
 * Products for `selected-works`.
 *
 * `selection` AND `categorySlug` ARE ACCEPTED AND IGNORED IN PHASE 11, which is stated here rather
 * than hidden behind a TODO. The block's payload carries them because Phase 22 needs somewhere to
 * put the owner's merchandising choice, and a payload field added later would need a migration of
 * every existing row. Ignoring them costs nothing while every selection returns the same empty
 * answer, and the day it does not, this function changes and no block does.
 */
export const selectProducts: EntitySelector = async (client, { limit }) => {
  const rows = await listReferenceProducts(client, limit)
  if (rows === null) return NOT_YET_BUILT
  const cards = toCards(rows, '/product')
  return cards.length === 0 ? EMPTY : { cards, reason: 'OK' }
}

/** Delivered projects for `portfolio-strip`. The table arrives in Phase 17. */
export const selectProjects: EntitySelector = async (client, { limit }) => {
  const rows = await listReferenceProjects(client, limit)
  if (rows === null) return NOT_YET_BUILT
  const cards = toCards(rows, '/portfolio')
  return cards.length === 0 ? EMPTY : { cards, reason: 'OK' }
}

/** Articles for `journal-strip`. The table arrives in Phase 18. */
export const selectArticles: EntitySelector = async (client, { limit }) => {
  const rows = await listReferenceArticles(client, limit)
  if (rows === null) return NOT_YET_BUILT
  const cards = toCards(rows, '/journal')
  return cards.length === 0 ? EMPTY : { cards, reason: 'OK' }
}
