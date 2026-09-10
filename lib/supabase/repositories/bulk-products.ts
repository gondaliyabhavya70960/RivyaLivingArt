import type { SupabaseClient } from '@supabase/supabase-js'

import type { ProductContext, ProductDraft } from '@/lib/catalog/validation'

import type { Database } from '../database.types'
import { toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'bulk product'

/**
 * The reads and writes the product bulk operations need.
 *
 * SEPARATE FROM `catalog-admin.ts` BECAUSE THE SHAPE IS DIFFERENT, not because the domain is. A
 * bulk preview needs five hundred rows' worth of readiness context in ONE round trip — the draft
 * columns, the material ids, the gallery ids and the spec counts — and the per-row reads that suit
 * a single-product editor would be two thousand queries. Everything here is batched by design.
 *
 * THE WRITES ARE COLUMN SETS AND RETURN `{ before, after }`, because that is what undo re-applies.
 * A write that returned nothing would make the 24-hour window a promise the engine could not keep.
 */

export interface BulkProductRow {
  readonly id: string
  readonly slug: string
  readonly title: string | null
  readonly status: string
  readonly owner_verification: string
  readonly category_id: string | null
  readonly hero_media_id: string | null
  /** Shaped for `readinessChecklist`, so the operation does not re-map columns per row. */
  readonly draft: ProductDraft
  readonly context: ProductContext
}

/*
 * `select('*')` RATHER THAN A COLUMN LIST, which is the opposite of what the search repository
 * does and is right for the opposite reason. `readinessChecklist` reads eleven columns and
 * `validateProduct` several more; naming them here would be a fourth copy of a list that already
 * exists in `lib/catalog/validation.ts`'s `ProductDraft`, and the one that drifted would produce a
 * readiness answer computed from an undefined field — which reads as "not ready" and looks like a
 * data problem. The row is wide but it is one query for the whole selection.
 */

/**
 * Everything a product preview needs, for up to five hundred rows, in four queries.
 *
 * `extras` IS A SECOND JOB IN THE SAME FUNCTION and it is here rather than in four more exports
 * because every one of its answers is a one-row lookup a preview makes once, not per row: is that
 * category published, does that asset exist, is it a concept render, are those terms real. Four
 * more exported functions would be four more names for "check the operation's own parameters".
 */
export async function listBulkProductContext(
  admin: Client,
  productIds: readonly string[],
  extras?: {
    readonly categoryId?: string
    readonly mediaAssetId?: string
    readonly termIds?: readonly string[]
  },
): Promise<
  BulkProductRow[] & {
    categoryIsPublished?: boolean
    mediaExists?: boolean
    mediaIsConcept?: boolean
    unknownTermIds?: string[]
  }
> {
  const rows: BulkProductRow[] = []

  if (productIds.length > 0) {
    const ids = [...productIds]

    const [products, materials, media, specs] = await Promise.all([
      admin.from('products').select('*').in('id', ids),
      admin.from('product_materials').select('product_id, material_id').in('product_id', ids),
      admin.from('product_media').select('product_id, media_asset_id, role').in('product_id', ids),
      admin.from('product_specs').select('product_id').in('product_id', ids),
    ])

    if (products.error) throw toRepositoryError(ENTITY, 'list', 'selection', products.error)

    const materialsByProduct = new Map<string, string[]>()
    for (const row of materials.data ?? []) {
      const list = materialsByProduct.get(row.product_id) ?? []
      list.push(row.material_id)
      materialsByProduct.set(row.product_id, list)
    }

    // GALLERY MEANS NON-HERO. The readiness item asks whether there is more than one picture, and
    // counting the hero twice would let a product with a single image satisfy it.
    const galleryByProduct = new Map<string, string[]>()
    for (const row of media.data ?? []) {
      if (row.role === 'hero') continue
      const list = galleryByProduct.get(row.product_id) ?? []
      list.push(row.media_asset_id)
      galleryByProduct.set(row.product_id, list)
    }

    const specCount = new Map<string, number>()
    for (const row of specs.data ?? []) {
      specCount.set(row.product_id, (specCount.get(row.product_id) ?? 0) + 1)
    }

    for (const product of products.data ?? []) {
      rows.push({
        id: product.id,
        slug: product.slug,
        title: product.title,
        status: product.status,
        owner_verification: product.owner_verification,
        category_id: product.category_id,
        hero_media_id: product.hero_media_id,
        draft: product as unknown as ProductDraft,
        context: {
          materialIds: materialsByProduct.get(product.id) ?? [],
          galleryMediaIds: galleryByProduct.get(product.id) ?? [],
          specCount: specCount.get(product.id) ?? 0,
        },
      })
    }
  }

  const result = rows as BulkProductRow[] & {
    categoryIsPublished?: boolean
    mediaExists?: boolean
    mediaIsConcept?: boolean
    unknownTermIds?: string[]
  }

  if (extras?.categoryId !== undefined) {
    const { data } = await admin
      .from('categories')
      .select('status')
      .eq('id', extras.categoryId)
      .maybeSingle()
    result.categoryIsPublished = data?.status === 'PUBLISHED'
  }

  if (extras?.mediaAssetId !== undefined) {
    const { data } = await admin
      .from('media_assets')
      .select('id, is_concept')
      .eq('id', extras.mediaAssetId)
      .maybeSingle()
    result.mediaExists = data !== null
    result.mediaIsConcept = data?.is_concept === true
  }

  if (extras?.termIds !== undefined) {
    const wanted = [...extras.termIds]
    if (wanted.length === 0) {
      result.unknownTermIds = []
    } else {
      const { data } = await admin
        .from('product_attribute_terms')
        .select('id')
        .in('id', wanted)
        .eq('status', 'PUBLISHED')
      const known = new Set((data ?? []).map((row) => row.id))
      result.unknownTermIds = wanted.filter((id) => !known.has(id))
    }
  }

  return result
}

/**
 * The product's `updated_at` right now.
 *
 * ONE PLACE, because every bulk write must stamp the version it LEFT the row at and a call that
 * quietly reads the version before its own write is the defect this helper exists to make hard.
 */
async function productVersion(admin: Client, productId: string): Promise<string | null> {
  const { data } = await admin
    .from('products')
    .select('updated_at')
    .eq('id', productId)
    .maybeSingle()
  return data?.updated_at ?? null
}

export interface BulkWriteResult {
  readonly before: unknown
  readonly after: unknown
  /** See `ApplyResult.rowVersionForUndo`: the version this write LEFT the row at. */
  readonly rowVersionForUndo: string | null
}

/**
 * Set columns on one product and return what it looked like before.
 *
 * `before` HOLDS ONLY THE COLUMNS THIS WRITE TOUCHED, not the whole row. Undo re-applies it as an
 * update, so a whole-row snapshot would write back forty columns — including ones somebody else
 * legitimately changed in the meantime and which this operation never touched.
 */
export async function setProductColumns(
  admin: Client,
  productId: string,
  columns: Record<string, unknown>,
  tags?: {
    readonly tagRelation: string
    readonly termIds: readonly string[]
    readonly actorId: string
  },
): Promise<BulkWriteResult> {
  const { data: current, error: readError } = await admin
    .from('products')
    .select('*')
    .eq('id', productId)
    .maybeSingle()
  if (readError) throw toRepositoryError(ENTITY, 'read', productId, readError)
  if (current === null) throw new Error('That piece no longer exists.')

  const before: Record<string, unknown> = {}
  for (const key of Object.keys(columns)) {
    before[key] = (current as Record<string, unknown>)[key]
  }

  if (Object.keys(columns).length > 0) {
    const { error } = await admin
      .from('products')
      .update(columns as never)
      .eq('id', productId)
    if (error !== null) throw new Error(error.message)
  }

  if (tags !== undefined) {
    // Tag edges are `product_relations` rows with an attribute-term target, which is what the
    // Phase 23 vocabulary made expressible. Replacing rather than appending: a bulk tag set is
    // "these are the terms", not "add these to whatever is there".
    const { error: clearError } = await admin
      .from('product_relations')
      .delete()
      .eq('source_product_id', productId)
      .eq('relation_type', tags.tagRelation)
      .eq('target_type', 'attribute_term')
    if (clearError !== null) throw new Error(clearError.message)

    if (tags.termIds.length > 0) {
      const { error: insertError } = await admin.from('product_relations').insert(
        tags.termIds.map((termId, index) => ({
          source_product_id: productId,
          target_type: 'attribute_term',
          target_id: termId,
          relation_type: tags.tagRelation,
          sort_order: index,
          created_by: tags.actorId,
        })),
      )
      if (insertError !== null) throw new Error(insertError.message)
    }
    before['tags'] = { relationType: tags.tagRelation }
  }

  const { data: after } = await admin.from('products').select('*').eq('id', productId).maybeSingle()

  const afterColumns: Record<string, unknown> = {}
  for (const key of Object.keys(columns)) {
    afterColumns[key] = (after as Record<string, unknown> | null)?.[key]
  }

  return {
    before,
    after: afterColumns,
    // READ FROM THE ROW AS THIS WRITE LEFT IT. Undo compares this against the row's `updated_at`
    // at undo time, so it must be the version this operation produced: comparing against the
    // version it saw would mismatch on every row it changed and skip the whole undo.
    rowVersionForUndo: (after as { updated_at?: string } | null)?.updated_at ?? null,
  }
}

/** Replace a product's collection membership. Returns the previous set for undo. */
export async function setProductCollectionsBulk(
  admin: Client,
  productId: string,
  collectionIds: readonly string[],
  actorId: string,
): Promise<BulkWriteResult> {
  const { data: current } = await admin
    .from('product_collections')
    .select('collection_id, sort_order')
    .eq('product_id', productId)

  const { error: clearError } = await admin
    .from('product_collections')
    .delete()
    .eq('product_id', productId)
  if (clearError !== null) throw new Error(clearError.message)

  if (collectionIds.length > 0) {
    const { error } = await admin.from('product_collections').insert(
      collectionIds.map((collectionId, index) => ({
        product_id: productId,
        collection_id: collectionId,
        sort_order: index,
        created_by: actorId,
      })),
    )
    if (error !== null) throw new Error(error.message)
  }

  return {
    before: { collections: current ?? [] },
    after: { collections: collectionIds },
    // Re-read after the write: membership lives in a child table, but a trigger that touches the
    // parent's `updated_at` would otherwise leave undo comparing against a stale version.
    rowVersionForUndo: await productVersion(admin, productId),
  }
}

/** Replace a product's materials. Returns the previous set for undo. */
export async function setProductMaterialsBulk(
  admin: Client,
  productId: string,
  materialIds: readonly string[],
  actorId: string,
): Promise<BulkWriteResult> {
  const { data: current } = await admin
    .from('product_materials')
    .select('material_id, note')
    .eq('product_id', productId)

  const { error: clearError } = await admin
    .from('product_materials')
    .delete()
    .eq('product_id', productId)
  if (clearError !== null) throw new Error(clearError.message)

  if (materialIds.length > 0) {
    const { error } = await admin.from('product_materials').insert(
      materialIds.map((materialId) => ({
        product_id: productId,
        material_id: materialId,
        created_by: actorId,
      })),
    )
    if (error !== null) throw new Error(error.message)
  }

  return {
    before: { materials: current ?? [] },
    after: { materials: materialIds },
    rowVersionForUndo: await productVersion(admin, productId),
  }
}
