import type { SupabaseClient } from '@supabase/supabase-js'

import type { Role } from '@/lib/auth/permissions'

import type { Database } from '../database.types'
import { toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'bulk operation'

/**
 * `bulk_operations`, `bulk_operation_items`, `bulk_imports` and `bulk_import_rows` — the only
 * module that touches any of the four.
 *
 * EVERY WRITE HERE REQUIRES THE ADMIN CLIENT, and the tables say so: none has an `authenticated`
 * insert or update policy (0221). That is not belt-and-braces, it is the guarantee the whole
 * feature rests on — a session able to write `bulk_operations` could forge a preview carrying a
 * selection nobody previewed, and a session able to write `bulk_operation_items` could edit the
 * `before` snapshot that undo re-applies, writing anything it liked into a live row while the
 * audit log recorded a restoration.
 *
 * READS TAKE WHATEVER CLIENT THE CALLER HAS. `bulk.execute` governs them through RLS, so a Studio
 * page reading the audit detail uses the session client and is refused for a role that may not.
 */

export interface BulkOperationRow {
  readonly id: string
  readonly kind: string
  readonly target_entity: string
  readonly status: string
  readonly is_destructive: boolean
  readonly selection: unknown
  readonly params: unknown
  readonly counts: unknown
  readonly confirmation_token: string | null
  readonly confirmed_at: string | null
  readonly actor_user_id: string | null
  readonly actor_role: Role | null
  readonly requested_at: string
  readonly started_at: string | null
  readonly finished_at: string | null
  readonly undo_deadline_at: string | null
  readonly undone_at: string | null
  readonly undone_by: string | null
  readonly undo_of_operation_id: string | null
}

const OPERATION_COLUMNS =
  'id, kind, target_entity, status, is_destructive, selection, params, counts, ' +
  'confirmation_token, confirmed_at, actor_user_id, actor_role, requested_at, started_at, ' +
  'finished_at, undo_deadline_at, undone_at, undone_by, undo_of_operation_id'

export async function insertBulkOperation(
  admin: Client,
  values: {
    readonly kind: string
    readonly targetEntity: string
    readonly isDestructive: boolean
    readonly selection: readonly string[]
    readonly params: Record<string, unknown>
    readonly counts: Record<string, number>
    readonly confirmationToken: string
    readonly actorUserId: string
    readonly actorRole: Role
    readonly undoOfOperationId?: string | null
  },
): Promise<BulkOperationRow> {
  const { data, error } = await admin
    .from('bulk_operations')
    .insert({
      kind: values.kind,
      target_entity: values.targetEntity,
      status: 'PREVIEW',
      is_destructive: values.isDestructive,
      selection: [...values.selection],
      params: values.params as never,
      counts: values.counts as never,
      confirmation_token: values.confirmationToken,
      actor_user_id: values.actorUserId,
      actor_role: values.actorRole,
      undo_of_operation_id: values.undoOfOperationId ?? null,
    })
    .select(OPERATION_COLUMNS)
    .single()

  if (error) throw toRepositoryError(ENTITY, 'create', values.kind, error)
  return data as unknown as BulkOperationRow
}

export async function getBulkOperation(
  client: Client,
  id: string,
): Promise<BulkOperationRow | null> {
  const { data, error } = await client
    .from('bulk_operations')
    .select(OPERATION_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw toRepositoryError(ENTITY, 'get', id, error)
  return (data as unknown as BulkOperationRow | null) ?? null
}

export async function listBulkOperations(client: Client, limit = 50): Promise<BulkOperationRow[]> {
  const { data, error } = await client
    .from('bulk_operations')
    .select(OPERATION_COLUMNS)
    .order('requested_at', { ascending: false })
    .limit(limit)
  if (error) throw toRepositoryError(ENTITY, 'list', 'recent', error)
  return (data ?? []) as unknown as BulkOperationRow[]
}

/** Mark an operation started. Separate from the finish so a crashed run is visibly RUNNING. */
export async function markOperationRunning(admin: Client, id: string): Promise<void> {
  const { error } = await admin
    .from('bulk_operations')
    .update({
      status: 'RUNNING',
      started_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw toRepositoryError(ENTITY, 'start', id, error)
}

export async function finishBulkOperation(
  admin: Client,
  id: string,
  values: {
    readonly status: string
    readonly counts: Record<string, number>
    readonly undoDeadlineAt: string | null
  },
): Promise<void> {
  const { error } = await admin
    .from('bulk_operations')
    .update({
      status: values.status,
      counts: values.counts as never,
      finished_at: new Date().toISOString(),
      undo_deadline_at: values.undoDeadlineAt,
      // THE TOKEN IS SPENT. Clearing it is what makes a preview single-use: a second Apply with
      // the same token finds null and is refused, so a double-submitted form cannot run twice.
      confirmation_token: null,
    })
    .eq('id', id)
  if (error) throw toRepositoryError(ENTITY, 'finish', id, error)
}

export async function markOperationUndone(
  admin: Client,
  id: string,
  undoneBy: string,
): Promise<void> {
  const { error } = await admin
    .from('bulk_operations')
    .update({ status: 'UNDONE', undone_at: new Date().toISOString(), undone_by: undoneBy })
    .eq('id', id)
  if (error) throw toRepositoryError(ENTITY, 'undo', id, error)
}

export interface BulkItemRow {
  readonly id: string
  readonly operation_id: string
  readonly entity_id: string
  readonly result: string
  readonly reason: string | null
  readonly before: unknown
  readonly after: unknown
  readonly row_version_before: string | null
  readonly error: string | null
}

export interface NewBulkItem {
  readonly entityId: string
  readonly result: 'APPLIED' | 'SKIPPED' | 'FAILED' | 'UNDONE'
  readonly reason?: string | null
  readonly before?: unknown
  readonly after?: unknown
  readonly rowVersionForUndo?: string | null
  readonly error?: string | null
}

/** One statement per batch. The unit of reporting, and the reason a 500-row run is not 500 writes. */
export async function insertBulkItems(
  admin: Client,
  operationId: string,
  items: readonly NewBulkItem[],
): Promise<void> {
  if (items.length === 0) return
  const { error } = await admin.from('bulk_operation_items').insert(
    items.map((item) => ({
      operation_id: operationId,
      entity_id: item.entityId,
      result: item.result,
      reason: item.reason ?? null,
      before: (item.before ?? null) as never,
      after: (item.after ?? null) as never,
      row_version_before: item.rowVersionForUndo ?? null,
      error: item.error ?? null,
    })),
  )
  if (error) throw toRepositoryError(ENTITY, 'record-items', operationId, error)
}

export async function listBulkItems(
  client: Client,
  operationId: string,
  result?: string,
): Promise<BulkItemRow[]> {
  let query = client
    .from('bulk_operation_items')
    .select('id, operation_id, entity_id, result, reason, before, after, row_version_before, error')
    .eq('operation_id', operationId)
  if (result !== undefined) query = query.eq('result', result)

  const { data, error } = await query.order('entity_id', { ascending: true })
  if (error) throw toRepositoryError(ENTITY, 'list-items', operationId, error)
  return (data ?? []) as unknown as BulkItemRow[]
}

// --- Imports --------------------------------------------------------------------------------------

export interface BulkImportRow {
  readonly id: string
  readonly operation_id: string | null
  readonly filename: string
  readonly checksum: string
  readonly delimiter: string
  readonly column_map: unknown
  readonly row_count: number
  readonly valid_count: number
  readonly invalid_count: number
  readonly status: string
  readonly created_at: string
}

export async function insertBulkImport(
  admin: Client,
  values: {
    readonly filename: string
    readonly checksum: string
    readonly delimiter: string
    readonly columnMap: Record<string, string>
    readonly rowCount: number
    readonly validCount: number
    readonly invalidCount: number
    readonly createdBy: string
  },
): Promise<BulkImportRow> {
  const { data, error } = await admin
    .from('bulk_imports')
    .insert({
      filename: values.filename,
      checksum: values.checksum,
      delimiter: values.delimiter,
      column_map: values.columnMap as never,
      row_count: values.rowCount,
      valid_count: values.validCount,
      invalid_count: values.invalidCount,
      status: 'VALIDATED',
      created_by: values.createdBy,
    })
    .select('*')
    .single()
  if (error) throw toRepositoryError('bulk import', 'create', values.filename, error)
  return data as unknown as BulkImportRow
}

export async function insertBulkImportRows(
  admin: Client,
  importId: string,
  rows: ReadonlyArray<{
    readonly rowNumber: number
    readonly raw: Record<string, string>
    readonly mapped: Record<string, unknown>
    readonly issues: ReadonlyArray<{ rule: string; message: string; field?: string }>
    readonly action: 'INSERT' | 'UPDATE' | 'SKIP'
  }>,
): Promise<void> {
  if (rows.length === 0) return
  const { error } = await admin.from('bulk_import_rows').insert(
    rows.map((row) => ({
      import_id: importId,
      row_number: row.rowNumber,
      raw: row.raw as never,
      mapped: row.mapped as never,
      issues: row.issues as never,
      action: row.action,
    })),
  )
  if (error) throw toRepositoryError('bulk import row', 'create', importId, error)
}

export async function listBulkImportRows(
  client: Client,
  importId: string,
): Promise<
  Array<{
    id: string
    row_number: number
    raw: unknown
    mapped: unknown
    issues: unknown
    action: string
    target_entity_id: string | null
    applied: boolean
  }>
> {
  const { data, error } = await client
    .from('bulk_import_rows')
    .select('id, row_number, raw, mapped, issues, action, target_entity_id, applied')
    .eq('import_id', importId)
    .order('row_number', { ascending: true })
  if (error) throw toRepositoryError('bulk import row', 'list', importId, error)
  return data ?? []
}

export async function markImportRowApplied(
  admin: Client,
  rowId: string,
  targetEntityId: string,
): Promise<void> {
  const { error } = await admin
    .from('bulk_import_rows')
    .update({ applied: true, target_entity_id: targetEntityId })
    .eq('id', rowId)
  if (error) throw toRepositoryError('bulk import row', 'apply', rowId, error)
}

export async function markImportApplied(
  admin: Client,
  importId: string,
  operationId: string,
): Promise<void> {
  const { error } = await admin
    .from('bulk_imports')
    .update({ status: 'APPLIED', operation_id: operationId })
    .eq('id', importId)
  if (error) throw toRepositoryError('bulk import', 'apply', importId, error)
}

/** Thirty days. The window is the reason the table can hold an operator's spreadsheet at all. */
export async function pruneBulkImportRows(admin: Client, olderThanIso: string): Promise<number> {
  const { data, error } = await admin
    .from('bulk_import_rows')
    .delete()
    .lt('created_at', olderThanIso)
    .select('id')
  if (error) throw toRepositoryError('bulk import row', 'prune', olderThanIso, error)
  return (data ?? []).length
}

// --- What undo needs of the target entity ----------------------------------------------------------
//
// TWO FUNCTIONS OVER A TABLE THIS MODULE DOES NOT OWN, and they live here because
// `check-data-layer.mjs` requires every `.from(` to — but also because the mapping from a
// `target_entity` token to a table is a fact about the schema rather than about the engine, and
// the engine having its own copy is how the two drift.

type BulkRestorableTable = 'products' | 'media_assets'

/**
 * The table a `bulk_operations.target_entity` token names.
 *
 * IT THROWS RATHER THAN RETURNING NULL for a token it does not know. `inquiry` and
 * `research_product` are legal `target_entity` values and neither is restorable today — no
 * operation in Phase 24 targets an enquiry, and the research operations are registered
 * unavailable. A null would make undo's version comparison pass silently, so a later phase adding
 * an operation without adding it here would get an undo that had quietly stopped skipping changed
 * rows. A throw is the loud version of the same discovery.
 */
export function bulkRestorableTable(targetEntity: string): BulkRestorableTable {
  if (targetEntity === 'product') return 'products'
  if (targetEntity === 'media_asset') return 'media_assets'
  throw new Error(`bulk undo does not know how to restore a ${targetEntity}`)
}

/** The entity's `updated_at` right now. Undo compares it with `row_version_before`. */
export async function currentEntityVersion(
  admin: Client,
  targetEntity: string,
  entityId: string,
): Promise<string | null> {
  const table = bulkRestorableTable(targetEntity)
  const { data, error } = await admin
    .from(table)
    .select('updated_at')
    .eq('id', entityId)
    .maybeSingle()
  if (error) throw toRepositoryError(ENTITY, 'read-version', entityId, error)
  return data?.updated_at ?? null
}

/** Write a `before` snapshot back onto its row. The generic undo, for column-setting operations. */
export async function restoreEntitySnapshot(
  admin: Client,
  targetEntity: string,
  entityId: string,
  before: unknown,
): Promise<void> {
  if (before === null || typeof before !== 'object' || Array.isArray(before)) {
    throw new Error('There is no snapshot to restore.')
  }
  const table = bulkRestorableTable(targetEntity)
  const { error } = await admin
    .from(table)
    .update(before as never)
    .eq('id', entityId)
  if (error !== null) throw toRepositoryError(ENTITY, 'restore', entityId, error)
}
