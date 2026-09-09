import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, TablesInsert, TablesUpdate } from '../database.types'
import {
  categorySchema,
  collectionSchema,
  materialSchema,
  productSchema,
  type Category,
  type Collection,
  type Material,
  type Product,
} from '../schemas'
import { NotFoundError, PermissionError } from '../errors'
import { parseRow, parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

/**
 * The catalogue's WRITE side — everything `/studio/catalog/**` needs and nothing the public site
 * does.
 *
 * SEPARATE FROM `products.ts`, WHICH CONTAINS NO INSERT AND MUST NOT. That file's header says why:
 * `products` ships with zero rows and stays that way under seed policy, so a create function
 * sitting next to the public reads would be the first step toward fabricated inventory. The
 * functions here exist because Phase 14 built the surface an owner types a product into — the only
 * legitimate origin for one (SEED §32).
 *
 * EVERY WRITE GOES THROUGH THE REQUEST-SCOPED CLIENT, never the service role. The RLS policies
 * already say that `catalog` writes belong to `owner`, `admin` and `merchandiser`; using the
 * caller's own client means an editor whose role was revoked between page load and save is refused
 * by the database as well as by the guard in the Server Action.
 *
 * NOTHING HERE FILTERS ON `status`. Studio must show drafts — they are the whole point of the
 * screen — and RLS already decides what this client may see.
 */

const PRODUCT = 'product'
const CATEGORY = 'category'
const MATERIAL = 'material'
const COLLECTION = 'collection'

// --- products ----------------------------------------------------------------------------------

export interface StudioProductFilter {
  readonly status?: Database['public']['Enums']['content_status']
  readonly categoryId?: string
  /** Matches title or slug. Trigram-indexed on title; the slug half is an ordinary prefix scan. */
  readonly search?: string
}

export async function listProductsForStudio(
  client: Client,
  filter: StudioProductFilter = {},
  limit = 200,
): Promise<Product[]> {
  let query = client.from('products').select('*')

  if (filter.status !== undefined) query = query.eq('status', filter.status)
  if (filter.categoryId !== undefined) query = query.eq('category_id', filter.categoryId)
  if (filter.search !== undefined && filter.search.trim() !== '') {
    // `%` and `_` inside the term are pattern metacharacters; escaped, or a search for "50%"
    // matches every product. The same guard `searchProductsByTitle` applies.
    const escaped = filter.search.trim().replace(/([\\%_])/g, '\\$1')
    query = query.or(`title.ilike.%${escaped}%,slug.ilike.%${escaped}%`)
  }

  const { data, error } = await query
    .order('updated_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(limit)

  if (error) throw toRepositoryError(PRODUCT, 'list', 'studio', error)
  return parseRows(PRODUCT, productSchema, data ?? [])
}

export async function getProductById(client: Client, id: string): Promise<Product> {
  const { data, error } = await client.from('products').select('*').eq('id', id).maybeSingle()
  if (error) throw toRepositoryError(PRODUCT, 'get', id, error)
  if (!data) throw new NotFoundError(PRODUCT, id)
  return parseRow(PRODUCT, productSchema, data)
}

export async function insertProduct(
  client: Client,
  values: TablesInsert<'products'>,
): Promise<Product> {
  const { data, error } = await client.from('products').insert(values).select('*').single()
  if (error) throw toRepositoryError(PRODUCT, 'create', values.slug, error)
  return parseRow(PRODUCT, productSchema, data)
}

export async function updateProduct(
  client: Client,
  id: string,
  values: TablesUpdate<'products'>,
): Promise<Product> {
  const { data, error } = await client
    .from('products')
    .update(values)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw toRepositoryError(PRODUCT, 'update', id, error)
  return parseRow(PRODUCT, productSchema, data)
}

/** The material ids linked to one product. */
export async function listProductMaterialIds(client: Client, productId: string): Promise<string[]> {
  const { data, error } = await client
    .from('product_materials')
    .select('material_id')
    .eq('product_id', productId)

  if (error) throw toRepositoryError(PRODUCT, 'list-materials', productId, error)
  return (data ?? []).map((row) => row.material_id)
}

/**
 * Replace a product's materials with exactly this set.
 *
 * A DIFF, NOT DELETE-THEN-INSERT, AND THE REASON IS RLS. `product_materials` carries
 * `deletePermission: 'destructive.execute'` (lib/auth/table-permissions.ts), so its DELETE policy
 * admits `owner` and `admin` only, while its INSERT policy also admits `merchandiser`. That split
 * is deliberate. What is not deliberate is what a blanket `delete().eq('product_id', …)` does under
 * it: **RLS filters a DELETE, it does not refuse one.** A merchandiser's delete matches zero rows,
 * PostgREST returns success with no error, and the insert that follows then ADDS to the set that
 * was supposed to be replaced. The editor reports a save, the removed material is still attached,
 * and nothing anywhere says so. Materials could only ever accumulate.
 *
 * So: work out what actually has to change, delete only that, and then LOOK AGAIN. Reading the
 * rows back is the only way to learn whether a filtered delete removed anything, because the
 * driver cannot tell "deleted nothing" from "there was nothing to delete". A removal that did not
 * happen raises PermissionError instead of reporting success.
 *
 * The diff has a second effect worth having: a merchandiser who only ADDS materials never issues a
 * destructive statement at all, so the common edit stays inside the permission they hold.
 */
export async function setProductMaterials(
  client: Client,
  productId: string,
  materialIds: readonly string[],
  actorId: string | null,
): Promise<void> {
  const wanted = [...new Set(materialIds)]
  const current = await listProductMaterialIds(client, productId)

  const removed = current.filter((id) => !wanted.includes(id))
  const added = wanted.filter((id) => !current.includes(id))

  if (removed.length > 0) {
    const { error: deleteError } = await client
      .from('product_materials')
      .delete()
      .eq('product_id', productId)
      .in('material_id', removed)
    if (deleteError) throw toRepositoryError(PRODUCT, 'set-materials', productId, deleteError)

    const survivors = await listProductMaterialIds(client, productId)
    if (removed.some((id) => survivors.includes(id))) {
      throw new PermissionError('set-materials', PRODUCT)
    }
  }

  if (added.length === 0) return

  const { error } = await client.from('product_materials').insert(
    added.map((materialId) => ({
      product_id: productId,
      material_id: materialId,
      created_by: actorId,
    })),
  )
  if (error) throw toRepositoryError(PRODUCT, 'set-materials', productId, error)
}

/**
 * Material and gallery counts for MANY products at once, for the Studio list's readiness column.
 *
 * TWO QUERIES, NOT TWO PER ROW. The list renders the whole catalogue, and asking per product would
 * make the screen's cost grow with it. Both joins are read in one round trip each and grouped here.
 *
 * A product with no rows is simply absent from the map, and the caller reads that as zero — which
 * is the honest answer and the one `readinessChecklist` wants.
 */
export async function joinCountsForProducts(
  client: Client,
  productIds: readonly string[],
): Promise<{ materials: Map<string, number>; gallery: Map<string, number> }> {
  const empty = { materials: new Map<string, number>(), gallery: new Map<string, number>() }
  if (productIds.length === 0) return empty

  const [materialRows, mediaRows] = await Promise.all([
    client
      .from('product_materials')
      .select('product_id')
      .in('product_id', [...productIds]),
    client
      .from('product_media')
      .select('product_id')
      .in('product_id', [...productIds]),
  ])

  // The "id" is the batch rather than one row, so it names the batch.
  const batch = `${String(productIds.length)} products`
  if (materialRows.error) {
    throw toRepositoryError(PRODUCT, 'list-material-counts', batch, materialRows.error)
  }
  if (mediaRows.error) {
    throw toRepositoryError(PRODUCT, 'list-media-counts', batch, mediaRows.error)
  }

  const tally = (rows: readonly { product_id: string }[]): Map<string, number> => {
    const counts = new Map<string, number>()
    for (const row of rows) counts.set(row.product_id, (counts.get(row.product_id) ?? 0) + 1)
    return counts
  }

  return { materials: tally(materialRows.data ?? []), gallery: tally(mediaRows.data ?? []) }
}

/** The gallery: every `product_media` row for one product, hero excluded by the caller. */
export async function listProductMediaIds(client: Client, productId: string): Promise<string[]> {
  const { data, error } = await client
    .from('product_media')
    .select('media_asset_id')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true, nullsFirst: false })

  if (error) throw toRepositoryError(PRODUCT, 'list-media', productId, error)
  return (data ?? []).map((row) => row.media_asset_id)
}

// --- categories, materials, collections ----------------------------------------------------------

export async function listCategoriesForStudio(client: Client): Promise<Category[]> {
  const { data, error } = await client
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('slug', { ascending: true })
  if (error) throw toRepositoryError(CATEGORY, 'list', 'studio', error)
  return parseRows(CATEGORY, categorySchema, data ?? [])
}

export async function getCategoryByIdForStudio(client: Client, id: string): Promise<Category> {
  const { data, error } = await client.from('categories').select('*').eq('id', id).maybeSingle()
  if (error) throw toRepositoryError(CATEGORY, 'get', id, error)
  if (!data) throw new NotFoundError(CATEGORY, id)
  return parseRow(CATEGORY, categorySchema, data)
}

export async function updateCategoryRow(
  client: Client,
  id: string,
  values: TablesUpdate<'categories'>,
): Promise<Category> {
  const { data, error } = await client
    .from('categories')
    .update(values)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw toRepositoryError(CATEGORY, 'update', id, error)
  return parseRow(CATEGORY, categorySchema, data)
}

export async function listMaterialsForStudio(client: Client): Promise<Material[]> {
  const { data, error } = await client
    .from('materials')
    .select('*')
    .order('family', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw toRepositoryError(MATERIAL, 'list', 'studio', error)
  return parseRows(MATERIAL, materialSchema, data ?? [])
}

export async function insertMaterial(
  client: Client,
  values: TablesInsert<'materials'>,
): Promise<Material> {
  const { data, error } = await client.from('materials').insert(values).select('*').single()
  if (error) throw toRepositoryError(MATERIAL, 'create', values.slug, error)
  return parseRow(MATERIAL, materialSchema, data)
}

export async function updateMaterialRow(
  client: Client,
  id: string,
  values: TablesUpdate<'materials'>,
): Promise<Material> {
  const { data, error } = await client
    .from('materials')
    .update(values)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw toRepositoryError(MATERIAL, 'update', id, error)
  return parseRow(MATERIAL, materialSchema, data)
}

export async function listCollectionsForStudio(client: Client): Promise<Collection[]> {
  const { data, error } = await client
    .from('collections')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw toRepositoryError(COLLECTION, 'list', 'studio', error)
  return parseRows(COLLECTION, collectionSchema, data ?? [])
}

export async function insertCollection(
  client: Client,
  values: TablesInsert<'collections'>,
): Promise<Collection> {
  const { data, error } = await client.from('collections').insert(values).select('*').single()
  if (error) throw toRepositoryError(COLLECTION, 'create', values.slug, error)
  return parseRow(COLLECTION, collectionSchema, data)
}

export async function updateCollectionRow(
  client: Client,
  id: string,
  values: TablesUpdate<'collections'>,
): Promise<Collection> {
  const { data, error } = await client
    .from('collections')
    .update(values)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw toRepositoryError(COLLECTION, 'update', id, error)
  return parseRow(COLLECTION, collectionSchema, data)
}

/** Slugs and SKUs already taken, for the FEAT §21 duplicate rules. Excludes the row being edited. */
export async function takenProductIdentifiers(
  client: Client,
  excludeId: string | null,
): Promise<{ slugs: Set<string>; skus: Set<string> }> {
  let query = client.from('products').select('id, slug, sku')
  if (excludeId !== null) query = query.neq('id', excludeId)

  const { data, error } = await query
  if (error) throw toRepositoryError(PRODUCT, 'list', 'identifiers', error)

  const slugs = new Set<string>()
  const skus = new Set<string>()
  for (const row of data ?? []) {
    slugs.add(row.slug.toLowerCase())
    if (row.sku !== null) skus.add(row.sku.toLowerCase())
  }
  return { slugs, skus }
}
