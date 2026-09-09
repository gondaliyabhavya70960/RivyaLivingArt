import type { SupabaseClient } from '@supabase/supabase-js'

import { PAGE_SIZE, type CatalogQuery } from '@/lib/catalog/query'

import type { Database } from '../database.types'
import { productSchema, type Product } from '../schemas'
import { parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'catalog-listing'

/**
 * The listing read: one query for the page of rows, one for the facet counts.
 *
 * WHY TWO QUERIES AND NOT ONE. The rows are a PAGE — 24 of them, with an exact total — and the
 * facets are a summary of the WHOLE matching set. Asking for both in one round trip would mean
 * fetching every matching row to count them and then throwing all but 24 away, on every request.
 * The facet query asks for five columns and two id lists instead of whole rows, which is what
 * makes reading the whole set cheap enough to do honestly.
 *
 * FACET COUNTS COME FROM THE SAME PREDICATE AS THE ROWS. Every active filter applies to both, so a
 * count is literally "how many of the products you are looking at are this", and an option that
 * would return nothing does not appear at all. The rail therefore NARROWS as filters are applied,
 * which is the behaviour the phase asks for — no dead options, ever — and the trade-off is
 * recorded in `docs/project/BUSINESS_RULES.md`: swapping one value inside a dimension means
 * clearing it first, and the rail always renders the active values so clearing is always possible.
 *
 * NO `.eq('status', 'PUBLISHED')` ANYWHERE IN THIS FILE, deliberately, and the same reasoning as
 * `categories.ts`: the public site sees published rows because RLS says so. A status filter here
 * would be a second, forgettable copy of a rule the database already enforces — and on the Studio
 * client it would hide exactly the drafts a merchandiser is looking for.
 *
 * NO PRICE SORT. See `lib/catalog/query.ts`; three of the four price states carry no number.
 */

export interface CatalogListingFilters {
  /** Restricts to one category. Null lists across every category — the `/collection` landing. */
  readonly categoryId?: string | null
  /** Material ids, already resolved from the slugs in the URL. OR within the dimension. */
  readonly materialIds?: readonly string[]
  /** Collection ids, already resolved from the slugs in the URL. OR within the dimension. */
  readonly collectionIds?: readonly string[]
}

export interface CatalogListing {
  readonly rows: readonly Product[]
  /**
   * True when the requested page lies past the end of the result set.
   *
   * NOT AN ERROR AND NOT AN EMPTY PAGE. PostgREST answers an offset beyond the last row with
   * PGRST103 rather than an empty list, and a stale bookmark or a crawler following an old
   * `rel="next"` must not produce a 500. It is also not "no results": the results exist, at a
   * different address. The caller decides what to do with it, and both routes answer 404 —
   * `?page=99` of a two-page listing is not a page.
   */
  readonly beyondEnd: boolean
}

/** Counts per value, for one dimension. A value absent from the map has no matches at all. */
export interface CatalogFacets {
  readonly material: ReadonlyMap<string, number>
  readonly collection: ReadonlyMap<string, number>
  readonly price: ReadonlyMap<string, number>
  readonly availability: ReadonlyMap<string, number>
  readonly edition: ReadonlyMap<string, number>
  readonly largeFormat: number
  readonly customizable: number
  readonly total: number
}

/** The embedded shape both queries ask for when a join filter is active. */
const MATERIAL_EMBED = 'product_materials!inner(material_id)'
const COLLECTION_EMBED = 'product_collections!inner(collection_id)'

/**
 * `select=` for the rows query.
 *
 * An embed is added ONLY when its dimension is filtered, because `!inner` changes the meaning of
 * the query: with it, a product with no materials at all disappears from the listing. That is
 * correct when someone asked for oak and wrong when nobody asked for anything.
 */
function rowsSelect(filters: CatalogListingFilters): string {
  const parts = ['*']
  if ((filters.materialIds?.length ?? 0) > 0) parts.push(MATERIAL_EMBED)
  if ((filters.collectionIds?.length ?? 0) > 0) parts.push(COLLECTION_EMBED)
  return parts.join(', ')
}

/** `select=` for the facet query: the five facet columns, plus both id lists to count from. */
function facetsSelect(filters: CatalogListingFilters): string {
  const parts = [
    'id',
    'price_state',
    'availability_state',
    'edition_state',
    'is_large_format',
    'is_customizable',
  ]
  parts.push((filters.materialIds?.length ?? 0) > 0 ? MATERIAL_EMBED : 'product_materials(material_id)')
  parts.push(
    (filters.collectionIds?.length ?? 0) > 0
      ? COLLECTION_EMBED
      : 'product_collections(collection_id)',
  )
  return parts.join(', ')
}

/**
 * `any` ON THE BUILDER, TWICE, AND NOWHERE ELSE.
 *
 * PostgREST's builder type narrows with every chained call, so a filter applied conditionally
 * cannot be typed without rebuilding the chain for each combination of active filters — 128 of
 * them here. The escape hatch is confined to these two helpers, both of which return the builder
 * straight back to a typed `await`; nothing untyped crosses this module's boundary.
 */
function applyFilters(builder: any, query: CatalogQuery, filters: CatalogListingFilters): any {
  let next = builder
  if (filters.categoryId) next = next.eq('category_id', filters.categoryId)
  if (query.price.length > 0) next = next.in('price_state', query.price)
  if (query.availability.length > 0) next = next.in('availability_state', query.availability)
  if (query.edition.length > 0) next = next.in('edition_state', query.edition)
  if (query.largeFormat) next = next.eq('is_large_format', true)
  if (query.customizable) next = next.eq('is_customizable', true)
  if ((filters.materialIds?.length ?? 0) > 0) {
    next = next.in('product_materials.material_id', filters.materialIds)
  }
  if ((filters.collectionIds?.length ?? 0) > 0) {
    next = next.in('product_collections.collection_id', filters.collectionIds)
  }
  return next
}

/**
 * The sort, applied as PostgREST order clauses.
 *
 * EVERY SORT ENDS WITH `id`. Without a total order, two products with the same `sort_order` and
 * the same `published_at` can swap places between page 1 and page 2 — so one of them appears
 * twice and the other never appears at all. A stable tiebreaker is what makes pagination correct.
 *
 * `nullsFirst: false` on `sort_order` is the "curated, then the rest" rule: an unplaced product
 * falls in behind every placed one rather than jumping to the front.
 */
function applySort(builder: any, sort: CatalogQuery['sort']): any {
  switch (sort) {
    case 'newest':
      return builder
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: true })
    case 'title':
      return builder
        .order('title', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true })
    case 'curated':
      return builder
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: true })
  }
}

/** PostgREST's code for "the requested range starts past the last row". */
const RANGE_NOT_SATISFIABLE = 'PGRST103'

/**
 * One page of rows.
 *
 * IT ASKS FOR NO COUNT, deliberately. `count: 'exact'` makes PostgREST run the whole predicate a
 * second time to count it, and the facet query beside this one already reads every matching row —
 * so the total is free there and paid for twice here. `loadCatalogListing` takes it from the
 * facets, which also guarantees the two can never disagree about how many results exist.
 */
export async function listCatalogProducts(
  client: Client,
  query: CatalogQuery,
  filters: CatalogListingFilters = {},
): Promise<CatalogListing> {
  const from = (query.page - 1) * PAGE_SIZE

  const { data, error } = await applySort(
    applyFilters(client.from('products').select(rowsSelect(filters)), query, filters),
    query.sort,
  ).range(from, from + PAGE_SIZE - 1)

  if (error?.code === RANGE_NOT_SATISFIABLE) return { rows: [], beyondEnd: true }
  if (error) throw toRepositoryError(ENTITY, 'list', filters.categoryId ?? 'all', error)

  return { rows: parseRows(ENTITY, productSchema, data ?? []), beyondEnd: false }
}

interface FacetRow {
  price_state: string | null
  availability_state: string | null
  edition_state: string | null
  is_large_format: boolean | null
  is_customizable: boolean | null
  product_materials?: readonly { material_id: string }[] | null
  product_collections?: readonly { collection_id: string }[] | null
}

function increment(map: Map<string, number>, key: string | null): void {
  if (key === null) return
  map.set(key, (map.get(key) ?? 0) + 1)
}

export async function catalogFacetCounts(
  client: Client,
  query: CatalogQuery,
  filters: CatalogListingFilters = {},
): Promise<CatalogFacets> {
  const { data, error } = await applyFilters(
    client.from('products').select(facetsSelect(filters)),
    query,
    filters,
  )
  if (error) throw toRepositoryError(ENTITY, 'facets', filters.categoryId ?? 'all', error)

  const rows = (data ?? []) as unknown as readonly FacetRow[]

  const material = new Map<string, number>()
  const collection = new Map<string, number>()
  const price = new Map<string, number>()
  const availability = new Map<string, number>()
  const edition = new Map<string, number>()
  let largeFormat = 0
  let customizable = 0

  for (const row of rows) {
    increment(price, row.price_state)
    increment(availability, row.availability_state)
    increment(edition, row.edition_state)
    if (row.is_large_format) largeFormat += 1
    if (row.is_customizable) customizable += 1
    // A product counts ONCE per material, even if the join somehow carries a duplicate row.
    for (const id of new Set((row.product_materials ?? []).map((link) => link.material_id))) {
      increment(material, id)
    }
    for (const id of new Set((row.product_collections ?? []).map((link) => link.collection_id))) {
      increment(collection, id)
    }
  }

  return {
    material,
    collection,
    price,
    availability,
    edition,
    largeFormat,
    customizable,
    total: rows.length,
  }
}
