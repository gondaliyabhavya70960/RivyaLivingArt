import type { SupabaseClient } from '@supabase/supabase-js'
import type { z } from 'zod'

import type { Role } from '@/lib/auth/permissions'
import type { Database } from '@/lib/supabase/database.types'

/**
 * The contract every bulk operation meets, and the reason there is exactly one.
 *
 * FEAT §20 ASKS FOR BULK ON THREE SURFACES. Written three times, that is three preview
 * implementations, three confirmation flows, three undo stories, and three places for the
 * destructive check to be forgotten — and the one that is forgotten is the one nobody reads again.
 * So a surface REGISTERS operations and implements none of the machinery: `preview`, `applyItem`
 * and a Zod schema are the whole of what an operation supplies.
 *
 * `preview` PERFORMS NO WRITES, AND THAT IS THE LOAD-BEARING PART OF THE CONTRACT. It is what the
 * operator reads before they decide, so a preview that mutated anything would make the decision
 * meaningless. `scripts/bulk/check-bulk-registry.mjs` fails the build on a mutation inside a
 * `preview`, and a registered operation that omits `preview` entirely fails a unit test.
 *
 * `applyItem` RETURNS `{ before, after }` AND IS IDEMPOTENT ON ITS OWN `after`. Both properties are
 * required: `before` is what undo re-applies, and idempotence is what makes re-running a `PARTIAL`
 * operation safe.
 *
 * AN OPERATION MAY BE REGISTERED AND UNAVAILABLE. Phase 24 registers the five research operations
 * with `available: false` and the phase that will implement them, so the Studio renders a named
 * unavailable state rather than a broken control — and so Phase 29 implements them against this
 * engine rather than building a second one.
 */

export type BulkTargetEntity = 'product' | 'media_asset' | 'inquiry' | 'research_product'

export type BulkClient = SupabaseClient<Database>

/** Who is running it. Passed to every operation so none has to look it up or guess. */
export interface BulkActor {
  readonly userId: string
  readonly role: Role
}

/**
 * What the preview says about one row, before anything is written.
 *
 * `SKIP` AND `INVALID` ARE DIFFERENT AND BOTH ARE SHOWN. A row that is skipped is already in the
 * state the operation would put it in — publishing something published — and a row that is invalid
 * fails a rule and names it. Collapsing the two into "not applied" would hide the second, which is
 * the one the operator needs to act on.
 */
export type PreviewOutcome = 'APPLY' | 'SKIP' | 'INVALID'

export interface PreviewItem {
  readonly entityId: string
  readonly outcome: PreviewOutcome
  /** A sentence a person reads. Required for SKIP and INVALID; absent for APPLY. */
  readonly reason?: string
  /** The named rule that refused it, for INVALID. `lib/catalog/validation.ts`'s vocabulary. */
  readonly rule?: string
  /** The row's own label, so the preview table does not have to fetch again. */
  readonly label?: string
}

export interface ApplyResult {
  readonly before: unknown
  readonly after: unknown
  /**
   * THE VERSION THE OPERATION LEFT THE ROW AT — read AFTER the write, not before it.
   *
   * This is the value undo compares against, and getting it the other way round is a bug that
   * cannot be seen without running the engine: the operation's own write moves `updated_at`
   * forward, so an undo comparing against the pre-write version finds a mismatch on EVERY row it
   * itself changed and skips all of them. An undo that never restores anything, reporting each row
   * as "changed since the operation ran", is worse than no undo at all — it is an undo that lies.
   *
   * Stored in `bulk_operation_items.row_version_before`, whose name reads correctly from the
   * undo's point of view: the version the row held BEFORE THE UNDO. Undo re-applies `before` only
   * where the row still holds it, which is exactly "nobody has touched this since we did".
   */
  readonly rowVersionForUndo: string | null
}

export interface BulkOperationContext {
  /** The service-role client. Every caller has already passed `requirePermission`. */
  readonly admin: BulkClient
  readonly actor: BulkActor
  /**
   * The `bulk_operations` row this call belongs to.
   *
   * ABSENT DURING A PREVIEW, PRESENT DURING AN APPLY, and the asymmetry is the honest one: a
   * preview is computed before the row exists on the first pass and is recomputed against an
   * existing row on the second, so an operation that needed it in `preview` would be relying on
   * which pass it was in. `product.import` needs it in `applyItem`, to record which operation
   * applied a file.
   */
  readonly operationId?: string
}

export interface BulkOperation<TParams = Record<string, never>> {
  /** `product.publish`. The registry key, and the `kind` stored on the operation row. */
  readonly kind: string
  readonly targetEntity: BulkTargetEntity

  /** Zod at the trust boundary (D1). Params arrive from a form. */
  readonly paramsSchema: z.ZodType<TParams>

  /**
   * Destructive operations need `destructive.execute` AND a typed row count.
   *
   * A FUNCTION WHERE THE ANSWER DEPENDS ON THE PARAMS. `product.set_status` is destructive exactly
   * when the transition takes a row OUT of PUBLISHED — moving DRAFT to REVIEW is not the same act
   * as unpublishing a live page, and treating them alike would either gate an ordinary edit behind
   * an owner or let an unpublish through on a merchandiser's say-so.
   */
  readonly isDestructive: boolean | ((params: TParams) => boolean)

  /**
   * False for an operation this phase registers but does not implement. The Studio renders an
   * unavailable state naming `owningPhase`, and the engine refuses to apply it.
   */
  readonly available?: boolean
  readonly owningPhase?: number

  /** WRITES NOTHING. Reads the selection and reports what would happen to each row. */
  readonly preview: (
    context: BulkOperationContext,
    selection: readonly string[],
    params: TParams,
  ) => Promise<PreviewItem[]>

  /** Applies one row and returns what it looked like before. Idempotent on its own `after`. */
  readonly applyItem: (
    context: BulkOperationContext,
    entityId: string,
    params: TParams,
  ) => Promise<ApplyResult>

  /**
   * Re-apply a `before` snapshot. Optional: when absent the engine writes `before` back with a
   * generic update, which suits every column-setting operation. An operation whose apply touches
   * more than the entity's own row — a join table, say — supplies its own.
   */
  readonly undoItem?: (
    context: BulkOperationContext,
    entityId: string,
    before: unknown,
  ) => Promise<void>
}

/** What `run.ts` reports back, and what the result screen renders. */
export interface BulkPreview {
  readonly operationId: string
  readonly confirmationToken: string
  readonly isDestructive: boolean
  readonly items: readonly PreviewItem[]
  readonly counts: BulkCounts
}

export interface BulkCounts {
  readonly selected: number
  readonly willApply: number
  readonly willSkip: number
  readonly willFail: number
  readonly applied?: number
  readonly skipped?: number
  readonly failed?: number
  readonly undone?: number
}

export type BulkStatus =
  'PREVIEW' | 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED' | 'UNDONE'

export interface BulkOutcome {
  readonly operationId: string
  readonly status: BulkStatus
  readonly counts: BulkCounts
  /** Ids that were not applied, with the reason. Rendered rather than counted. */
  readonly problems: ReadonlyArray<{ entityId: string; reason: string }>
  readonly undoDeadlineAt: string | null
}

/** The engine's caps. Named here so the guard, the engine and the copy all read the same numbers. */
export const MAX_SELECTION = 500
export const BATCH_SIZE = 50
export const UNDO_WINDOW_HOURS = 24
