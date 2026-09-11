import { z } from 'zod'

import {
  getResearchProduct,
  setDuplicateOf,
  writeProductDisposition,
  writeProductStage,
} from '@/lib/supabase/repositories/research/products'
import { recordAction } from '@/lib/supabase/repositories/research/review'
import { assignTag, removeTag } from '@/lib/supabase/repositories/research/review'

import { registerBulkOperation } from '../../registry'
import type { ApplyResult, BulkOperationContext, PreviewItem } from '../../types'

/**
 * FEAT §20's five scraper operations, implemented against the one bulk engine.
 *
 * PHASE 24 REGISTERED THESE UNAVAILABLE AND PHASE 29 FILLS THEM IN, which is exactly what the
 * registration was for. What Phase 24's header predicted is what would otherwise have happened
 * here: a phase arriving to find no registration and a research explorer with no toolbar writes
 * its own selection handling, its own preview, its own confirmation and its own undo — and the
 * second implementation is always the one without the typed count. Nothing below implements any
 * of that machinery. Each operation supplies a `preview`, an `applyItem` and a Zod schema, and
 * inherits the preview step, the typed-count confirmation, the per-item snapshot and the 24-hour
 * undo.
 *
 * ALL FIVE CARRY `extraPermission: 'research.confirm'`, AND THAT IS THE PHASE 04 SPLIT AT THE
 * ENGINE. Every one of them writes a disposition-bearing column — `stage`, `disposition`,
 * `duplicate_of_id` — and the dividing line in this subsystem is the COLUMN, not the screen. A
 * researcher holds `bulk.execute` and operates the pipeline; they do not judge its output, and the
 * engine refuses them here exactly as `assertMayMoveStage` refuses them one row at a time.
 *
 * **NONE OF THEM CREATES A RIVYA PRODUCT.** `research.confirm` moves a research row to a research
 * stage. There is no import path in this file, `scripts/research/check-no-autoimport.mjs` proves
 * there is none, and `tests/unit/research-no-autoimport.test.ts` proves the same thing by running
 * a bulk confirm over forty rows and counting `products` on both sides.
 *
 * EVERY APPLY WRITES AN ACTION ROW. A bulk decision is still a decision, and the append-only
 * `research_review_actions` log is where "who rejected these forty rows and why" is answerable.
 * Doing it per item rather than once per operation is deliberate: undo is per item, so the record
 * has to be too.
 */

const OWNING_PHASE = 29

const noParams = z.object({}).strict()

const reasonParams = z
  .object({
    // REQUIRED, AND APPLIED TO EVERY ITEM. The phase document asks for "a required reason applied
    // to every item", and the row-level CHECK on research_review_actions demands one for REJECT
    // regardless — so an operation that let it through empty would fail forty times at the
    // database with a constraint name rather than once at the form with a sentence.
    reason: z.string().trim().min(3).max(500),
  })
  .strict()

const duplicateParams = z
  .object({
    // THE SURVIVOR IS NAMED ONCE FOR THE WHOLE SELECTION, which is what makes this a bulk
    // operation rather than forty separate judgements: "these are all the same product as that
    // one". A row cannot be its own survivor, and the preview says so per row rather than failing
    // the operation.
    survivingProductId: z.string().uuid(),
  })
  .strict()

const tagParams = z
  .object({
    tagId: z.string().uuid(),
    remove: z.boolean().default(false),
  })
  .strict()

type ResearchRow = Awaited<ReturnType<typeof getResearchProduct>>

async function loadRows(
  context: BulkOperationContext,
  selection: readonly string[],
): Promise<Map<string, NonNullable<ResearchRow>>> {
  const rows = new Map<string, NonNullable<ResearchRow>>()
  for (const id of selection) {
    const row = await getResearchProduct(context.admin, id)
    if (row !== null) rows.set(id, row)
  }
  return rows
}

const missingRow = (entityId: string): PreviewItem => ({
  entityId,
  outcome: 'INVALID',
  rule: 'row_not_found',
  reason: 'That research row no longer exists.',
})

/**
 * One action row per item, written as the SYSTEM.
 *
 * THE BULK ENGINE HOLDS ONLY THE SERVICE-ROLE CLIENT — it runs after the Server Action's
 * `requirePermission`, and `BulkOperationContext` carries `admin` and the actor, not a session.
 * So the action row is inserted through it, and the actor's identity and role are carried
 * explicitly on the row rather than being implied by whose session wrote it. That is the same
 * record a single-row action leaves; what differs is only which client made the insert.
 */
async function logAction(
  context: BulkOperationContext,
  entityId: string,
  action: string,
  reason: string | null,
): Promise<void> {
  await recordAction(context.admin, {
    productId: entityId,
    changeId: null,
    action,
    reason,
    actorUserId: context.actor.userId,
    actorRole: context.actor.role,
  })
}

export function registerResearchOperations(): void {
  /**
   * 1. Shortlist — the rows join the Phase 35 shortlist.
   *
   * THE STAGE IS WRITTEN DIRECTLY RATHER THAN THROUGH `moveStage`, and the reason is the engine's
   * per-item snapshot. `applyItem` must return the `before` that undo re-applies, and `moveStage`
   * returns a transition rather than a row; going through it would leave the engine with nothing
   * to restore. The pipeline event is written by the same call, so the audit trail is unchanged.
   */
  registerBulkOperation({
    kind: 'research.shortlist',
    targetEntity: 'research_product',
    paramsSchema: noParams,
    isDestructive: false,
    extraPermission: 'research.confirm',
    owningPhase: OWNING_PHASE,
    preview: async (context, selection) => {
      const rows = await loadRows(context, selection)
      return selection.map((entityId) => {
        const row = rows.get(entityId)
        if (row === undefined) return missingRow(entityId)
        if (row.stage === 'SHORTLISTED') {
          return {
            entityId,
            outcome: 'SKIP',
            reason: 'Already shortlisted.',
            label: row.title_normalized ?? row.source_url,
          }
        }
        if (row.stage === 'CONFIRMED') {
          return {
            entityId,
            outcome: 'SKIP',
            reason: 'Already confirmed, which is further on than shortlisted.',
            label: row.title_normalized ?? row.source_url,
          }
        }
        return { entityId, outcome: 'APPLY', label: row.title_normalized ?? row.source_url }
      })
    },
    applyItem: async (context, entityId): Promise<ApplyResult> => {
      const before = await getResearchProduct(context.admin, entityId)
      await writeProductStage(context.admin, {
        id: entityId,
        stage: 'SHORTLISTED',
        actorId: context.actor.userId,
      })
      await logAction(context, entityId, 'SHORTLIST', null)
      const after = await getResearchProduct(context.admin, entityId)
      return {
        before: { stage: before?.stage ?? null },
        after: { stage: after?.stage ?? null },
        rowVersionForUndo: after?.last_seen_at ?? null,
      }
    },
  })

  /**
   * 2. Reject — destructive, and the only one of the five that is.
   *
   * IT IS DESTRUCTIVE BECAUSE IT EMPTIES A QUEUE. Rejecting forty rows takes a week of somebody
   * else's review out of the working set in one click, and while nothing is deleted, "recoverable
   * if you know it happened" is not the same as recoverable. So: `destructive.execute` on top of
   * the two permissions the others need, a typed row count, a per-item snapshot, and the reason
   * applied to every item.
   */
  registerBulkOperation({
    kind: 'research.reject',
    targetEntity: 'research_product',
    paramsSchema: reasonParams,
    isDestructive: true,
    extraPermission: 'research.confirm',
    owningPhase: OWNING_PHASE,
    preview: async (context, selection) => {
      const rows = await loadRows(context, selection)
      return selection.map((entityId) => {
        const row = rows.get(entityId)
        if (row === undefined) return missingRow(entityId)
        if (row.disposition === 'REJECTED') {
          return {
            entityId,
            outcome: 'SKIP',
            reason: 'Already rejected.',
            label: row.title_normalized ?? row.source_url,
          }
        }
        return {
          entityId,
          outcome: 'APPLY',
          reason: 'Leaves the review queue. The row and its evidence are kept.',
          label: row.title_normalized ?? row.source_url,
        }
      })
    },
    applyItem: async (context, entityId, params): Promise<ApplyResult> => {
      const before = await getResearchProduct(context.admin, entityId)
      await writeProductDisposition(context.admin, {
        id: entityId,
        disposition: 'REJECTED',
        actorId: context.actor.userId,
      })
      await logAction(context, entityId, 'REJECT', params.reason)
      const after = await getResearchProduct(context.admin, entityId)
      return {
        before: { disposition: before?.disposition ?? null },
        after: { disposition: after?.disposition ?? null },
        rowVersionForUndo: after?.last_seen_at ?? null,
      }
    },
  })

  /** 3. Mark Duplicate — all the selected rows are the same product as one survivor. */
  registerBulkOperation({
    kind: 'research.mark_duplicate',
    targetEntity: 'research_product',
    paramsSchema: duplicateParams,
    isDestructive: false,
    extraPermission: 'research.confirm',
    owningPhase: OWNING_PHASE,
    preview: async (context, selection, params) => {
      const rows = await loadRows(context, selection)
      return selection.map((entityId) => {
        const row = rows.get(entityId)
        if (row === undefined) return missingRow(entityId)
        if (entityId === params.survivingProductId) {
          return {
            entityId,
            outcome: 'INVALID',
            rule: 'self_duplicate',
            reason: 'A row cannot be a duplicate of itself.',
            label: row.title_normalized ?? row.source_url,
          }
        }
        if (row.duplicate_of_id === params.survivingProductId) {
          return {
            entityId,
            outcome: 'SKIP',
            reason: 'Already marked against that row.',
            label: row.title_normalized ?? row.source_url,
          }
        }
        return { entityId, outcome: 'APPLY', label: row.title_normalized ?? row.source_url }
      })
    },
    applyItem: async (context, entityId, params): Promise<ApplyResult> => {
      const before = await getResearchProduct(context.admin, entityId)
      await setDuplicateOf(context.admin, {
        id: entityId,
        duplicateOfId: params.survivingProductId,
        actorId: context.actor.userId,
      })
      await writeProductDisposition(context.admin, {
        id: entityId,
        disposition: 'DUPLICATE',
        actorId: context.actor.userId,
      })
      await logAction(
        context,
        entityId,
        'MARK_DUPLICATE',
        `duplicate of ${params.survivingProductId}`,
      )
      const after = await getResearchProduct(context.admin, entityId)
      return {
        before: {
          duplicate_of_id: before?.duplicate_of_id ?? null,
          disposition: before?.disposition ?? null,
        },
        after: {
          duplicate_of_id: after?.duplicate_of_id ?? null,
          disposition: after?.disposition ?? null,
        },
        rowVersionForUndo: after?.last_seen_at ?? null,
      }
    },
  })

  /**
   * 4. Assign research tags.
   *
   * THE ONLY ONE OF THE FIVE THAT TOUCHES A TABLE OTHER THAN THE PRODUCT ROW, which is why it
   * supplies its own `undoItem`: the engine's generic undo writes a `before` snapshot back to the
   * entity's own row, and there is nothing on `research_products` to write. Undoing a tag
   * assignment removes the tag, and undoing a removal puts it back.
   */
  registerBulkOperation({
    kind: 'research.set_tags',
    targetEntity: 'research_product',
    paramsSchema: tagParams,
    isDestructive: false,
    extraPermission: 'research.confirm',
    owningPhase: OWNING_PHASE,
    preview: async (context, selection, params) => {
      const rows = await loadRows(context, selection)
      return selection.map((entityId) => {
        const row = rows.get(entityId)
        if (row === undefined) return missingRow(entityId)
        return {
          entityId,
          outcome: 'APPLY',
          reason: params.remove ? 'Removes the tag.' : 'Applies the tag.',
          label: row.title_normalized ?? row.source_url,
        }
      })
    },
    applyItem: async (context, entityId, params): Promise<ApplyResult> => {
      if (params.remove) {
        await removeTag(context.admin, { productId: entityId, tagId: params.tagId })
      } else {
        await assignTag(context.admin, {
          productId: entityId,
          tagId: params.tagId,
          actorUserId: context.actor.userId,
        })
      }
      await logAction(context, entityId, 'TAG', params.remove ? 'removed' : 'applied')
      return {
        before: { tagId: params.tagId, applied: params.remove },
        after: { tagId: params.tagId, applied: !params.remove },
        rowVersionForUndo: null,
      }
    },
    undoItem: async (context, entityId, before) => {
      const snapshot = before as { tagId?: string; applied?: boolean } | null
      if (snapshot?.tagId === undefined) return
      if (snapshot.applied === true) {
        await assignTag(context.admin, {
          productId: entityId,
          tagId: snapshot.tagId,
          actorUserId: context.actor.userId,
        })
      } else {
        await removeTag(context.admin, { productId: entityId, tagId: snapshot.tagId })
      }
    },
  })

  /**
   * 5. Confirm.
   *
   * **CONFIRMED IS A RESEARCH STAGE.** It means "confirmed as a research reference" and nothing
   * else: no product, no draft product, no media row, no CMS content. The preview's reason says so
   * on every row, because the risk here is not a developer adding an import — it is somebody
   * reading a screen full of "confirmed" competitor products and concluding the catalogue has been
   * approved.
   */
  registerBulkOperation({
    kind: 'research.confirm',
    targetEntity: 'research_product',
    paramsSchema: noParams,
    isDestructive: false,
    extraPermission: 'research.confirm',
    owningPhase: OWNING_PHASE,
    preview: async (context, selection) => {
      const rows = await loadRows(context, selection)
      return selection.map((entityId) => {
        const row = rows.get(entityId)
        if (row === undefined) return missingRow(entityId)
        if (row.stage === 'CONFIRMED') {
          return {
            entityId,
            outcome: 'SKIP',
            reason: 'Already confirmed.',
            label: row.title_normalized ?? row.source_url,
          }
        }
        return {
          entityId,
          outcome: 'APPLY',
          reason: 'Confirms as a research reference. Creates no Rivya product.',
          label: row.title_normalized ?? row.source_url,
        }
      })
    },
    applyItem: async (context, entityId): Promise<ApplyResult> => {
      const before = await getResearchProduct(context.admin, entityId)
      await writeProductStage(context.admin, {
        id: entityId,
        stage: 'CONFIRMED',
        actorId: context.actor.userId,
      })
      await logAction(context, entityId, 'CONFIRM', null)
      const after = await getResearchProduct(context.admin, entityId)
      return {
        before: { stage: before?.stage ?? null },
        after: { stage: after?.stage ?? null },
        rowVersionForUndo: after?.last_seen_at ?? null,
      }
    },
  })
}

registerResearchOperations()
