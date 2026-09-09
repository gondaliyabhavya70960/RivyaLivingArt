import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import { collectionSchema, type Collection } from '../schemas'
import { NotFoundError, PermissionError } from '../errors'
import { parseRow, parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'collection'

/**
 * Collection reads.
 *
 * A collection is an exhibition, not a filtered grid.
 *
 * NOTHING HERE FILTERS ON `status`, and that is the rule rather than an omission. The public site
 * sees published rows because RLS says so, once, in a policy; a repository that remembered to add
 * `.eq('status','PUBLISHED')` would be a second copy of the publication rule, and the copy that is
 * wrong is always the one nobody is looking at. `listCollections` therefore serves the public route
 * and the Studio alike — the difference is which client is passed in.
 *
 * PUBLISHING A COLLECTION PASSES THROUGH TWO GATES, not one, and they are easy to confuse:
 *
 *   * `collections_verified_before_publish` — Phase 03. Refuses PUBLISHED while
 *     `owner_verification = 'OWNER_VERIFICATION_REQUIRED'`.
 *   * `enforce_collection_publish_gate` — Phase 16. Refuses PUBLISHED unless
 *     `concept_state = 'OWNER_CONFIRMED'` (FEAT §9).
 *
 * The ten seeded concepts are therefore seeded `NOT_REQUIRED`: seeding them
 * OWNER_VERIFICATION_REQUIRED is the instinct given D10, and it would mean an owner who confirms a
 * concept still cannot publish it, refused by a Phase 03 constraint nobody is looking at. The
 * concept gate is the gate; the verification flag is not a second lock on the same door.
 */

export async function listCollections(client: Client): Promise<Collection[]> {
  const { data, error } = await client
    .from('collections')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('slug', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'list', 'all', error)
  return parseRows(ENTITY, collectionSchema, data ?? [])
}

export async function getCollectionBySlug(client: Client, slug: string): Promise<Collection> {
  const { data, error } = await client
    .from('collections')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'get', slug, error)
  if (!data) throw new NotFoundError(ENTITY, slug)
  return parseRow(ENTITY, collectionSchema, data)
}

/**
 * The products an editor curated into this collection, in their chosen order.
 *
 * NO STATUS FILTER, for the reason in the header — and it matters more here than anywhere else in
 * this file. `product_collections`'s public policy tests BOTH parents, so an anonymous caller
 * reading a published collection's curation simply does not see the rows for unpublished products.
 * That is the phase's "every related target re-filtered to PUBLISHED" requirement, discharged by
 * the policy rather than by a `.eq()` this function could forget.
 *
 * A curated product that has been unpublished therefore leaves no gap and no placeholder card: the
 * join row is invisible, so the band renders one fewer product.
 */
export async function curatedProductIds(client: Client, collectionId: string): Promise<string[]> {
  const { data, error } = await client
    .from('product_collections')
    .select('product_id, sort_order')
    .eq('collection_id', collectionId)
    .order('sort_order', { ascending: true })
    .order('product_id', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'curated-products', collectionId, error)
  return (data ?? []).map((row) => row.product_id)
}

/**
 * A collection and the exhibition page it renders through, in one round trip.
 *
 * THE PAGE IS WHAT DECIDES WHETHER THE ROUTE EXISTS. `pages_select_public` tests three things —
 * PUBLISHED, a non-null path, and the schedule window — where `collections_select_public` tests
 * only the status. So a collection can be readable while its page is not, and the route must 404 on
 * that rather than render an exhibition with no sections. Returning both lets the caller see it.
 */
export async function getCollectionPageId(
  client: Client,
  collectionId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from('collections')
    .select('page_id')
    .eq('id', collectionId)
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'get-page', collectionId, error)
  return data?.page_id ?? null
}

/**
 * The collection an exhibition page belongs to, by `pages.id`.
 *
 * THE REVERSE OF `getCollectionPageId`, AND THE ONE THE RENDERER NEEDS. A `collection-products`
 * band on an exhibition page carries no collection slug: it asks for "the collection this page
 * belongs to", and `collections.page_id` — unique, foreign-keyed — is the only record of that. The
 * alternative would be to copy the slug into the block payload, where it would be a second opinion
 * about the same fact and would go stale the moment the page was repointed.
 *
 * `maybeSingle`, NOT `single`: most pages belong to no collection at all, and that is the ordinary
 * case rather than an error. The column is unique, so there is never more than one.
 */
export async function getCollectionIdForPage(
  client: Client,
  pageId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from('collections')
    .select('id')
    .eq('page_id', pageId)
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'for-page', pageId, error)
  return data?.id ?? null
}

/**
 * A collection's id from its slug, for a band that names one explicitly.
 *
 * A SLUG THAT MATCHES NOTHING IS `null`, NOT AN ERROR. It is typed into Studio by a person, and it
 * may name a collection that is unpublished, retired or misspelt — all of which are an empty band
 * on the public site, not a 500. The distinction the visitor sees is none; the distinction the
 * band reports through `data-empty-reason` is `EMPTY`.
 */
export async function getCollectionIdBySlug(client: Client, slug: string): Promise<string | null> {
  const { data, error } = await client
    .from('collections')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'id-by-slug', slug, error)
  return data?.id ?? null
}

/** One curated piece, as the Studio curator holds it. */
export type CuratedEntry = {
  readonly productId: string
  readonly sortOrder: number
}

/**
 * The curation as staff see it: every piece, published or not, in the curator's order.
 *
 * DELIBERATELY NOT `curatedProductIds`. That one is the public read and is filtered by RLS to what
 * a visitor may see; this one is what the editor is arranging, and a draft piece missing from the
 * list they are reordering would be silently dropped the moment they saved.
 */
export async function listCuratedEntries(
  client: Client,
  collectionId: string,
): Promise<CuratedEntry[]> {
  const { data, error } = await client
    .from('product_collections')
    .select('product_id, sort_order')
    .eq('collection_id', collectionId)
    .order('sort_order', { ascending: true })
    .order('product_id', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'curated-entries', collectionId, error)
  return (data ?? []).map((row) => ({ productId: row.product_id, sortOrder: row.sort_order }))
}

/**
 * Replace a collection's curation, as a VERIFIED DIFF.
 *
 * THE READ-BACK IS NOT BELT AND BRACES. `product_collections`'s delete policy admits `catalog.write`
 * — owner, admin and merchandiser — and an RLS-filtered DELETE removes zero rows and reports
 * SUCCESS. A "replace" written as delete-then-insert would therefore become an append for any role
 * the policy does not admit, and the editor would be told their reordering saved. So the removals
 * are confirmed to have actually gone before this returns.
 *
 * ORDER CHANGES ARE UPDATES, NOT A DELETE AND RE-INSERT. Reordering is not a destructive act and
 * must not need destructive permission — and re-inserting would also discard `created_by` and
 * `created_at`, losing who first put a piece in the collection.
 */
export async function setCuratedProducts(
  client: Client,
  collectionId: string,
  entries: readonly CuratedEntry[],
  actorId: string,
): Promise<void> {
  const existing = await listCuratedEntries(client, collectionId)
  const wanted = new Map(entries.map((entry) => [entry.productId, entry.sortOrder]))

  const removed = existing.filter((entry) => !wanted.has(entry.productId))
  if (removed.length > 0) {
    const { error } = await client
      .from('product_collections')
      .delete()
      .eq('collection_id', collectionId)
      .in(
        'product_id',
        removed.map((entry) => entry.productId),
      )
    if (error) throw toRepositoryError(ENTITY, 'curation-remove', collectionId, error)

    const after = await listCuratedEntries(client, collectionId)
    const stillThere = after.filter((entry) => !wanted.has(entry.productId))
    if (stillThere.length > 0) {
      // The count is not in the message: `PermissionError` names the operation and the entity, and
      // an editor sees the Studio's wording rather than this. What matters is that it THROWS.
      throw new PermissionError('curation-remove', ENTITY)
    }
  }

  const known = new Map(existing.map((entry) => [entry.productId, entry.sortOrder]))
  for (const entry of entries) {
    if (!known.has(entry.productId)) {
      const { error } = await client.from('product_collections').insert({
        collection_id: collectionId,
        product_id: entry.productId,
        sort_order: entry.sortOrder,
        created_by: actorId,
      })
      if (error) throw toRepositoryError(ENTITY, 'curation-add', entry.productId, error)
    } else if (known.get(entry.productId) !== entry.sortOrder) {
      const { error } = await client
        .from('product_collections')
        .update({ sort_order: entry.sortOrder })
        .eq('collection_id', collectionId)
        .eq('product_id', entry.productId)
      if (error) throw toRepositoryError(ENTITY, 'curation-order', entry.productId, error)
    }
  }
}

/**
 * Point a collection at its exhibition page.
 *
 * THE WRITE IS READ BACK for the same reason every other write here is: `collections_update_staff`
 * filters, so a role the policy does not admit changes nothing and is told it worked. Here that
 * would leave a `pages` row with no collection and a collection with no page — an exhibition that
 * exists at a URL and is linked to nothing.
 *
 * SETTING `page_id` IS WHAT FIXES THE PATH. `collections_sync_page_path` fires on this column and
 * writes `/collections/<lower slug>` onto the page, so the caller does not have to keep the two in
 * step and cannot get them out of step.
 */
export async function linkCollectionPage(
  client: Client,
  collectionId: string,
  pageId: string,
): Promise<void> {
  const { error } = await client
    .from('collections')
    .update({ page_id: pageId })
    .eq('id', collectionId)
  if (error) throw toRepositoryError(ENTITY, 'link-page', collectionId, error)

  const linked = await getCollectionPageId(client, collectionId)
  if (linked !== pageId) {
    throw new PermissionError('link-page', ENTITY)
  }
}
