import 'server-only'

import { randomBytes } from 'node:crypto'

import { withAudit } from '@/lib/auth/audit'
import { roleHasPermission } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/logging/activity'
import { createAdminClient } from '@/lib/supabase/admin'
import { PermissionError, ValidationError } from '@/lib/supabase/errors'
import {
  finishBulkOperation,
  getBulkOperation,
  insertBulkItems,
  insertBulkOperation,
  markOperationRunning,
  type NewBulkItem,
} from '@/lib/supabase/repositories/bulk'

import { findOperation, isAvailable, loadBulkOperations } from './registry'
import {
  BATCH_SIZE,
  MAX_SELECTION,
  UNDO_WINDOW_HOURS,
  type BulkActor,
  type BulkOutcome,
  type BulkPreview,
  type PreviewItem,
} from './types'

/**
 * The engine. Select → Preview → Confirm → Apply, and no surface implements any of it.
 *
 * THE FOUR STEPS ARE NOT A UI FLOW, THEY ARE A DATA FLOW. Preview writes a `bulk_operations` row
 * with `status = 'PREVIEW'`, the exact selection, and a confirmation token. Apply presents that
 * token, and the engine re-reads the SELECTION FROM THE ROW rather than from the request — so a
 * stale tab cannot apply a preview built from a different filter, and a request cannot widen one.
 * A changed filter produces a new preview and a new token; the old token is spent on finish.
 *
 * BATCHES OF FIFTY ARE THE UNIT OF PROGRESS AND REPORTING, NOT OF ATOMICITY, and this is a
 * deliberate departure from the phase document's "one transaction per batch". PostgREST offers no
 * multi-statement transaction, so the alternative was a SQL function per operation kind — which
 * would move every operation's logic into SQL and make a policy refusal disappear behind a
 * `security definer`. Per-item statements are in fact CLOSER to what the phase document wants: its
 * stated requirement is that "a 500-row publish failing on row 499 must not discard 498 good
 * writes", and under true per-batch transactions a failure at 499 would roll back the 49 good
 * writes in its batch. Here nothing is rolled back, every item's outcome is recorded, and the
 * operation ends `PARTIAL`. Re-running is safe because every `applyItem` is idempotent on its own
 * `after` state. Recorded as amendment A24.
 *
 * DESTRUCTIVE IS CHECKED TWICE AND MEANS TWO DIFFERENT THINGS. At preview it decides what the
 * confirm dialog demands; at apply it decides whether the actor may proceed at all. The second is
 * the real gate — a Server Action is an HTTP endpoint, so the dialog is a courtesy and this is not.
 */

export interface PreviewRequest {
  readonly kind: string
  readonly selection: readonly string[]
  readonly params: unknown
  readonly actor: BulkActor
}

function countOf(items: readonly PreviewItem[], outcome: PreviewItem['outcome']): number {
  return items.filter((item) => item.outcome === outcome).length
}

/**
 * Compute a preview and record it.
 *
 * NOTHING IS WRITTEN TO THE TARGET ENTITY HERE. The only write is the `bulk_operations` row, which
 * is the record of the question rather than of an answer.
 */
export async function previewBulkOperation(request: PreviewRequest): Promise<BulkPreview> {
  await loadBulkOperations()

  const operation = findOperation(request.kind)
  if (operation === null) {
    throw new ValidationError('bulk operation', [
      { path: 'kind', message: 'That operation does not exist.' },
    ])
  }
  if (!isAvailable(operation)) {
    // A registered-but-unimplemented operation. The Studio should not have offered it, and a
    // crafted POST is refused here rather than reaching a preview that cannot be computed.
    throw new ValidationError('bulk operation', [
      { path: 'kind', message: `That operation arrives in Phase ${operation.owningPhase ?? 29}.` },
    ])
  }

  const selection = [...new Set(request.selection)].filter((id) => id !== '')
  if (selection.length === 0) {
    throw new ValidationError('bulk operation', [
      { path: 'selection', message: 'Nothing was selected.' },
    ])
  }
  if (selection.length > MAX_SELECTION) {
    // REJECTED IN PREVIEW WITH THE COUNT, which is what the operator needs in order to narrow it.
    throw new ValidationError('bulk operation', [
      {
        path: 'selection',
        message: `${selection.length} rows selected; ${MAX_SELECTION} is the most one operation may touch.`,
      },
    ])
  }

  const parsed = operation.paramsSchema.safeParse(request.params)
  if (!parsed.success) {
    throw new ValidationError(
      'bulk operation',
      parsed.error.issues.map((issue) => ({
        path: issue.path.join('.') || 'params',
        message: issue.message,
      })),
    )
  }

  const admin = createAdminClient()
  const context = { admin, actor: request.actor }
  const items = await operation.preview(context, selection, parsed.data as never)

  const isDestructive =
    typeof operation.isDestructive === 'function'
      ? operation.isDestructive(parsed.data as never)
      : operation.isDestructive

  const counts = {
    selected: selection.length,
    willApply: countOf(items, 'APPLY'),
    willSkip: countOf(items, 'SKIP'),
    willFail: countOf(items, 'INVALID'),
  }

  // 32 bytes of randomness. It is not a secret in the cryptographic sense — the operator holds it
  // in their own page — it is a nonce that ties one Apply to one Preview.
  const confirmationToken = randomBytes(24).toString('base64url')

  const row = await insertBulkOperation(admin, {
    kind: operation.kind,
    targetEntity: operation.targetEntity,
    isDestructive,
    selection,
    params: parsed.data as Record<string, unknown>,
    counts,
    confirmationToken,
    actorUserId: request.actor.userId,
    actorRole: request.actor.role,
  })

  return { operationId: row.id, confirmationToken, isDestructive, items, counts }
}

/**
 * Read back a stored preview, with its per-row outcomes recomputed.
 *
 * THE OUTCOMES ARE NOT STORED, AND THAT IS DELIBERATE. `bulk_operation_items.result` admits only
 * APPLIED, SKIPPED, FAILED and UNDONE — there is no PREVIEW state, because an item row is the
 * record of something that HAPPENED. So the preview page recomputes from the stored selection,
 * which has the useful side effect that a preview left open for ten minutes shows the catalogue as
 * it is now rather than as it was: a product whose hero was unbound in between shows as excluded
 * before the operator presses Apply rather than after.
 *
 * IT RETURNS THE TOKEN, so the page can put it in a hidden field without it ever entering the URL.
 */
export async function readBulkPreview(
  operationId: string,
  actor: BulkActor,
): Promise<(BulkPreview & { readonly kind: string; readonly status: string }) | null> {
  await loadBulkOperations()
  const admin = createAdminClient()

  const row = await getBulkOperation(admin, operationId)
  if (row === null || row.status !== 'PREVIEW' || row.confirmation_token === null) return null

  const operation = findOperation(row.kind)
  if (operation === null || !isAvailable(operation)) return null

  const selection = Array.isArray(row.selection) ? (row.selection as string[]) : []
  const items = await operation.preview({ admin, actor }, selection, (row.params ?? {}) as never)

  return {
    operationId: row.id,
    confirmationToken: row.confirmation_token,
    isDestructive: row.is_destructive,
    items,
    counts: {
      selected: selection.length,
      willApply: countOf(items, 'APPLY'),
      willSkip: countOf(items, 'SKIP'),
      willFail: countOf(items, 'INVALID'),
    },
    kind: row.kind,
    status: row.status,
  }
}

export interface ApplyRequest {
  readonly operationId: string
  readonly confirmationToken: string
  readonly actor: BulkActor
  /**
   * The row count the operator typed, for a destructive operation. Checked against the preview's
   * own count — the dialog enforces it in the browser and this enforces it where it matters.
   */
  readonly typedCount?: number
}

export async function applyBulkOperation(request: ApplyRequest): Promise<BulkOutcome> {
  await loadBulkOperations()
  const admin = createAdminClient()

  const row = await getBulkOperation(admin, request.operationId)
  if (row === null) {
    throw new ValidationError('bulk operation', [
      { path: 'operation', message: 'That operation could not be found.' },
    ])
  }

  // A SPENT OR MISMATCHED TOKEN IS THE STALE-TAB CASE. `finishBulkOperation` clears the token, so
  // a double-submitted form finds null here and is refused rather than running twice.
  if (row.confirmation_token === null || row.confirmation_token !== request.confirmationToken) {
    throw new ValidationError('bulk operation', [
      {
        path: 'confirmation',
        message: 'That preview is no longer current. Preview the selection again.',
      },
    ])
  }
  if (row.status !== 'PREVIEW') {
    throw new ValidationError('bulk operation', [
      { path: 'operation', message: 'That operation has already run.' },
    ])
  }

  const operation = findOperation(row.kind)
  if (operation === null || !isAvailable(operation)) {
    throw new ValidationError('bulk operation', [
      { path: 'kind', message: 'That operation is not available.' },
    ])
  }

  // THE PERMISSION GATE, and it is here rather than only in the Server Action because this is the
  // last point before a write. `bulk.execute` is assumed — the action checked it — but destructive
  // needs the second permission, and a merchandiser reaching this line has crafted the request.
  if (!roleHasPermission(request.actor.role, 'bulk.execute')) {
    throw new PermissionError('bulk operation', 'apply', row.kind)
  }
  if (row.is_destructive && !roleHasPermission(request.actor.role, 'destructive.execute')) {
    throw new PermissionError('bulk operation', 'apply-destructive', row.kind)
  }
  // THE OPERATION'S OWN SECOND PERMISSION, where it has one. Phase 29's research dispositions need
  // `research.confirm` as well as `bulk.execute`, because the dividing line in that subsystem is
  // the column and not the screen: a researcher who may not reject one row may not reject forty.
  if (
    operation.extraPermission !== undefined &&
    !roleHasPermission(request.actor.role, operation.extraPermission)
  ) {
    throw new PermissionError('bulk operation', 'apply', row.kind)
  }

  const previewCounts = (row.counts ?? {}) as { willApply?: number }
  if (row.is_destructive) {
    // THE TYPED COUNT IS CHECKED SERVER-SIDE. In the browser it disables a button; here it is the
    // difference between "I meant to archive forty-seven things" and a mis-click on a page of rows.
    if (request.typedCount !== (previewCounts.willApply ?? 0)) {
      throw new ValidationError('bulk operation', [
        { path: 'typedCount', message: 'Type the number of rows shown to confirm.' },
      ])
    }
  }

  const selection = Array.isArray(row.selection) ? (row.selection as string[]) : []
  const params = (row.params ?? {}) as never
  const context = { admin, actor: request.actor, operationId: row.id }

  await markOperationRunning(admin, row.id)

  // The preview is recomputed rather than trusted, because time has passed: a product that passed
  // the readiness checklist five minutes ago may have had its hero unbound since. The operator saw
  // the earlier answer; the database gets the current one.
  const items = await operation.preview(context, selection, params)
  const byId = new Map(items.map((item) => [item.entityId, item]))

  const results: NewBulkItem[] = []
  const problems: Array<{ entityId: string; reason: string }> = []

  for (let offset = 0; offset < selection.length; offset += BATCH_SIZE) {
    const batch = selection.slice(offset, offset + BATCH_SIZE)
    const batchResults: NewBulkItem[] = []

    for (const entityId of batch) {
      const previewItem = byId.get(entityId)

      if (previewItem === undefined || previewItem.outcome !== 'APPLY') {
        const reason = previewItem?.reason ?? 'No longer part of this selection.'
        batchResults.push({
          entityId,
          result: previewItem?.outcome === 'INVALID' ? 'FAILED' : 'SKIPPED',
          reason,
        })
        problems.push({ entityId, reason })
        continue
      }

      try {
        const applied = await operation.applyItem(context, entityId, params)
        batchResults.push({
          entityId,
          result: 'APPLIED',
          before: applied.before,
          after: applied.after,
          rowVersionForUndo: applied.rowVersionForUndo,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The write was refused.'
        batchResults.push({ entityId, result: 'FAILED', error: message, reason: message })
        problems.push({ entityId, reason: message })
      }
    }

    // One insert per batch. A crash between batches leaves the earlier batches recorded, which is
    // what makes a half-finished operation legible rather than invisible.
    await insertBulkItems(admin, row.id, batchResults)
    results.push(...batchResults)
  }

  const applied = results.filter((item) => item.result === 'APPLIED').length
  const skipped = results.filter((item) => item.result === 'SKIPPED').length
  const failed = results.filter((item) => item.result === 'FAILED').length

  const status = failed > 0 ? 'PARTIAL' : applied === 0 ? 'FAILED' : 'SUCCEEDED'
  const undoDeadlineAt =
    applied > 0 ? new Date(Date.now() + UNDO_WINDOW_HOURS * 3_600_000).toISOString() : null

  const counts = {
    selected: selection.length,
    willApply: previewCounts.willApply ?? 0,
    willSkip: 0,
    willFail: 0,
    applied,
    skipped,
    failed,
  }

  await finishBulkOperation(admin, row.id, { status, counts, undoDeadlineAt })

  /**
   * ONE AUDIT ROW PER OPERATION, CARRYING COUNTS AND PARAMS AND NOT THE ROW SET.
   *
   * A 500-row archive that wrote 500 audit rows would bury every other entry in the security log
   * for the day. The per-item detail lives in `bulk_operation_items` and is one link away from
   * `/studio/operations/audit/[operationId]`, so nothing is lost and the log stays readable.
   */
  await withAudit(
    {
      action: `bulk.${row.kind}`,
      actorUserId: request.actor.userId,
      actorRole: request.actor.role,
      entityType: row.target_entity,
      entityId: row.id,
      summary: `${applied} applied, ${skipped} skipped, ${failed} failed of ${selection.length} selected`,
      before: { params: row.params } as never,
      after: counts as never,
    },
    async () => undefined,
  )

  await logActivity({
    action: 'bulk.applied',
    actorId: request.actor.userId,
    actorRole: request.actor.role,
    entityType: row.target_entity,
    entityId: row.id,
    entityLabel: row.kind,
    summary: `${applied} of ${selection.length}`,
    metadata: { kind: row.kind, status, counts },
  })

  return { operationId: row.id, status, counts, problems, undoDeadlineAt }
}
