import 'server-only'

import {
  listCuratedProducts,
  listReferenceArticles,
  listReferenceProducts,
  listReferenceProjects,
  type ReferenceRow,
} from '@/lib/supabase/repositories/reference'

import { resolveSlot, type ResolvedSlot } from '@/lib/cms/merchandising'

import {
  EMPTY,
  NOT_YET_BUILT,
  type EntityCard,
  type EntitySelector,
  type SelectorResult,
} from './types'

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
      // Present only where the read asked for it — see `ReferenceRow.eyebrow`.
      eyebrow: row.eyebrow ?? null,
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
/**
 * Phase 22: a slot's answer in the selector's shape.
 *
 * `UNKNOWN_SLOT` BECOMES `NOT_YET_BUILT`, which is what it is: the row a later migration creates is
 * not there. The page shows the same fallback either way and `data-empty-reason` keeps the
 * distinction for whoever is reading the deploy rather than the site.
 */
function fromSlot(resolved: ResolvedSlot): SelectorResult {
  return {
    cards: resolved.cards,
    reason:
      resolved.reason === 'UNKNOWN_SLOT'
        ? 'NOT_YET_BUILT'
        : resolved.cards.length === 0
          ? 'EMPTY'
          : 'OK',
    merchandising: {
      slotKey: resolved.key,
      provenance: resolved.provenance,
      rule: resolved.rule,
      fallback: resolved.fallback,
    },
  }
}

/**
 * Products for `selected-works`.
 *
 * PHASE 22 SWAPPED THE BODY AND KEPT THE SIGNATURE, which is what the seam was for. Handed a
 * `slotKey`, this asks `resolveSlot` — the owner's curation in Studio → Merchandising → Homepage,
 * through the five-step ladder — and returns the ladder's answer with its provenance. Handed none,
 * it runs the Phase 11 read it always did (newest published), so a `selected-works` band on a page
 * with no slot still means "some products" and never "the homepage's products". No renderer
 * changed for the swap; `SelectedWorksSection` learned the fallback MODES afterwards, separately.
 */
export const selectProducts: EntitySelector = async (client, { limit, slotKey, now }) => {
  if (slotKey) return fromSlot(await resolveSlot(client, slotKey, { limit, now }))
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
export const selectArticles: EntitySelector = async (client, { limit, slotKey, now }) => {
  if (slotKey) return fromSlot(await resolveSlot(client, slotKey, { limit, now }))
  const rows = await listReferenceArticles(client, limit)
  if (rows === null) return NOT_YET_BUILT
  const cards = toCards(rows, '/journal')
  return cards.length === 0 ? EMPTY : { cards, reason: 'OK' }
}

/**
 * The pieces curated into one collection, for `collection-products`.
 *
 * THE ONLY SELECTOR THAT CAN ANSWER `EMPTY` FOR TWO DIFFERENT REASONS, and it treats them the
 * same on purpose. No `collectionId` means the band could not be tied to a collection at all —
 * a slug naming nothing, or an exhibition block on a page that belongs to no collection — and a
 * collection with no curated products means the owner has not attached any yet. A visitor sees
 * the same seeded sentence for both, because both are "there is nothing to show here", and
 * neither is a fault the visitor can do anything about. Whoever is diagnosing the page reads the
 * difference from the CMS, where the slug either resolves or does not.
 *
 * IT DOES NOT FALL BACK TO "SOME OTHER PRODUCTS". A band on an exhibition page that quietly showed
 * the newest three pieces instead of the collection's own would be presenting them as part of a
 * collection nobody put them in — the fabrication of a business fact in its quietest form.
 */
export const selectCollectionProducts: EntitySelector = async (client, { limit, collectionId }) => {
  if (!collectionId) return EMPTY
  const rows = await listCuratedProducts(client, collectionId, limit)
  const cards = toCards(rows, '/product')
  return cards.length === 0 ? EMPTY : { cards, reason: 'OK' }
}

/**
 * Featured collections and categories, for `featured-collections`.
 *
 * SLOT-ONLY. There is no "some collections" query to fall back to: which collections are featured
 * is the owner's decision or nobody's, and a band that showed the newest published collections
 * when no slot answered would be featuring by accident. Without a slot the band is EMPTY and its
 * fallback mode decides what that looks like.
 */
export const selectFeatured: EntitySelector = async (client, { limit, slotKey, now }) => {
  if (!slotKey) return EMPTY
  return fromSlot(await resolveSlot(client, slotKey, { limit, now }))
}
