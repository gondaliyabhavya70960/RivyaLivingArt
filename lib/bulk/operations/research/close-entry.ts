import { z } from 'zod'

import { moveStage, StageTransitionError } from '@/lib/scraper/core/stage'
import { getResearchProduct } from '@/lib/supabase/repositories/research/products'
import { recordAction } from '@/lib/supabase/repositories/research/review'
import {
  closeShortlistEntry,
  getOpenEntry,
  openShortlistEntry,
} from '@/lib/supabase/repositories/research/shortlist'

import { registerBulkOperation } from '../../registry'
import type { ApplyResult, BulkOperationContext } from '../../types'
import { writeAudit } from '@/lib/auth/audit'

/**
 * `research.close_entry` — Phase 35. The movement table's `SHORTLISTED → REVIEW`, in bulk.
 *
 * CLOSING AN ENTRY IS A STAGE MOVE, NOT A DELETION. The row goes back to REVIEW through
 * `stage.ts` — so a `research_pipeline_events` row records it — and the open entry is closed with
 * the reason the table requires. Nothing is deleted: the shortlist keeps its history, and a row
 * that was on the list and came off it says so.
 *
 * ONE AUDIT ROW PER ROW, on top of the engine's one-per-operation row. The phase document asks
 * for it and the reason is the same as the review-action row's: undo is per item, so the record
 * must be too.
 */

const OWNING_PHASE = 35

const reasonParams = z
  .object({
    reason: z.string().trim().min(3).max(500),
  })
  .strict()

async function audit(
  context: BulkOperationContext,
  entityId: string,
  action: string,
  summary: string,
): Promise<void> {
  await writeAudit({
    action,
    result: 'SUCCESS',
    actorUserId: context.actor.userId,
    actorRole: context.actor.role,
    entityType: 'research_product',
    entityId,
    summary,
  })
}

export function registerCloseEntryOperation(): void {
  registerBulkOperation({
    kind: 'research.close_entry',
    targetEntity: 'research_product',
    paramsSchema: reasonParams,
    isDestructive: false,
    extraPermission: 'research.confirm',
    owningPhase: OWNING_PHASE,
    preview: async (context, selection) => {
      const items = []
      for (const entityId of selection) {
        const row = await getResearchProduct(context.admin, entityId)
        if (row === null) {
          items.push({
            entityId,
            outcome: 'INVALID' as const,
            rule: 'row_not_found',
            reason: 'That research row no longer exists.',
          })
          continue
        }
        const label = row.title_normalized ?? row.source_url
        if (row.stage !== 'SHORTLISTED') {
          items.push({
            entityId,
            outcome: 'SKIP' as const,
            reason: 'Not on the shortlist.',
            label,
          })
          continue
        }
        items.push({
          entityId,
          outcome: 'APPLY' as const,
          reason: 'Returns the row to review and closes its shortlist entry. Nothing is deleted.',
          label,
        })
      }
      return items
    },
    applyItem: async (context, entityId, params): Promise<ApplyResult> => {
      const before = await getResearchProduct(context.admin, entityId)
      const entry = await getOpenEntry(context.admin, entityId)
      await moveStage(context.admin, {
        productId: entityId,
        to: 'REVIEW',
        actor: { userId: context.actor.userId },
        reason: params.reason,
      })
      await closeShortlistEntry(context.admin, {
        researchProductId: entityId,
        reason: params.reason,
        actorUserId: context.actor.userId,
      })
      await recordAction(context.admin, {
        productId: entityId,
        changeId: null,
        action: 'REVIEW',
        reason: params.reason,
        actorUserId: context.actor.userId,
        actorRole: context.actor.role,
      })
      await audit(context, entityId, 'research.shortlist.closed', params.reason)
      const after = await getResearchProduct(context.admin, entityId)
      return {
        before: {
          stage: before?.stage ?? null,
          entryReason: entry?.reason ?? null,
          entryCaptured: entry?.captured ?? null,
          entryBriefId: entry?.brief_id ?? null,
        },
        after: { stage: after?.stage ?? null },
        rowVersionForUndo: after?.last_seen_at ?? null,
      }
    },
    /**
     * UNDO REOPENS, THROUGH THE SAME DOOR. The stage goes forward again through `stage.ts` (a
     * second event, saying so), and a fresh entry is opened carrying the closed one's reason and
     * captured score. The closed entry stays closed: history is not rewritten.
     */
    undoItem: async (context, entityId, before) => {
      const snapshot = before as {
        stage?: string | null
        entryReason?: string | null
        entryCaptured?: unknown
        entryBriefId?: string | null
      } | null
      if (snapshot?.stage !== 'SHORTLISTED') return
      try {
        await moveStage(context.admin, {
          productId: entityId,
          to: 'SHORTLISTED',
          actor: { userId: context.actor.userId },
          reason: 'bulk undo: entry reopened',
        })
      } catch (error) {
        if (!(error instanceof StageTransitionError)) throw error
      }
      if ((await getOpenEntry(context.admin, entityId)) !== null) return
      const captured = snapshot.entryCaptured
      await openShortlistEntry(context.admin, {
        researchProductId: entityId,
        reason: snapshot.entryReason ?? 'Reopened by a bulk undo.',
        captured:
          captured !== null && typeof captured === 'object' && !Array.isArray(captured)
            ? (captured as {
                score: number | null
                confidence: number | null
                modelVersion: string | null
                scoredAt: string | null
              })
            : { score: null, confidence: null, modelVersion: null, scoredAt: null },
        briefId: snapshot.entryBriefId ?? null,
        actorUserId: context.actor.userId,
      })
    },
  })
}

registerCloseEntryOperation()
