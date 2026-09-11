import 'server-only'

import { PermissionError } from '@/lib/supabase/errors'
import { recordPipelineEvent } from '@/lib/supabase/repositories/research/events'
import {
  getResearchProduct,
  writeProductDisposition,
  writeProductStage,
  type ResearchDisposition,
  type ResearchStage,
} from '@/lib/supabase/repositories/research/products'
import type { Database } from '@/lib/supabase/database.types'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The stage machine. THE ONLY WRITER of `research_products.stage`, anywhere.
 *
 * WHY ONE MODULE. A stage that can be set from a route, a script and two server actions is a stage
 * whose history is incomplete — and the history is the entire point. `research_pipeline_events`
 * answers "how did this row reach CONFIRMED, and who moved it at each step", and it can only
 * answer that if every move goes through one function that writes both halves. The guard script
 * enforces the rule mechanically: `writeProductStage` may be imported here and nowhere else.
 *
 * FORWARD ONE STEP AT A TIME, and the restriction is not bureaucracy. Each stage has a phase that
 * OWNS it — Phase 28 normalises and validates, Phase 28 matches, Phase 29 reviews and shortlists —
 * and a jump from RAW to SHORTLISTED means a row reached a merchandiser's shortlist without ever
 * having been normalised, validated or matched. What they would be judging is a URL and a page
 * title. The one legal exception is a MOVE BACK, which is not a jump: a person who finds a
 * mis-normalised row sends it back to be done again, and sending it back one step or five is the
 * same act.
 *
 * REJECTION IS NOT A STAGE. Ignoring, rejecting or marking a row duplicate writes `disposition`
 * and leaves `stage` exactly where it was, so "how far did this get before we said no" stays
 * answerable. `setDisposition` is the other half of this module for that reason.
 */

type Client = SupabaseClient<Database>

/** FEAT §23, in order. The array IS the ordering — nothing else encodes it. */
export const STAGE_ORDER = [
  'RAW',
  'NORMALIZED',
  'VALIDATED',
  'MATCHED',
  'REVIEW',
  'SHORTLISTED',
  'CONFIRMED',
] as const satisfies readonly ResearchStage[]

export function stageIndex(stage: ResearchStage): number {
  return STAGE_ORDER.indexOf(stage)
}

/**
 * Is this move legal?
 *
 * Forward by exactly one, or backward by any amount. Not sideways to itself: a move that changes
 * nothing would write an event saying something happened when nothing did, and a log with entries
 * for non-events is a log people stop reading.
 */
export function isLegalMove(from: ResearchStage, to: ResearchStage): boolean {
  const fromIndex = stageIndex(from)
  const toIndex = stageIndex(to)
  if (fromIndex === -1 || toIndex === -1) return false
  if (toIndex === fromIndex) return false
  if (toIndex < fromIndex) return true
  if (toIndex === fromIndex + 1) return true
  // Phase 35: the one forward jump the movement table names — a MATCHED row may be shortlisted
  // without first passing through REVIEW, because "review" is what a merchandiser does when
  // shortlisting it.
  return MOVEMENTS.some(
    (movement) => movement.column === 'stage' && movement.from.includes(from) && movement.to === to,
  )
}

/**
 * THE MOVEMENT TABLE — Phase 35, cell for cell from PHASE-31-38 §Phase 35.
 *
 * `stage` is the ladder; `disposition` is the verdict; a row carries one of each and neither
 * moves the other. `tests/unit/pipeline-transitions.test.ts` reads this table and asserts it
 * matches the document. `reasonRequired` is enforced by the actions and the bulk operations —
 * a reason becomes `research_shortlist_entries.closed_reason`, `research_confirmations.
 * decision_note` or `research_confirmations.archived_reason` — and the pipeline event carries it.
 */
export interface Movement {
  readonly column: 'stage' | 'disposition'
  readonly from: readonly string[]
  readonly to: string
  readonly permission: 'research.confirm'
  readonly reasonRequired: boolean
  readonly note: string
}

export const MOVEMENTS: readonly Movement[] = [
  {
    column: 'stage',
    from: ['MATCHED', 'REVIEW'],
    to: 'SHORTLISTED',
    permission: 'research.confirm',
    reasonRequired: false,
    note: "Phase 29's Shortlist action; opens a shortlist entry",
  },
  {
    column: 'stage',
    from: ['SHORTLISTED'],
    to: 'CONFIRMED',
    permission: 'research.confirm',
    reasonRequired: true,
    note: 'the reason becomes research_confirmations.decision_note; closes the entry',
  },
  {
    column: 'stage',
    from: ['SHORTLISTED'],
    to: 'REVIEW',
    permission: 'research.confirm',
    reasonRequired: true,
    note: 'closes the shortlist entry',
  },
  {
    column: 'stage',
    from: ['CONFIRMED'],
    to: 'SHORTLISTED',
    permission: 'research.confirm',
    reasonRequired: true,
    note: 'archives the confirmation and reopens the entry',
  },
  {
    column: 'disposition',
    from: ['NONE'],
    to: 'IGNORED',
    permission: 'research.confirm',
    reasonRequired: false,
    note: '',
  },
  {
    column: 'disposition',
    from: ['NONE'],
    to: 'REJECTED',
    permission: 'research.confirm',
    reasonRequired: true,
    note: '',
  },
  {
    column: 'disposition',
    from: ['NONE'],
    to: 'DUPLICATE',
    permission: 'research.confirm',
    reasonRequired: true,
    note: 'plus a surviving row for duplicate_of_id',
  },
  {
    column: 'disposition',
    from: ['IGNORED', 'REJECTED', 'DUPLICATE'],
    to: 'NONE',
    permission: 'research.confirm',
    reasonRequired: true,
    note: '',
  },
]

/** The movement a change matches, or null when the table has no row for it. */
export function movementFor(column: Movement['column'], from: string, to: string): Movement | null {
  return (
    MOVEMENTS.find(
      (movement) =>
        movement.column === column && movement.from.includes(from) && movement.to === to,
    ) ?? null
  )
}

/** Refuse a movement the table requires a reason for, when none was given. */
export function requireMovementReason(movement: Movement | null, reason: string | null): void {
  if (movement !== null && movement.reasonRequired && (reason === null || reason.trim() === '')) {
    throw new MovementReasonError(movement)
  }
}

export class MovementReasonError extends Error {
  constructor(readonly movement: Movement) {
    super(
      `${movement.from.join('/')} → ${movement.to} needs a reason: ${movement.note || 'the table says so'}.`,
    )
    this.name = 'MovementReasonError'
  }
}

/** The phase document's name for the same error. */
export { StageTransitionError as InvalidStageTransitionError }

export class StageTransitionError extends Error {
  constructor(
    readonly from: ResearchStage,
    readonly to: ResearchStage,
  ) {
    super(
      `A row at ${from} cannot move to ${to}. Stages move forward one at a time, ` +
        'and only backwards in a jump.',
    )
    this.name = 'StageTransitionError'
  }
}

export interface StageActor {
  /** Null for the pipeline itself, which is what makes the event SYSTEM rather than STAFF. */
  readonly userId: string | null
}

/**
 * Move one row, and record that it moved.
 *
 * BOTH WRITES OR NEITHER IS THE INTENT, AND THIS IS NOT A TRANSACTION — PostgREST gives no
 * transaction handle, the same constraint Phase 24's batching ran into. What is done instead is
 * to write the EVENT FIRST and the stage second. If the second write fails, the log holds an event
 * for a move that did not take effect, which is visible and reconcilable by comparing the row's
 * stage with its last event. The other order fails the other way: a row that moved with no record
 * of who moved it, which is indistinguishable from a row that was always there — invisible, and
 * exactly what the log exists to prevent.
 */
export async function moveStage(
  admin: Client,
  input: {
    readonly productId: string
    readonly to: ResearchStage
    readonly actor: StageActor
    readonly reason: string | null
  },
): Promise<{ from: ResearchStage; to: ResearchStage }> {
  const product = await getResearchProduct(admin, input.productId)
  if (product === null) {
    throw new StageTransitionError('RAW', input.to)
  }

  const from = product.stage as ResearchStage
  if (!isLegalMove(from, input.to)) throw new StageTransitionError(from, input.to)

  await recordPipelineEvent(admin, {
    entityType: 'research_product',
    entityId: input.productId,
    fromStage: from,
    toStage: input.to,
    actorUserId: input.actor.userId,
    reason: input.reason,
  })

  await writeProductStage(admin, {
    id: input.productId,
    stage: input.to,
    actorId: input.actor.userId,
  })

  return { from, to: input.to }
}

/**
 * Record that something happened to a row WITHOUT moving it, at whatever stage it is at.
 *
 * **THE CHECK THIS EXISTS FOR.** `research_pipeline_events_moves_somewhere` (0231) requires at
 * least one of `from_stage`/`to_stage` to be present, so an event about a row that did not move
 * cannot leave both null — it records the stage it happened AT in both columns, and a reader sees
 * `VALIDATED → VALIDATED` and knows the row was edited while validated.
 *
 * PHASE 28 SHIPPED FOUR CALLERS THAT PASSED BOTH AS NULL — a hand correction, an auto-merge, a
 * confirmed duplicate and its undo. Every one of them would have raised a constraint violation on
 * first use, and because the event is the LAST write in each sequence with no transaction around
 * it, the earlier writes had already committed: a product left flagged `DUPLICATE` with no event,
 * and `clearDuplicate` — the documented undo — failing in the same way, so the flag could not be
 * cleared from the screen that set it. This helper is what those callers use now.
 *
 * **IT TAKES AN ADMIN CLIENT AND THE PARAMETER IS NAMED FOR IT.** `research_pipeline_events` has no
 * insert policy for `authenticated` and never will (0233): an event is the system's record of what
 * happened, and a record its subject can forge is not one. Three of those four callers passed a
 * SESSION client, so RLS would have refused the insert even had the columns been right.
 */
export async function recordEventAtCurrentStage(
  admin: Client,
  input: {
    readonly productId: string
    readonly actorUserId: string | null
    readonly reason: string
  },
): Promise<void> {
  const product = await getResearchProduct(admin, input.productId)
  if (product === null) return

  const at = product.stage as ResearchStage
  await recordPipelineEvent(admin, {
    entityType: 'research_product',
    entityId: input.productId,
    fromStage: at,
    toStage: at,
    actorUserId: input.actorUserId,
    reason: input.reason,
  })
}

/**
 * Set a disposition, leaving the stage alone.
 *
 * THE EVENT HAS NO `from_stage` AND NO `to_stage`, which is honest rather than lossy: nothing
 * moved. The row-level CHECK requires at least one of the two to be present, so a disposition
 * event records the stage it happened AT in both columns — the reader sees RAW → RAW and knows the
 * row was rejected while still raw, which is the fact worth keeping.
 */
export async function setDisposition(
  admin: Client,
  input: {
    readonly productId: string
    readonly disposition: ResearchDisposition
    readonly actor: StageActor
    readonly reason: string | null
  },
): Promise<void> {
  const product = await getResearchProduct(admin, input.productId)
  if (product === null) return

  const at = product.stage as ResearchStage

  await recordPipelineEvent(admin, {
    entityType: 'research_product',
    entityId: input.productId,
    fromStage: at,
    toStage: at,
    actorUserId: input.actor.userId,
    reason: input.reason ?? `disposition: ${input.disposition}`,
  })

  await writeProductDisposition(admin, {
    id: input.productId,
    disposition: input.disposition,
    actorId: input.actor.userId,
  })
}

/**
 * The guard a server action calls before either of the above.
 *
 * IT IS HERE RATHER THAN INLINE AT EACH CALL SITE so that "which permission moves a stage" has one
 * answer. `research.confirm` — owner, admin, merchandiser — because the phase document's dividing
 * line is the COLUMN and not the screen: `stage` and `disposition` are disposition-bearing, so a
 * researcher who operates the pipeline does not judge its output. RLS says the same thing at the
 * table; this is the first of the two nets, and it is the one that produces a readable error.
 */
export function assertMayMoveStage(hasConfirm: boolean): void {
  if (!hasConfirm) {
    throw new PermissionError('move a research row', 'research product')
  }
}
