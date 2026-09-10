'use server'

import { createHash } from 'node:crypto'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import type { StudioFormState } from '@/components/studio/form-state'
import { requirePermission } from '@/lib/auth/require'
import { dryRunImport } from '@/lib/bulk/import/apply'
import { detectDelimiter, type Delimiter } from '@/lib/bulk/import/parse'
import { previewBulkOperation, applyBulkOperation } from '@/lib/bulk/run'
import { PermissionError, ValidationError } from '@/lib/supabase/errors'

/**
 * The import surface's Server Actions: dry run, then apply.
 *
 * THE DRY RUN IS THE PREVIEW STEP, and it is not optional. An import that wrote first and reported
 * afterwards would be the one operation on this surface with no way back — a CSV of four hundred
 * rows applied wrongly is four hundred products to fix by hand.
 *
 * THE UPLOADED FILE IS READ, HASHED AND DISCARDED. `bulk_imports` records its name and checksum,
 * `bulk_import_rows` records what it contained, and the bytes are not retained: it is somebody's
 * spreadsheet and may hold anything.
 *
 * A CAP ON THE UPLOAD, because a Server Action reads the whole body into memory and a 200 MB file
 * would take the process with it. Two megabytes is roughly twenty thousand product rows, which is
 * forty times the operation cap.
 */

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024

function issue(message: string, code: string): StudioFormState {
  return { status: 'error', issues: [{ field: '_form', code, message }] }
}

function refusal(error: unknown): StudioFormState {
  if (isRedirectError(error)) throw error
  if (error instanceof ValidationError) {
    return {
      status: 'error',
      issues: error.issues.map((i) => ({ field: i.path, code: 'invalid', message: i.message })),
    }
  }
  if (error instanceof PermissionError) return issue('You cannot import products.', 'forbidden')
  return issue('That file could not be imported. Nothing was written.', 'refused')
}

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  )
}

export async function dryRunImportAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('bulk.execute')

    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return issue('Choose a CSV or TSV file.', 'file_missing')
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return issue('That file is larger than 2 MB.', 'file_too_large')
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const text = new TextDecoder().decode(bytes)
    const checksum = createHash('sha256').update(bytes).digest('hex')

    const declared = form.get('delimiter')
    const delimiter: Delimiter =
      declared === ',' || declared === '\t' ? declared : detectDelimiter(text)

    // The mapping arrives as JSON from the mapping step. An absent one means "map by header name",
    // which `suggestColumnMap` computes — but the operator confirms it before this action runs.
    const rawMap = form.get('column_map')
    let columnMap: Record<string, string> = {}
    if (typeof rawMap === 'string' && rawMap.trim() !== '') {
      try {
        const parsed: unknown = JSON.parse(rawMap)
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          columnMap = parsed as Record<string, string>
        }
      } catch {
        return issue('The column mapping could not be read.', 'column_map_invalid')
      }
    }

    const result = await dryRunImport({
      filename: file.name,
      text,
      delimiter,
      columnMap,
      checksum,
      actor: { userId: session.userId, role: session.role },
    })

    revalidatePath('/studio/operations/imports')
    redirect(`/studio/operations/imports?import=${result.importId}`)
  } catch (error) {
    return refusal(error)
  }
}

/**
 * Apply a dry run.
 *
 * IT GOES THROUGH THE BULK ENGINE rather than writing directly, so an import gets the same
 * `bulk_operations` row, the same audit entry and the same per-item record as every other bulk
 * write. That is what makes "import is undoable in the same way" true rather than aspirational.
 */
export async function applyImportAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('bulk.execute')
    const importId = form.get('import_id')
    if (typeof importId !== 'string' || importId === '') {
      return issue('That import could not be found.', 'import_missing')
    }

    const actor = { userId: session.userId, role: session.role }

    /*
     * PREVIEW THEN APPLY, THROUGH THE ENGINE, and the import's own writes happen inside
     * `product.import`'s `applyItem`. Calling `applyImport` here as well — which the first draft
     * did — would run the import twice: once through the engine and once beside it, with the
     * second pass finding every row already applied and reporting a skip. The engine is the only
     * caller, which is what makes the operation audited, previewable and undoable.
     *
     * `selection` is the IMPORT id. The unit of this operation is the file: a row it will insert
     * has no product id yet, so there is nothing else to select.
     */
    const preview = await previewBulkOperation({
      kind: 'product.import',
      selection: [importId],
      params: { importId },
      actor,
    })

    await applyBulkOperation({
      operationId: preview.operationId,
      confirmationToken: preview.confirmationToken,
      actor,
    })

    revalidatePath('/studio/operations/imports')
    revalidatePath('/studio/catalog/products')
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}
