import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import { productSchema, type Product } from '../schemas'
import { NotFoundError } from '../errors'
import { parseRow, parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'product'

/**
 * Product reads.
 *
 * THIS FILE CONTAINS NO INSERT. `products` ships with zero rows and stays that way under seed
 * policy (requirement §32): a product exists because an owner typed it in the Studio (Phase 14) or
 * because an approved import created it. Adding a create function here before that surface exists
 * would be the first step toward fabricated inventory, which D10 forbids outright.
 */

export async function listProductsByCategory(
  client: Client,
  categoryId: string,
): Promise<Product[]> {
  const { data, error } = await client
    .from('products')
    .select('*')
    .eq('category_id', categoryId)
    .order('published_at', { ascending: false, nullsFirst: false })

  if (error) throw toRepositoryError(ENTITY, 'list', categoryId, error)
  return parseRows(ENTITY, productSchema, data ?? [])
}

export async function listLargeFormatProducts(client: Client): Promise<Product[]> {
  const { data, error } = await client
    .from('products')
    .select('*')
    .eq('is_large_format', true)
    .order('published_at', { ascending: false, nullsFirst: false })

  if (error) throw toRepositoryError(ENTITY, 'list', 'large-format', error)
  return parseRows(ENTITY, productSchema, data ?? [])
}

/**
 * The order `product_media` rows render in on a product page: by role, then by the owner's
 * `sort_order` within a role.
 *
 * DECLARED HERE RATHER THAN SORTED IN SQL because `role` is `text` with a check constraint, not an
 * enum, so PostgreSQL has no opinion about which role comes first — an `order by role` would sort
 * alphabetically and put `detail` before `hero`. This is DATA_MODEL §2.1's vocabulary in the
 * sequence a page reads: the piece itself, then the set, then the close looks, then it in a room,
 * then the process behind it, then moving image, then the model.
 */
const MEDIA_ROLE_ORDER = [
  'hero',
  'gallery',
  'detail',
  'lifestyle',
  'process',
  'video',
  'model',
] as const

/** A role the constraint allows but this ordering has no place for sorts last, not first. */
function roleRank(role: string | null): number {
  if (role === null) return MEDIA_ROLE_ORDER.length + 1
  const index = (MEDIA_ROLE_ORDER as readonly string[]).indexOf(role)
  return index === -1 ? MEDIA_ROLE_ORDER.length : index
}

export type ProductMediaEdge = {
  readonly media_asset_id: string
  readonly role: string | null
  readonly sort_order: number | null
}

/**
 * The gallery edges for one product, in render order.
 *
 * A PUBLIC READ, unlike `listProductMediaIds` in `catalog-admin.ts`, which is the Studio's. The
 * separation is not ceremony: this one is called with the request-scoped anon client on a route a
 * visitor loads, so `product_media_select_public` decides what comes back — edges whose parent
 * product is published. The Studio's read runs under a staff session and sees drafts.
 */
export async function listProductMediaEdges(
  client: Client,
  productId: string,
): Promise<ProductMediaEdge[]> {
  const { data, error } = await client
    .from('product_media')
    .select('media_asset_id, role, sort_order')
    .eq('product_id', productId)

  if (error) throw toRepositoryError(ENTITY, 'list-media', productId, error)

  return [...(data ?? [])].sort(
    (a, b) =>
      roleRank(a.role) - roleRank(b.role) ||
      // Null sorts last within a role — unplaced, not first, the same rule the listing uses.
      (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER) ||
      a.media_asset_id.localeCompare(b.media_asset_id),
  )
}

/** The material ids attached to one product, as a visitor may see them. */
export async function listProductMaterialIdsPublic(
  client: Client,
  productId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from('product_materials')
    .select('material_id')
    .eq('product_id', productId)

  if (error) throw toRepositoryError(ENTITY, 'list-materials', productId, error)
  return (data ?? []).map((row) => row.material_id)
}

export async function getProductBySlug(client: Client, slug: string): Promise<Product> {
  const { data, error } = await client.from('products').select('*').eq('slug', slug).maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'get', slug, error)
  if (!data) throw new NotFoundError(ENTITY, slug)
  return parseRow(ENTITY, productSchema, data)
}

/**
 * Trigram search over title.
 *
 * `ilike` with leading and trailing wildcards is what the `products_title_trgm_idx` GIN index
 * exists to serve; without that index this degrades to a sequential scan, which is why the index
 * and this function must move together.
 *
 * The search term is passed as a bound parameter by PostgREST, but `%` and `_` inside it are still
 * pattern metacharacters, so they are escaped here. Otherwise a user searching for "50%" matches
 * every product.
 */
export async function searchProductsByTitle(
  client: Client,
  term: string,
  limit = 20,
): Promise<Product[]> {
  const escaped = term.replace(/([\\%_])/g, '\\$1')

  const { data, error } = await client
    .from('products')
    .select('*')
    .ilike('title', `%${escaped}%`)
    .limit(limit)

  if (error) throw toRepositoryError(ENTITY, 'search', term, error)
  return parseRows(ENTITY, productSchema, data ?? [])
}

/**
 * The two facts the commission configurator needs about a product, and nothing else.
 *
 * NOT `getProductBySlug`, WHICH THROWS. That function is for a product page, where a slug that
 * resolves to nothing is a 404. Here the slug came from a query parameter — a link somebody shared,
 * a URL somebody edited, a piece that has since been unpublished — and the right answer is to open
 * the default brief rather than to take the page down. Null is that answer.
 *
 * IT RETURNS AN ID AND A CATEGORY, deliberately not a `Product`. What the configurator does with it
 * is choose a form and pre-fill one field; handing it the whole row would invite a second reading
 * of the same product from a component that has no business rendering one.
 */
export async function getProductForCommission(
  client: Client,
  slug: string,
): Promise<{ id: string; categoryId: string | null; categorySlug: string | null } | null> {
  const { data, error } = await client
    .from('products')
    .select('id, category_id, categories(slug)')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'get-for-commission', slug, error)
  if (data === null) return null

  const category = data.categories as { slug?: string } | null
  return {
    id: data.id,
    categoryId: data.category_id,
    categorySlug: category?.slug ?? null,
  }
}
