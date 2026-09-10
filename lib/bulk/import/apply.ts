import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  applyImportRow,
  loadImportContext,
  type ImportApplyResult,
} from '@/lib/supabase/repositories/bulk-import'
import {
  insertBulkImport,
  insertBulkImportRows,
  listBulkImportRows,
  markImportApplied,
  markImportRowApplied,
} from '@/lib/supabase/repositories/bulk'

import type { BulkActor } from '../types'
import { applyColumnMap, rawRow } from './map'
import { parseDelimited, type Delimiter } from './parse'
import { validateImport, type ValidatedRow } from './validate'

/**
 * Import, end to end: parse → map → validate → record → apply.
 *
 * EVERY IMPORTED PRODUCT LANDS AS `DRAFT`, AND THE ENFORCEMENT IS AN ABSENCE. `applyImportRow`
 * does not write `status` at all — not "writes DRAFT", does not write it. An insert therefore takes
 * the column default, and an UPDATE leaves whatever the row already had. That is stronger than a
 * rule, because there is no code path to relax: adding `status` to the writable set would be a
 * visible line in a diff rather than a boolean flipping somewhere.
 *
 * This is SEED §32's "approved import" read literally: THE IMPORT IS THE APPROVAL STEP, and the
 * publish is a separate, deliberate act on a surface where somebody looks at the piece.
 *
 * `owner_verification` IS ALSO NEVER WRITTEN, for a sharper reason: a spreadsheet cannot verify a
 * business fact (D10). A row arriving from a supplier's export claiming VERIFIED would be a
 * capability claim made by a file.
 *
 * THE UPLOADED FILE IS NOT RETAINED. Its checksum identifies it and `bulk_import_rows` records
 * what it contained, pruned at thirty days. It is somebody's spreadsheet and may hold anything.
 */

export interface DryRunResult {
  readonly importId: string
  readonly headers: readonly string[]
  readonly rows: readonly ValidatedRow[]
  readonly parseErrors: ReadonlyArray<{ rowNumber: number; message: string }>
  readonly counts: {
    total: number
    valid: number
    invalid: number
    inserts: number
    updates: number
  }
}

export async function dryRunImport(input: {
  readonly filename: string
  readonly text: string
  readonly delimiter: Delimiter
  readonly columnMap: Record<string, string>
  readonly checksum: string
  readonly actor: BulkActor
}): Promise<DryRunResult> {
  const admin = createAdminClient()

  const file = parseDelimited(input.text, input.delimiter)
  const context = await loadImportContext(admin)

  const mappedRows = file.rows.map((row) => ({
    rowNumber: row.rowNumber,
    mapped: applyColumnMap(file, input.columnMap, row.cells),
  }))

  const validated = validateImport(mappedRows, context)

  const valid = validated.filter((row) => row.issues.length === 0)
  const counts = {
    total: file.rows.length,
    valid: valid.length,
    // A PARSE ERROR COUNTS AS INVALID. A row with the wrong number of cells never reached
    // validation, and reporting "12 valid of 12" beside a file of fourteen lines would be a lie
    // by omission.
    invalid: validated.length - valid.length + file.errors.length,
    inserts: validated.filter((row) => row.action === 'INSERT').length,
    updates: validated.filter((row) => row.action === 'UPDATE').length,
  }

  const record = await insertBulkImport(admin, {
    filename: input.filename,
    checksum: input.checksum,
    delimiter: input.delimiter,
    columnMap: input.columnMap,
    rowCount: counts.total,
    validCount: counts.valid,
    invalidCount: counts.invalid,
    createdBy: input.actor.userId,
  })

  await insertBulkImportRows(
    admin,
    record.id,
    validated.map((row, index) => ({
      rowNumber: row.rowNumber,
      raw: rawRow(file, file.rows[index]?.cells ?? []),
      mapped: row.mapped,
      issues: row.issues,
      action: row.action,
    })),
  )

  return {
    importId: record.id,
    headers: file.headers,
    rows: validated,
    parseErrors: file.errors,
    counts,
  }
}

export interface ImportOutcome {
  readonly importId: string
  readonly applied: number
  readonly skipped: number
  readonly failed: number
  readonly problems: ReadonlyArray<{ rowNumber: number; reason: string }>
  /** What undo needs: every product this import touched, and what it looked like before. */
  readonly touched: ReadonlyArray<{ productId: string; before: Record<string, unknown> | null }>
}

/**
 * Apply the valid rows of a dry run.
 *
 * ONLY ROWS WHOSE `action` IS `INSERT` OR `UPDATE` ARE TOUCHED. A row that failed validation is
 * recorded, reported and left alone — there is no force, and no partial application of a row's
 * good fields.
 */
export async function applyImport(input: {
  readonly importId: string
  readonly actor: BulkActor
  readonly operationId: string
}): Promise<ImportOutcome> {
  const admin = createAdminClient()
  const rows = await listBulkImportRows(admin, input.importId)

  let applied = 0
  let skipped = 0
  let failed = 0
  const problems: Array<{ rowNumber: number; reason: string }> = []
  const touched: Array<{ productId: string; before: Record<string, unknown> | null }> = []

  for (const row of rows) {
    if (row.action === 'SKIP' || row.applied) {
      skipped += 1
      continue
    }

    let result: ImportApplyResult
    try {
      result = await applyImportRow(admin, {
        action: row.action === 'INSERT' ? 'INSERT' : 'UPDATE',
        mapped: (row.mapped ?? {}) as Record<string, unknown>,
        actorId: input.actor.userId,
      })
    } catch (error) {
      failed += 1
      const reason = error instanceof Error ? error.message : 'The write was refused.'
      problems.push({ rowNumber: row.row_number, reason })
      continue
    }

    await markImportRowApplied(admin, row.id, result.productId)
    touched.push({ productId: result.productId, before: result.before })
    applied += 1
  }

  // An empty operation id means the caller is not the engine, which no longer happens — the
  // import runs inside `product.import`'s applyItem. Guarded rather than asserted because the FK
  // would refuse it anyway, and a clear skip beats a constraint violation in the middle of a file.
  if (input.operationId !== '') {
    await markImportApplied(admin, input.importId, input.operationId)
  }

  return { importId: input.importId, applied, skipped, failed, problems, touched }
}
