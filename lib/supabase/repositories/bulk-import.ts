import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import { toRepositoryError } from './support'
import type { ImportContext } from '@/lib/bulk/import/validate'

type Client = SupabaseClient<Database>

const ENTITY = 'product import'

/**
 * What the import pipeline reads and writes.
 *
 * THE WRITABLE COLUMN SET IS AN ALLOWLIST AND IT IS THE POINT OF THIS FILE. `status` is not in it,
 * so an imported product takes the column's DRAFT default and an update leaves the row's own
 * status alone — import can never publish, enforced by an absence rather than by a rule. Neither
 * is `owner_verification`, because a spreadsheet cannot verify a business fact (D10), nor
 * `hero_media_id`, because an import has no way to know whether an asset is a concept render.
 */
const WRITABLE_COLUMNS = [
  'slug',
  'sku',
  'title',
  'subtitle',
  'summary',
  'description',
  'category_id',
  'price_state',
  'price_minor',
  'price_from_minor',
  'currency',
  'availability_state',
  'edition_state',
  'edition_size',
  'is_customizable',
  'is_large_format',
  'seo_title',
  'seo_description',
] as const

/** Everything the dry run needs to know about what already exists. Three reads, not per row. */
export async function loadImportContext(admin: Client): Promise<ImportContext> {
  const [products, categories] = await Promise.all([
    admin.from('products').select('id, slug, sku'),
    admin.from('categories').select('id, slug'),
  ])

  if (products.error) throw toRepositoryError(ENTITY, 'context', 'products', products.error)
  if (categories.error) throw toRepositoryError(ENTITY, 'context', 'categories', categories.error)

  const productIdBySlug = new Map<string, string>()
  const productIdBySku = new Map<string, string>()
  for (const row of products.data ?? []) {
    productIdBySlug.set(String(row.slug), row.id)
    if (row.sku !== null) productIdBySku.set(String(row.sku), row.id)
  }

  const categoryIdBySlug = new Map<string, string>()
  for (const row of categories.data ?? []) categoryIdBySlug.set(String(row.slug), row.id)

  return { productIdBySlug, productIdBySku, categoryIdBySlug }
}

export interface ImportApplyResult {
  readonly productId: string
  readonly created: boolean
  /**
   * The row as it was, for an UPDATE. Null for an INSERT, where there was nothing.
   *
   * WITHOUT THIS, UNDOING AN IMPORT WOULD BE HALF AN OPERATION. The phase document says an import
   * is undoable "in the same way" — rows it inserted are archived, rows it updated are restored —
   * and the second half needs a snapshot. Only the columns the import writes are captured, for the
   * same reason `setProductColumns` captures only what it touched: restoring forty columns would
   * revert changes this import never made.
   */
  readonly before: Record<string, unknown> | null
}

/** Insert or update one product from a validated row. Never writes `status`. */
export async function applyImportRow(
  admin: Client,
  input: {
    readonly action: 'INSERT' | 'UPDATE'
    readonly mapped: Record<string, unknown>
    readonly actorId: string
  },
): Promise<ImportApplyResult> {
  const values: Record<string, unknown> = {}
  for (const column of WRITABLE_COLUMNS) {
    if (column in input.mapped && input.mapped[column] !== undefined) {
      values[column] = input.mapped[column]
    }
  }
  values['updated_by'] = input.actorId

  const slug = values['slug']
  if (typeof slug !== 'string' || slug === '') {
    throw new Error('That row has no slug, so there is nothing to address it by.')
  }

  if (input.action === 'INSERT') {
    const { data, error } = await admin
      .from('products')
      .insert(values as never)
      .select('id')
      .single()
    if (error !== null) throw new Error(error.message)
    return { productId: data.id, created: true, before: null }
  }

  // READ BEFORE WRITING, so the snapshot is the state the import replaced rather than the state it
  // produced. Only the columns this import writes are captured, for the same reason
  // `setProductColumns` captures only what it touched: restoring forty would revert changes this
  // import never made.
  const { data: existing } = await admin.from('products').select('*').eq('slug', slug).maybeSingle()
  const before: Record<string, unknown> = {}
  if (existing !== null) {
    for (const column of Object.keys(values)) {
      before[column] = (existing as Record<string, unknown>)[column]
    }
  }

  const { data, error } = await admin
    .from('products')
    .update(values as never)
    .eq('slug', slug)
    .select('id')
    .maybeSingle()
  if (error !== null) throw new Error(error.message)
  if (data === null) throw new Error('That product could not be found to update.')
  return { productId: data.id, created: false, before }
}

/** Undo one import row: archive what it inserted, restore what it changed. */
export async function undoImportRow(
  admin: Client,
  entry: { readonly productId: string; readonly before: Record<string, unknown> | null },
): Promise<void> {
  if (entry.before === null) {
    /*
     * AN INSERTED ROW IS ARCHIVED, NEVER DELETED. Bulk never hard-deletes, and an import's undo is
     * not an exception: the product may already have been edited, linked or looked at since, and
     * archiving leaves all of that recoverable while taking it out of every listing.
     */
    const { error } = await admin
      .from('products')
      .update({ status: 'ARCHIVED' })
      .eq('id', entry.productId)
    if (error !== null) throw new Error(error.message)
    return
  }

  const { error } = await admin
    .from('products')
    .update(entry.before as never)
    .eq('id', entry.productId)
  if (error !== null) throw new Error(error.message)
}

/** What `product.import`'s preview reports. Read from the dry run rather than recomputed. */
export async function readImportSummary(
  admin: Client,
  importId: string,
): Promise<{
  filename: string
  inserts: number
  updates: number
  invalid: number
  applicable: number
} | null> {
  const [record, rows] = await Promise.all([
    admin.from('bulk_imports').select('filename, invalid_count').eq('id', importId).maybeSingle(),
    admin.from('bulk_import_rows').select('action, applied').eq('import_id', importId),
  ])

  if (record.error) throw toRepositoryError(ENTITY, 'summary', importId, record.error)
  if (record.data === null) return null

  // ALREADY-APPLIED ROWS ARE NOT COUNTED AS APPLICABLE, so re-applying the same import is a SKIP
  // with a reason rather than a second insert of everything.
  const pending = (rows.data ?? []).filter((row) => !row.applied)

  return {
    filename: record.data.filename,
    inserts: pending.filter((row) => row.action === 'INSERT').length,
    updates: pending.filter((row) => row.action === 'UPDATE').length,
    invalid: record.data.invalid_count,
    applicable: pending.filter((row) => row.action !== 'SKIP').length,
  }
}
