import 'server-only'

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
  listBulkItems,
  markOperationRunning,
  markOperationUndone,
  currentEntityVersion,
  restoreEntitySnapshot,
  type NewBulkItem,
} from '@/lib/supabase/repositories/bulk'

import { findOperation, isAvailable, loadBulkOperations } from './registry'
import { BATCH_SIZE, type BulkActor, type BulkOutcome } from './types'

/**
 * Undo, which is a COMPARISON rather than a rewind.
 *
 * THE SKIP RULE IS THE WHOLE FEATURE. Every applied item recorded the entity's `updated_at` as it
 * was READ. Undo re-applies `before` only where that value still matches, and reports every row it
 * skipped BY ID. Without it, an undo two hours later would silently overwrite whatever a colleague
 * edited in between — which is worse than offering no undo at all, because the operator would
 * believe they had restored a known state and would have no way to discover they had not.
 *
 * AN UNDO IS ITSELF AN OPERATION, with its own `bulk_operations` row and `undo_of_operation_id`
 * pointing at what it reverses. So undoing an undo is ordinary, audited, and reads forwards in the
 * trail rather than as a row that changed its mind.
 *
 * TWENTY-FOUR HOURS, AND PAST IT THE ANSWER IS NO. The snapshots stay — they are the audit trail —
 * but a one-click reversal of something a day old is a change nobody is watching for any more.
 */

export interface UndoRequest {
  readonly operationId: string
  readonly actor: BulkActor
}

export async function undoBulkOperation(request: UndoRequest): Promise<BulkOutcome> {
  await loadBulkOperations()
  const admin = createAdminClient()

  const original = await getBulkOperation(admin, request.operationId)
  if (original === null) {
    throw new ValidationError('bulk operation', [
      { path: 'operation', message: 'That operation could not be found.' },
    ])
  }
  if (original.undone_at !== null) {
    throw new ValidationError('bulk operation', [
      { path: 'operation', message: 'That operation has already been undone.' },
    ])
  }
  if (original.status !== 'SUCCEEDED' && original.status !== 'PARTIAL') {
    throw new ValidationError('bulk operation', [
      { path: 'operation', message: 'There is nothing to undo.' },
    ])
  }
  if (original.undo_deadline_at === null || new Date(original.undo_deadline_at) < new Date()) {
    throw new ValidationError('bulk operation', [
      { path: 'operation', message: 'The undo window for that operation has closed.' },
    ])
  }

  /*
   * UNDOING A DESTRUCTIVE OPERATION NEEDS THE DESTRUCTIVE PERMISSION, which reads backwards until
   * you notice what an undo does: it writes to the same live rows the operation wrote to. A
   * merchandiser who may not archive a page of products may not un-archive one either — both are
   * a bulk write over live content, and the second is the one nobody previewed.
   */
  if (!roleHasPermission(request.actor.role, 'bulk.execute')) {
    throw new PermissionError('bulk operation', 'undo', original.kind)
  }
  if (original.is_destructive && !roleHasPermission(request.actor.role, 'destructive.execute')) {
    throw new PermissionError('bulk operation', 'undo-destructive', original.kind)
  }

  const operation = findOperation(original.kind)
  if (operation === null || !isAvailable(operation)) {
    throw new ValidationError('bulk operation', [
      { path: 'kind', message: 'That operation can no longer be undone — it is not registered.' },
    ])
  }

  const applied = await listBulkItems(admin, original.id, 'APPLIED')

  const undo = await insertBulkOperation(admin, {
    kind: original.kind,
    targetEntity: original.target_entity,
    isDestructive: original.is_destructive,
    selection: applied.map((item) => item.entity_id),
    params: { undoOf: original.id },
    counts: { selected: applied.length, willApply: applied.length, willSkip: 0, willFail: 0 },
    confirmationToken: 'undo',
    actorUserId: request.actor.userId,
    actorRole: request.actor.role,
    undoOfOperationId: original.id,
  })
  await markOperationRunning(admin, undo.id)

  const context = { admin, actor: request.actor, operationId: undo.id }

  const results: NewBulkItem[] = []
  const problems: Array<{ entityId: string; reason: string }> = []

  for (let offset = 0; offset < applied.length; offset += BATCH_SIZE) {
    const batch = applied.slice(offset, offset + BATCH_SIZE)
    const batchResults: NewBulkItem[] = []

    for (const item of batch) {
      // THE COMPARISON, AND ITS TWO HALVES MUST NAME THE SAME MOMENT. `row_version_before` is the
      // version the ORIGINAL OPERATION LEFT the row at — before this undo, not before that write —
      // and this reads the version it holds now. Equal means nobody has touched it since we did,
      // so `before` is safe to re-apply; different means somebody has, and the row is left alone
      // and reported. Storing the pre-write version here instead would mismatch on every row the
      // operation itself changed, and the undo would skip all of them while claiming they had been
      // edited by someone else.
      const current = await currentEntityVersion(admin, original.target_entity, item.entity_id)
      if (item.row_version_before !== null && current !== item.row_version_before) {
        const reason = 'Changed since the operation ran, so it was left as it is.'
        batchResults.push({ entityId: item.entity_id, result: 'SKIPPED', reason })
        problems.push({ entityId: item.entity_id, reason })
        continue
      }

      try {
        if (operation.undoItem) {
          await operation.undoItem(context, item.entity_id, item.before)
        } else {
          await restoreEntitySnapshot(admin, original.target_entity, item.entity_id, item.before)
        }
        batchResults.push({
          entityId: item.entity_id,
          result: 'UNDONE',
          before: item.after,
          after: item.before,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The restore was refused.'
        batchResults.push({
          entityId: item.entity_id,
          result: 'FAILED',
          error: message,
          reason: message,
        })
        problems.push({ entityId: item.entity_id, reason: message })
      }
    }

    await insertBulkItems(admin, undo.id, batchResults)
    results.push(...batchResults)
  }

  const undone = results.filter((item) => item.result === 'UNDONE').length
  const skipped = results.filter((item) => item.result === 'SKIPPED').length
  const failed = results.filter((item) => item.result === 'FAILED').length
  const status = failed > 0 ? 'PARTIAL' : undone === 0 ? 'FAILED' : 'SUCCEEDED'

  const counts = {
    selected: applied.length,
    willApply: applied.length,
    willSkip: 0,
    willFail: 0,
    undone,
    skipped,
    failed,
  }

  await finishBulkOperation(admin, undo.id, { status, counts, undoDeadlineAt: null })
  await markOperationUndone(admin, original.id, request.actor.userId)

  await withAudit(
    {
      action: `bulk.undo.${original.kind}`,
      actorUserId: request.actor.userId,
      actorRole: request.actor.role,
      entityType: original.target_entity,
      entityId: original.id,
      summary: `${undone} restored, ${skipped} skipped (changed since), ${failed} failed`,
      // THE SKIPPED IDS ARE IN THE AUDIT ROW, not only in the result screen. "We undid it" and "we
      // undid all but these four" are different facts, and the second is the one somebody will ask
      // about a week later.
      after: { counts, skippedIds: problems.map((problem) => problem.entityId) } as never,
    },
    async () => undefined,
  )

  await logActivity({
    action: 'bulk.undone',
    actorId: request.actor.userId,
    actorRole: request.actor.role,
    entityType: original.target_entity,
    entityId: original.id,
    entityLabel: original.kind,
    summary: `${undone} of ${applied.length} restored`,
    metadata: { kind: original.kind, status, counts },
  })

  return { operationId: undo.id, status, counts, problems, undoDeadlineAt: null }
}
