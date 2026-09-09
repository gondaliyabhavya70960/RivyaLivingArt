import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import { PermissionError } from '../errors'
import { productRelationSchema, type ProductRelation } from '../schemas'
import { parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'product-edge'

/**
 * The three join tables the Phase 15 Studio tabs write: `product_media`, `product_materials` notes
 * and `product_relations`.
 *
 * EVERY REMOVAL HERE IS A VERIFIED DIFF, AND THAT IS NOT DEFENSIVENESS. All three tables carry
 * `deletePermission: 'destructive.execute'`, so their DELETE policies admit `owner` and `admin`
 * while their INSERT policies also admit `merchandiser`. Under that split a blanket delete does
 * something worse than fail: **RLS FILTERS A DELETE, IT DOES NOT REFUSE ONE.** A merchandiser's
 * delete matches zero rows, PostgREST answers success with no error, and a subsequent insert then
 * ADDS to the set that was meant to be replaced. The editor is told it saved. The row is still
 * there. Nothing anywhere says so.
 *
 * The only way to learn whether a filtered delete removed anything is to read the rows back — the
 * driver cannot tell "deleted nothing" from "there was nothing to delete". So each removal below
 * looks again and raises `PermissionError` if a row it was told to remove survived. See the long
 * note on `setProductMaterials` in `catalog-admin.ts`, which found this the hard way.
 *
 * THE DIFF ALSO KEEPS THE COMMON EDIT INSIDE THE COMMON PERMISSION: a merchandiser who only adds
 * never issues a destructive statement at all.
 */

// --- product_media -------------------------------------------------------------------------------

/**
 * The roles `product_media.role` allows, in the order the gallery reads them.
 *
 * MIRRORS `product_media_role_allowed` FROM PHASE 03 and the `MEDIA_ROLE_ORDER` the public gallery
 * sorts by. Three copies of one list is two too many, but the constraint cannot import TypeScript
 * and the public read must not import the Studio's module — so the copies are named here so that a
 * grep for one finds the others.
 */
export const PRODUCT_MEDIA_ROLES = [
  'hero',
  'gallery',
  'detail',
  'lifestyle',
  'process',
  'video',
  'model',
] as const

export type ProductMediaRole = (typeof PRODUCT_MEDIA_ROLES)[number]

export interface ProductMediaEdge {
  readonly mediaAssetId: string
  readonly role: ProductMediaRole | null
  readonly sortOrder: number | null
}

export async function listProductMediaEdgesForStudio(
  client: Client,
  productId: string,
): Promise<ProductMediaEdge[]> {
  const { data, error } = await client
    .from('product_media')
    .select('media_asset_id, role, sort_order')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true, nullsFirst: false })
    // A total order. Two edges sharing a sort_order must not swap between requests, or the gallery
    // appears to reshuffle itself while nobody edits it.
    .order('media_asset_id', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'list-media', productId, error)
  return (data ?? []).map((row) => ({
    mediaAssetId: row.media_asset_id,
    // The column is plain text under a check constraint, so it is narrowed here rather than
    // trusted: a value outside the list means the constraint changed and this file did not.
    role: (PRODUCT_MEDIA_ROLES as readonly string[]).includes(row.role ?? '')
      ? (row.role as ProductMediaRole)
      : null,
    sortOrder: row.sort_order,
  }))
}

/**
 * Replace a product's media edges with exactly this set, in exactly this order.
 *
 * UPDATES ARE NOT DELETE-AND-REINSERT. An edge whose role or position changed is UPDATEd in place,
 * so reordering a gallery needs no destructive permission at all — only actually detaching an asset
 * does. That is the difference between a merchandiser being able to arrange a product's photographs
 * and having to ask an admin to do it.
 *
 * NOTHING HERE CHECKS `is_concept`. The Phase 14 trigger `product_media_reject_concept` refuses a
 * concept render on insert or update, and the Studio picker filters them out of the choices. A
 * third copy of the rule in this file would be a third place for it to drift; what this file must
 * do is let the trigger's error reach the caller unswallowed, which `toRepositoryError` does.
 */
export async function setProductMediaEdges(
  client: Client,
  productId: string,
  edges: readonly ProductMediaEdge[],
  actorId: string | null,
): Promise<void> {
  // Last write wins on a duplicated asset id, matching the primary key, rather than sending two
  // rows and letting the insert fail with a 23505 the editor cannot read.
  const wanted = new Map(edges.map((edge) => [edge.mediaAssetId, edge]))
  const current = await listProductMediaEdgesForStudio(client, productId)
  const currentById = new Map(current.map((edge) => [edge.mediaAssetId, edge]))

  const removed = current.filter((edge) => !wanted.has(edge.mediaAssetId))
  if (removed.length > 0) {
    const { error } = await client
      .from('product_media')
      .delete()
      .eq('product_id', productId)
      .in(
        'media_asset_id',
        removed.map((edge) => edge.mediaAssetId),
      )
    if (error) throw toRepositoryError(ENTITY, 'set-media', productId, error)

    const survivors = await listProductMediaEdgesForStudio(client, productId)
    const survivingIds = new Set(survivors.map((edge) => edge.mediaAssetId))
    if (removed.some((edge) => survivingIds.has(edge.mediaAssetId))) {
      throw new PermissionError('set-media', ENTITY)
    }
  }

  const added = [...wanted.values()].filter((edge) => !currentById.has(edge.mediaAssetId))
  if (added.length > 0) {
    const { error } = await client.from('product_media').insert(
      added.map((edge) => ({
        product_id: productId,
        media_asset_id: edge.mediaAssetId,
        role: edge.role,
        sort_order: edge.sortOrder,
        created_by: actorId,
      })),
    )
    if (error) throw toRepositoryError(ENTITY, 'set-media', productId, error)
  }

  const changed = [...wanted.values()].filter((edge) => {
    const existing = currentById.get(edge.mediaAssetId)
    return (
      existing !== undefined &&
      (existing.role !== edge.role || existing.sortOrder !== edge.sortOrder)
    )
  })

  for (const edge of changed) {
    const { error } = await client
      .from('product_media')
      .update({ role: edge.role, sort_order: edge.sortOrder })
      .eq('product_id', productId)
      .eq('media_asset_id', edge.mediaAssetId)
    if (error) throw toRepositoryError(ENTITY, 'set-media', productId, error)
  }

  // An UPDATE is filtered by RLS exactly as a DELETE is, so the same read-back applies: a
  // merchandiser whose reorder matched no rows would otherwise be told the gallery was rearranged.
  if (changed.length > 0) {
    const after = new Map(
      (await listProductMediaEdgesForStudio(client, productId)).map((edge) => [
        edge.mediaAssetId,
        edge,
      ]),
    )
    const stale = changed.some((edge) => {
      const now = after.get(edge.mediaAssetId)
      return now === undefined || now.role !== edge.role || now.sortOrder !== edge.sortOrder
    })
    if (stale) throw new PermissionError('set-media', ENTITY)
  }
}

// --- product_materials, with the note ------------------------------------------------------------

export interface ProductMaterialLink {
  readonly materialId: string
  /** The editor's sentence about how THIS material is used in THIS piece. Optional, never seeded. */
  readonly note: string | null
}

export async function listProductMaterialLinks(
  client: Client,
  productId: string,
): Promise<ProductMaterialLink[]> {
  const { data, error } = await client
    .from('product_materials')
    .select('material_id, note')
    .eq('product_id', productId)
    .order('material_id', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'list-materials', productId, error)
  return (data ?? []).map((row) => ({ materialId: row.material_id, note: row.note }))
}

/**
 * Replace a product's material links, notes included.
 *
 * A NOTE CHANGE IS AN UPDATE, for the same reason a reorder is above: editing the sentence beside a
 * material must not require the permission to detach it. `setProductMaterials` in `catalog-admin.ts`
 * handles the id-only case that the Phase 14 product form submits and is left alone; this is the
 * Materials tab's richer write, and the two never run against the same submission.
 */
export async function setProductMaterialLinks(
  client: Client,
  productId: string,
  links: readonly ProductMaterialLink[],
  actorId: string | null,
): Promise<void> {
  const wanted = new Map(links.map((link) => [link.materialId, link]))
  const current = await listProductMaterialLinks(client, productId)
  const currentById = new Map(current.map((link) => [link.materialId, link]))

  const removed = current.filter((link) => !wanted.has(link.materialId))
  if (removed.length > 0) {
    const { error } = await client
      .from('product_materials')
      .delete()
      .eq('product_id', productId)
      .in(
        'material_id',
        removed.map((link) => link.materialId),
      )
    if (error) throw toRepositoryError(ENTITY, 'set-materials', productId, error)

    const survivors = new Set(
      (await listProductMaterialLinks(client, productId)).map((link) => link.materialId),
    )
    if (removed.some((link) => survivors.has(link.materialId))) {
      throw new PermissionError('set-materials', ENTITY)
    }
  }

  const added = [...wanted.values()].filter((link) => !currentById.has(link.materialId))
  if (added.length > 0) {
    const { error } = await client.from('product_materials').insert(
      added.map((link) => ({
        product_id: productId,
        material_id: link.materialId,
        note: link.note,
        created_by: actorId,
      })),
    )
    if (error) throw toRepositoryError(ENTITY, 'set-materials', productId, error)
  }

  const changed = [...wanted.values()].filter((link) => {
    const existing = currentById.get(link.materialId)
    return existing !== undefined && existing.note !== link.note
  })

  for (const link of changed) {
    const { error } = await client
      .from('product_materials')
      .update({ note: link.note })
      .eq('product_id', productId)
      .eq('material_id', link.materialId)
    if (error) throw toRepositoryError(ENTITY, 'set-materials', productId, error)
  }
}

// --- product_relations ---------------------------------------------------------------------------

/**
 * What a relation may point at, and what the edge may be called.
 *
 * BOTH LISTS ARE CLOSED, and that is FEAT §11's "no relation is invented" enforced at the only
 * place an edge can be created. An open `target_type` would let a future import write edges to a
 * table the renderer has never heard of; an open `relation_type` would let one write "customers
 * also bought", which is a claim about behaviour this business does not measure.
 *
 * LOWERCASE, AND THAT IS NOT A STYLE CHOICE. `product_relations.target_type` is plain `text` with
 * no constraint, and until this file there was exactly one concrete value anywhere in the
 * repository: the `edge.target_type === 'product'` filter on `/product/[slug]`. A tidier-looking
 * `'PRODUCT'` here would have matched nothing — every hand-curated relation an editor created would
 * have silently fallen through to the same-category fallback, on a route whose entire promise is
 * that the curated set wins. The route now imports `RELATION_TARGET.product` from here rather than
 * holding its own literal, so the two cannot drift apart again.
 *
 * NOT A DATABASE CONSTRAINT, deliberately, unlike the Phase 14 commerce guards. Those defend
 * business FACTS a visitor reads as true — a price, a stock claim — where a row written around the
 * application is the hazard. This is a UI vocabulary: every row comes from the Related tab, nothing
 * seeds or imports the table, and Phase 23's suggestion engine will widen the list, which a CHECK
 * would turn into a migration for what is really a component's business. `DATA_MODEL.md` records
 * that decision so Phase 23 can revisit it deliberately.
 */
export const RELATION_TARGET = {
  product: 'product',
  collection: 'collection',
  portfolio: 'portfolio',
  journal: 'journal',
  material: 'material',
} as const

export const RELATION_TARGET_TYPES = Object.values(RELATION_TARGET)

export const RELATION_TYPES = ['related', 'part_of', 'made_from', 'featured_in'] as const

export type RelationTargetType = (typeof RELATION_TARGET)[keyof typeof RELATION_TARGET]
export type RelationType = (typeof RELATION_TYPES)[number]

export async function listProductRelations(
  client: Client,
  productId: string,
): Promise<ProductRelation[]> {
  const { data, error } = await client
    .from('product_relations')
    .select('*')
    .eq('source_product_id', productId)
    .order('relation_type', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'list-relations', productId, error)
  return parseRows(ENTITY, productRelationSchema, data ?? [])
}

export async function insertProductRelation(
  client: Client,
  values: {
    readonly sourceProductId: string
    readonly targetType: RelationTargetType
    readonly targetId: string
    readonly relationType: RelationType
    readonly sortOrder: number
  },
  actorId: string | null,
): Promise<ProductRelation> {
  const { data, error } = await client
    .from('product_relations')
    .insert({
      source_product_id: values.sourceProductId,
      target_type: values.targetType,
      target_id: values.targetId,
      relation_type: values.relationType,
      sort_order: values.sortOrder,
      created_by: actorId,
    })
    .select('*')
    .single()

  if (error) throw toRepositoryError(ENTITY, 'create-relation', values.targetId, error)
  return parseRows(ENTITY, productRelationSchema, [data])[0] as ProductRelation
}

export async function updateProductRelationOrder(
  client: Client,
  id: string,
  sortOrder: number,
): Promise<void> {
  const { error } = await client
    .from('product_relations')
    .update({ sort_order: sortOrder })
    .eq('id', id)
  if (error) throw toRepositoryError(ENTITY, 'reorder-relation', id, error)
}

/**
 * Remove one edge, and confirm it is gone.
 *
 * The read-back is the same argument as everywhere else in this file: a DELETE the policy filters
 * removes nothing and reports success, so an editor who cannot delete would be shown a relation
 * disappearing from the form and find it back on the next load.
 */
export async function deleteProductRelation(client: Client, id: string): Promise<void> {
  const { error } = await client.from('product_relations').delete().eq('id', id)
  if (error) throw toRepositoryError(ENTITY, 'delete-relation', id, error)

  const { data, error: readError } = await client
    .from('product_relations')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (readError) throw toRepositoryError(ENTITY, 'delete-relation', id, readError)
  if (data !== null) throw new PermissionError('delete-relation', ENTITY)
}
