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
import { NotFoundError } from '../errors'
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
 * DELETE THEN INSERT, not a diff. The join table has no surrogate key and no ordering, so there is
 * nothing a diff would preserve; two statements are also two chances for RLS to refuse an editor
 * who should not be here, rather than one.
 */
export async function setProductMaterials(
  client: Client,
  productId: string,
  materialIds: readonly string[],
  actorId: string | null,
): Promise<void> {
  const { error: deleteError } = await client
    .from('product_materials')
    .delete()
    .eq('product_id', productId)
  if (deleteError) throw toRepositoryError(PRODUCT, 'set-materials', productId, deleteError)

  if (materialIds.length === 0) return

  const { error } = await client.from('product_materials').insert(
    [...new Set(materialIds)].map((materialId) => ({
      product_id: productId,
      material_id: materialId,
      created_by: actorId,
    })),
  )
  if (error) throw toRepositoryError(PRODUCT, 'set-materials', productId, error)
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
