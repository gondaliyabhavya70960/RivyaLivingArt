import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import { collectionSchema, type Collection } from '../schemas'
import { NotFoundError } from '../errors'
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
