import { z } from 'zod'

import { writeAudit } from '@/lib/auth/audit'
import { getResearchProduct } from '@/lib/supabase/repositories/research/products'
import {
  archiveConfirmation,
  getLiveConfirmation,
  unarchiveConfirmation,
} from '@/lib/supabase/repositories/research/shortlist'

import { registerBulkOperation } from '../../registry'
import type { ApplyResult } from '../../types'

/**
 * `research.archive_confirmation` — Phase 35. Retire decisions, in bulk.
 *
 * ARCHIVAL IS A COLUMN, NOT A STAGE. The stage stays CONFIRMED and NO pipeline event is written,
 * because nothing moved: the row remains a confirmed research reference, and the partial unique
 * index now admits a fresh decision on it. The reason the movement table requires becomes
 * `archived_reason`. One audit row per row.
 */

const OWNING_PHASE = 35

const reasonParams = z
  .object({
    reason: z.string().trim().min(3).max(500),
  })
  .strict()

export function registerArchiveConfirmationOperation(): void {
  registerBulkOperation({
    kind: 'research.archive_confirmation',
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
        const live = await getLiveConfirmation(context.admin, entityId)
        if (live === null) {
          items.push({
            entityId,
            outcome: 'SKIP' as const,
            reason: 'No live decision to archive.',
            label,
          })
          continue
        }
        items.push({
          entityId,
          outcome: 'APPLY' as const,
          reason: 'Archives the decision. The stage stays CONFIRMED; nothing is deleted.',
          label,
        })
      }
      return items
    },
    applyItem: async (context, entityId, params): Promise<ApplyResult> => {
      const live = await getLiveConfirmation(context.admin, entityId)
      await archiveConfirmation(context.admin, {
        researchProductId: entityId,
        reason: params.reason,
      })
      await writeAudit({
        action: 'research.confirmation.archived',
        result: 'SUCCESS',
        actorUserId: context.actor.userId,
        actorRole: context.actor.role,
        entityType: 'research_product',
        entityId,
        summary: params.reason,
      })
      return {
        before: { confirmationId: live?.id ?? null, archived: false },
        after: { confirmationId: live?.id ?? null, archived: true },
        rowVersionForUndo: null,
      }
    },
    /** Undo puts the same decision back, if no newer one has taken its place. */
    undoItem: async (context, entityId, before) => {
      const snapshot = before as { confirmationId?: string | null } | null
      if (snapshot?.confirmationId === undefined || snapshot.confirmationId === null) return
      if ((await getLiveConfirmation(context.admin, entityId)) !== null) return
      await unarchiveConfirmation(context.admin, snapshot.confirmationId)
    },
  })
}

registerArchiveConfirmationOperation()
