import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { writeAudit } from '@/lib/auth/audit'
import type { Role } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/logging/activity'
import {
  MovementReasonError,
  moveStage,
  movementFor,
  recordEventAtCurrentStage,
  requireMovementReason,
  setDisposition,
} from '@/lib/scraper/core/stage'
import { getChange, markDecided } from '@/lib/supabase/repositories/research/changes'
import {
  getResearchProduct,
  setDuplicateOf,
  type ResearchStage,
} from '@/lib/supabase/repositories/research/products'
import {
  addNote,
  assignTag,
  latestStandingAction,
  markUndone,
  recordAction,
  removeTag,
  supersedeNote,
  type ReviewActionRow,
} from '@/lib/supabase/repositories/research/review'
import {
  archiveConfirmation,
  closeShortlistEntry,
  getLiveConfirmation,
  getOpenEntry,
  openShortlistEntry,
  readScoreCapture,
  recordConfirmation,
} from '@/lib/supabase/repositories/research/shortlist'
import type { Database } from '@/lib/supabase/database.types'

type Client = SupabaseClient<Database>

/**
 * The nine things a merchandiser may do with a research row, and the only code that does them.
 *
 * WHAT THIS MODULE IS REALLY FOR IS THE SENTENCE IT DOES NOT CONTAIN. FEAT §25's last line —
 * **changes are never automatically imported into Rivya products** — is not enforced by a comment
 * anywhere; it is enforced by there being no path. Nothing below writes to `products`,
 * `product_media`, `product_specs`, `product_materials` or `media_assets`, nothing constructs a
 * draft product, and `CONFIRM` moves a research row to a research stage and does nothing else at
 * all. `scripts/research/check-no-autoimport.mjs` reads this file, among others, and fails the
 * build if that stops being true.
 *
 * EVERY ACTION WRITES THREE THINGS, IN THIS ORDER, AND THE ORDER IS THE DESIGN:
 *
 *   1. the append-only `research_review_actions` row — the record of who and why;
 *   2. the domain effect, if any — a stage move, a disposition, a duplicate flag;
 *   3. the `research_changes` decision stamp — the queue's index into (1).
 *
 * There is no transaction: PostgREST offers no handle, the same constraint `moveStage` and the
 * Phase 24 bulk engine both work around. So the order is chosen for what a crash between any two
 * steps leaves behind. A crash after (1) leaves an audited decision the queue still shows as
 * undecided — somebody re-decides it, which is annoying and safe. A crash after (2) leaves an
 * effect that is fully accounted for in the log. The reverse order would leave a stage moved with
 * nothing saying who moved it, which is the one outcome an audit trail may not permit.
 *
 * TWO CLIENTS, AND WHICH ONE IS DELIBERATE IN EVERY CASE. The action row and the note go through
 * the SESSION client, so RLS judges the person's `research.confirm` a second time after the server
 * action has already checked it. The stage move, the disposition, the pipeline event and the
 * decision stamp go through the ADMIN client, because those tables have no session write policy at
 * all by design — the system records what happened, and a record its subject can forge is not one.
 * This is the model `explorer/actions.ts` documents; it is restated here because getting it
 * backwards is how Phase 28 shipped a merchandiser who could not clear a duplicate.
 */

export const REVIEW_ACTIONS = [
  'REVIEW',
  'IGNORE',
  'SHORTLIST',
  'REJECT',
  'MARK_DUPLICATE',
  'CONFIRM',
  'NOTE',
  'TAG',
  'COMPARE',
] as const
export type ReviewAction = (typeof REVIEW_ACTIONS)[number]

/** The six that decide a change. NOTE, TAG and COMPARE are things a person does, not verdicts. */
export const DECIDING_ACTIONS: readonly ReviewAction[] = [
  'REVIEW',
  'IGNORE',
  'SHORTLIST',
  'REJECT',
  'MARK_DUPLICATE',
  'CONFIRM',
]

export interface Actor {
  readonly userId: string
  /**
   * THE ROLE AT THE TIME, TYPED AS THE ROLE UNION rather than as a string.
   *
   * `research_review_actions.actor_role` is text at the row because a role that is renamed must not
   * make an old decision unreadable; the caller, however, is always handing over a live session's
   * role, and typing it as `string` here would let a mis-plumbed field arrive as an empty one.
   */
  readonly role: Role
}

export interface ActionInput {
  readonly productId: string
  /** Null when the action is taken on the row from the explorer rather than on a queued change. */
  readonly changeId: string | null
  readonly reason: string | null
  readonly actor: Actor
  /** Phase 35: the direction brief that argued for a shortlist entry or a confirmation, if any. */
  readonly briefId?: string | null
}

export class ReviewActionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReviewActionError'
  }
}

/**
 * REJECT and IGNORE need a reason; the database says so too.
 *
 * CHECKED HERE AS WELL AS AT THE ROW so that the person gets a sentence rather than a constraint
 * name. The row-level check is what makes it true for a hand-written INSERT; this is what makes it
 * readable on the screen where it happened.
 */
function requireReason(action: ReviewAction, reason: string | null): string | null {
  const needed = action === 'REJECT' || action === 'IGNORE' || action === 'CONFIRM'
  const given = reason !== null && reason.trim() !== ''
  if (needed && !given) {
    // PHASE 35 ADDS CONFIRM TO THE TWO. Its reason is the decision note behind the confirmation —
    // `research_confirmations.decision_note` is `not null` and non-blank at the row — and a
    // confirmation nobody can explain is the thing the decision record exists to prevent.
    throw new ReviewActionError(
      action === 'CONFIRM'
        ? 'CONFIRM needs a decision note: it is the record of why this row is a reference.'
        : `${action} needs a reason: it closes the row without a re-read.`,
    )
  }
  return given ? (reason as string).trim() : null
}

/** Phase 35's movement table, read for the reason it requires; its error made readable. */
function requireMovement(
  column: 'stage' | 'disposition',
  from: string,
  to: string,
  reason: string | null,
): void {
  try {
    requireMovementReason(movementFor(column, from, to), reason)
  } catch (error) {
    if (error instanceof MovementReasonError) throw new ReviewActionError(error.message)
    throw error
  }
}

/** The entry's reason when the person gave none — the table does not require one for a shortlist. */
const SHORTLISTED_WITHOUT_REASON = 'Shortlisted without a stated reason.'

/**
 * Step 1 and step 3 of every action, with the domain effect in between.
 *
 * THE STAMP IS SKIPPED FOR THE THREE NON-DECIDING ACTIONS. Adding a note to a change does not
 * decide it, and stamping `decided_action = 'NOTE'` would take it out of the queue — which is
 * exactly the behaviour somebody would report as "my notes are making changes disappear".
 */
async function withAction<T>(
  client: Client,
  admin: Client,
  action: ReviewAction,
  input: ActionInput,
  effect: () => Promise<T>,
): Promise<{ readonly actionRow: ReviewActionRow; readonly result: T }> {
  const reason = requireReason(action, input.reason)

  /*
   * COMPARE'S ROW IS WRITTEN AS THE SYSTEM, AND IT IS THE ONLY ONE OF THE NINE THAT IS.
   *
   * `STUDIO_GUIDE.md` §12.6 states the reason and it is right: comparing is READ-ONLY, it needs
   * only `research.read`, and a researcher who can open `/studio/research/compare` directly must
   * not be refused the identical view from the queue. But `research_review_actions` is
   * `research.confirm` at the table, so a researcher's session cannot insert into it — and it
   * should not be able to: every other row there is a verdict.
   *
   * COMPARE is not a verdict. It is not in `DECIDING_ACTIONS`, it stamps nothing on the change, and
   * what it records is that a comparison HAPPENED — an observation the system makes, in the same
   * sense the pipeline event beside it is. So the system writes it, and the log stays complete for
   * everybody who compares rather than only for the people permitted to decide.
   */
  const writer = action === 'COMPARE' ? admin : client

  const actionRow = await recordAction(writer, {
    productId: input.productId,
    changeId: input.changeId,
    action,
    reason,
    actorUserId: input.actor.userId,
    actorRole: input.actor.role,
  })

  const result = await effect()

  if (input.changeId !== null && DECIDING_ACTIONS.includes(action)) {
    await markDecided(admin, {
      changeId: input.changeId,
      action,
      actorUserId: input.actor.userId,
    })
  }

  await writeAudit({
    action: `research.review.${action.toLowerCase()}`,
    result: 'SUCCESS',
    actorUserId: input.actor.userId,
    actorRole: input.actor.role,
    entityType: 'research_product',
    entityId: input.productId,
    summary: reason ?? `${action} on a research row`,
  })

  return { actionRow, result }
}

/**
 * Move a row forward only if it is behind.
 *
 * REVIEW ON A ROW ALREADY AT `SHORTLISTED` IS A NO-OP ON THE STAGE AND STILL AN ACTION ROW. The
 * phase document's wording is "moves `MATCHED → REVIEW` if it was lower", and the reason to obey
 * it exactly is that acknowledging a new price change on a row somebody shortlisted last week must
 * not un-shortlist it. The acknowledgement is real and is recorded; the stage is not touched.
 */
async function raiseTo(
  admin: Client,
  productId: string,
  target: ResearchStage,
  actorUserId: string,
  reason: string,
): Promise<void> {
  const product = await getResearchProduct(admin, productId)
  if (product === null) return

  const current = product.stage as ResearchStage
  if (current === target) {
    await recordEventAtCurrentStage(admin, { productId, actorUserId, reason })
    return
  }

  try {
    await moveStage(admin, { productId, to: target, actor: { userId: actorUserId }, reason })
  } catch {
    // AN ILLEGAL MOVE IS NOT AN ERROR HERE, IT IS THE "if it was lower" CLAUSE. `isLegalMove`
    // already encodes the pipeline's forward order; a row past the target refuses the move, and
    // what that means is that the row is already further on than this action would take it. The
    // action row and the event still record that somebody acted.
    await recordEventAtCurrentStage(admin, { productId, actorUserId, reason })
  }
}

/** 1. Review — acknowledge the change. */
export async function reviewChange(client: Client, admin: Client, input: ActionInput) {
  return withAction(client, admin, 'REVIEW', input, async () => {
    await raiseTo(admin, input.productId, 'REVIEW', input.actor.userId, 'reviewed')
  })
}

/**
 * 2. Ignore — close this change, leave the row where it is.
 *
 * IGNORE IS ABOUT THE CHANGE, NOT THE ROW, and that is the difference between it and Reject.
 * Ignoring a price move says "this movement does not matter"; the product is still a product worth
 * watching. Rejecting says the row itself is not interesting. Conflating them would make the queue
 * unable to express the commonest judgement it exists for.
 */
export async function ignoreChange(client: Client, admin: Client, input: ActionInput) {
  return withAction(client, admin, 'IGNORE', input, async () => {
    await recordEventAtCurrentStage(admin, {
      productId: input.productId,
      actorUserId: input.actor.userId,
      reason: `ignored: ${input.reason ?? ''}`.trim(),
    })
  })
}

/**
 * 3. Shortlist — the row joins the shortlist, and Phase 35 writes down why.
 *
 * THE ENTRY IS THE WORKSPACE. `research_shortlist_entries` records who shortlisted the row, why,
 * and the score as it stood; the stage move is still `stage.ts`'s and the review-action row is
 * still the first write. One open entry per row is a partial unique index, so a second shortlist
 * of a row already on the list records the action and touches no entry.
 *
 * FROM CONFIRMED, IT IS THE MOVEMENT TABLE'S REOPENING: `CONFIRMED → SHORTLISTED` needs a reason,
 * archives the live confirmation with that reason and opens a fresh entry. The stage moves back —
 * a backward move is legal — and the row is a shortlisted row again with its history intact.
 */
export async function shortlistProduct(client: Client, admin: Client, input: ActionInput) {
  const product = await getResearchProduct(admin, input.productId)
  const from = (product?.stage ?? null) as ResearchStage | null
  if (from === 'CONFIRMED') requireMovement('stage', 'CONFIRMED', 'SHORTLISTED', input.reason)

  return withAction(client, admin, 'SHORTLIST', input, async () => {
    const reason = input.reason?.trim() ?? ''

    if (from === 'CONFIRMED') {
      await moveStage(admin, {
        productId: input.productId,
        to: 'SHORTLISTED',
        actor: { userId: input.actor.userId },
        reason,
      })
      await archiveConfirmation(client, { researchProductId: input.productId, reason })
    } else {
      await raiseTo(admin, input.productId, 'SHORTLISTED', input.actor.userId, 'shortlisted')
    }

    const after = await getResearchProduct(admin, input.productId)
    if (after?.stage !== 'SHORTLISTED') return
    if ((await getOpenEntry(client, input.productId)) !== null) return

    const captured = await readScoreCapture(client, input.productId)
    await openShortlistEntry(client, {
      researchProductId: input.productId,
      reason: reason === '' ? SHORTLISTED_WITHOUT_REASON : reason,
      captured,
      briefId: input.briefId ?? null,
      actorUserId: input.actor.userId,
    })
  })
}

/**
 * 3b. Send back to review — `SHORTLISTED → REVIEW`, the movement that closes the entry.
 *
 * RECORDED AS A `REVIEW` ACTION, because that is the nine-value allowlist's name for "somebody
 * looked again"; the reason is required by the movement table and becomes `closed_reason`. The
 * stage moves back through `stage.ts`, so the pipeline log has the move.
 */
export async function returnToReview(client: Client, admin: Client, input: ActionInput) {
  const product = await getResearchProduct(admin, input.productId)
  if (product === null || product.stage !== 'SHORTLISTED') {
    throw new ReviewActionError('Only a shortlisted row can be sent back to review.')
  }
  requireMovement('stage', 'SHORTLISTED', 'REVIEW', input.reason)
  const reason = (input.reason as string).trim()

  return withAction(client, admin, 'REVIEW', input, async () => {
    await moveStage(admin, {
      productId: input.productId,
      to: 'REVIEW',
      actor: { userId: input.actor.userId },
      reason,
    })
    await closeShortlistEntry(client, {
      researchProductId: input.productId,
      reason,
      actorUserId: input.actor.userId,
    })
  })
}

/**
 * 4. Reject — the row is not interesting. Stage retained.
 *
 * THE STAGE IS DELIBERATELY NOT MOVED. `disposition` and `stage` are two different questions —
 * where a row got to, and what somebody decided about it — and Phase 25 separated them precisely so
 * that rejecting a row at `VALIDATED` does not erase the fact that it validated.
 */
export async function rejectProduct(client: Client, admin: Client, input: ActionInput) {
  return withAction(client, admin, 'REJECT', input, async () => {
    await setDisposition(admin, {
      productId: input.productId,
      disposition: 'REJECTED',
      actor: { userId: input.actor.userId },
      reason: input.reason,
    })
  })
}

/**
 * 5. Mark Duplicate — this row is the same product as another, which survives.
 *
 * THE SURVIVOR IS CHOSEN, NEVER INFERRED. `duplicate_of_id` points at the row that stays, and the
 * caller must name it: a duplicate flag whose target the system picked is a merge nobody approved.
 */
export async function markDuplicate(
  client: Client,
  admin: Client,
  input: ActionInput & { readonly survivingProductId: string },
) {
  if (input.survivingProductId === input.productId) {
    throw new ReviewActionError('A row cannot be a duplicate of itself.')
  }
  return withAction(client, admin, 'MARK_DUPLICATE', input, async () => {
    await setDuplicateOf(admin, {
      id: input.productId,
      duplicateOfId: input.survivingProductId,
      actorId: input.actor.userId,
    })
    await setDisposition(admin, {
      productId: input.productId,
      disposition: 'DUPLICATE',
      actor: { userId: input.actor.userId },
      reason: input.reason ?? `duplicate of ${input.survivingProductId}`,
    })
  })
}

/**
 * 6. Confirm — stage becomes `CONFIRMED`.
 *
 * **THIS MEANS "CONFIRMED AS A RESEARCH REFERENCE" AND NOTHING ELSE.** It creates no product, no
 * draft product, no media row and no CMS content. There is no code path from here to any of those,
 * and the absence is checked by `scripts/research/check-no-autoimport.mjs` and asserted by
 * `tests/unit/research-no-autoimport.test.ts` rather than being left to a reader's good faith.
 *
 * The Studio dialog says the same thing in seeded copy, because the risk this guards against is
 * not a developer adding an import — it is somebody in a meeting reading "confirmed" as "approved
 * for the catalogue", and deciding six months later that the pipeline must have been importing
 * things all along.
 */
export async function confirmProduct(client: Client, admin: Client, input: ActionInput) {
  /*
   * PHASE 35 MAKES THE MOVEMENT EXACT. The table admits `SHORTLISTED → CONFIRMED` and nothing
   * else into CONFIRMED, with a reason that becomes the decision note. A row at REVIEW is refused
   * with a sentence, not silently left where it was; a row already CONFIRMED with a live decision
   * is refused too; a row CONFIRMED whose decision was archived takes a fresh decision without
   * moving — archiving freed it for exactly that.
   */
  const product = await getResearchProduct(admin, input.productId)
  if (product === null) throw new ReviewActionError('That research row no longer exists.')
  const from = product.stage as ResearchStage
  if (from !== 'SHORTLISTED' && from !== 'CONFIRMED') {
    throw new ReviewActionError('Only a shortlisted row can be confirmed. Shortlist it first.')
  }
  if (from === 'CONFIRMED' && (await getLiveConfirmation(client, input.productId)) !== null) {
    throw new ReviewActionError('This row is already confirmed, and its decision stands.')
  }
  requireMovement('stage', 'SHORTLISTED', 'CONFIRMED', input.reason)

  return withAction(client, admin, 'CONFIRM', input, async () => {
    const decisionNote = (input.reason as string).trim()

    if (from === 'SHORTLISTED') {
      await moveStage(admin, {
        productId: input.productId,
        to: 'CONFIRMED',
        actor: { userId: input.actor.userId },
        reason: decisionNote,
      })
    }

    const confirmation = await recordConfirmation(client, {
      researchProductId: input.productId,
      decisionNote,
      briefId: input.briefId ?? null,
      actorUserId: input.actor.userId,
    })
    await closeShortlistEntry(client, {
      researchProductId: input.productId,
      reason: 'confirmed',
      actorUserId: input.actor.userId,
    })
    await logActivity({
      action: 'research.product.confirmed',
      actorId: input.actor.userId,
      actorRole: input.actor.role,
      entityType: 'research_product',
      entityId: input.productId,
      summary: 'Confirmed as a research reference. No Rivya product was created.',
      metadata: { confirmationId: confirmation.id },
    })
    return confirmation
  })
}

/**
 * 6b. Archive a decision — a column, not a stage.
 *
 * THE STAGE IS UNTOUCHED AND NO PIPELINE EVENT IS WRITTEN: nothing moved. The confirmation gets
 * `archived_at` and the reason; the row remains a confirmed research reference, and the partial
 * unique index now admits a fresh decision. Not one of the nine review actions — it decides
 * nothing about the row — so no review-action row is written; the audit row is the record.
 */
export async function archiveDecision(
  client: Client,
  input: { readonly productId: string; readonly reason: string | null; readonly actor: Actor },
): Promise<void> {
  const reason = input.reason?.trim() ?? ''
  if (reason === '') throw new ReviewActionError('Archiving a decision needs a reason.')
  const archived = await archiveConfirmation(client, { researchProductId: input.productId, reason })
  if (!archived) throw new ReviewActionError('This row has no live decision to archive.')
  await writeAudit({
    action: 'research.confirmation.archived',
    result: 'SUCCESS',
    actorUserId: input.actor.userId,
    actorRole: input.actor.role,
    entityType: 'research_product',
    entityId: input.productId,
    summary: reason,
  })
}

/** 7. Add Note. */
export async function addProductNote(
  client: Client,
  admin: Client,
  input: ActionInput & { readonly body: string; readonly supersedesNoteId?: string },
) {
  if (input.body.trim() === '') throw new ReviewActionError('A note needs a body.')

  return withAction(client, admin, 'NOTE', input, async () => {
    const note = await addNote(client, {
      productId: input.productId,
      body: input.body.trim(),
      authorUserId: input.actor.userId,
    })
    if (input.supersedesNoteId !== undefined) {
      await supersedeNote(admin, { noteId: input.supersedesNoteId, supersededBy: note.id })
    }
    return note
  })
}

/**
 * 8. Add Tag, and its removal.
 *
 * FREE TEXT IS REJECTED BY THE FOREIGN KEY, not by a check here. A tag id that names no row fails
 * at the database, which is the only place that can be sure — a check in TypeScript against a list
 * read a moment ago is a check against a list that may have changed.
 */
export async function tagProduct(
  client: Client,
  admin: Client,
  input: ActionInput & { readonly tagId: string; readonly remove?: boolean },
) {
  return withAction(client, admin, 'TAG', input, async () => {
    if (input.remove === true) {
      await removeTag(client, { productId: input.productId, tagId: input.tagId })
    } else {
      await assignTag(client, {
        productId: input.productId,
        tagId: input.tagId,
        actorUserId: input.actor.userId,
      })
    }
  })
}

/**
 * 9. Compare — open up to four rows side by side.
 *
 * **IT RECORDS AN ACTIVITY EVENT AND NOTHING ELSE.** No stage, no disposition, no decision stamp,
 * no change to any row being compared. The phase document is explicit and the reason is worth
 * stating: comparison is how somebody makes up their mind, and a tool that recorded a verdict for
 * looking would make people avoid looking.
 */
export async function recordComparison(
  client: Client,
  admin: Client,
  input: ActionInput & { readonly againstProductIds: readonly string[] },
) {
  if (input.againstProductIds.length > 3) {
    throw new ReviewActionError('Compare opens at most four rows, so at most three others.')
  }
  return withAction(client, admin, 'COMPARE', input, async () => {
    await recordEventAtCurrentStage(admin, {
      productId: input.productId,
      actorUserId: input.actor.userId,
      reason: `compared with ${input.againstProductIds.length} other row(s)`,
    })
  })
}

/**
 * Undo a decision.
 *
 * A REVERSAL IS A NEW ROW POINTING AT THE OLD ONE. Nothing is edited and nothing is deleted; the
 * trigger on the table would refuse either. The queue's stamp is then RECOMPUTED from the log
 * rather than cleared, because undoing a shortlist does not always return a change to undecided —
 * somebody may have reviewed it first, and that judgement still stands.
 *
 * THE DOMAIN EFFECT IS NOT AUTOMATICALLY REVERSED, and that is a deliberate limit rather than an
 * omission. Undoing a `CONFIRM` records that the confirmation was withdrawn; moving the stage back
 * would be a second decision, and the pipeline's stage order is forward-only by design (`0231`).
 * What a person does next — reject the row, or leave it confirmed with a note — is theirs to
 * choose, and the log now says the confirmation was withdrawn and by whom.
 */
export async function undoAction(
  client: Client,
  admin: Client,
  input: {
    readonly actionId: string
    readonly productId: string
    readonly changeId: string | null
    readonly reason: string | null
    readonly actor: Actor
  },
): Promise<ReviewActionRow> {
  const reversal = await recordAction(client, {
    productId: input.productId,
    changeId: input.changeId,
    action: 'REVIEW',
    reason: input.reason ?? 'undone',
    actorUserId: input.actor.userId,
    actorRole: input.actor.role,
  })

  await markUndone(admin, { actionId: input.actionId, undoneByActionId: reversal.id })

  if (input.changeId !== null) {
    const standing = await latestStandingAction(client, input.changeId)
    await markDecided(admin, {
      changeId: input.changeId,
      action: standing?.action ?? null,
      actorUserId: standing?.actor_user_id ?? null,
    })
  }

  await writeAudit({
    action: 'research.review.undo',
    result: 'SUCCESS',
    actorUserId: input.actor.userId,
    actorRole: input.actor.role,
    entityType: 'research_product',
    entityId: input.productId,
    summary: `undid action ${input.actionId}`,
  })

  return reversal
}

/**
 * The change a queued action is about, read before it is acted on.
 *
 * THE PRODUCT COMES FROM THE CHANGE ROW, NEVER FROM THE REQUEST. A crafted POST naming a change id
 * and somebody else's product id would otherwise stage-move a row the change says nothing about.
 */
export async function resolveChangeTarget(
  client: Client,
  changeId: string,
): Promise<{ readonly productId: string; readonly sourceId: string } | null> {
  const change = await getChange(client, changeId)
  if (change === null) return null
  return { productId: change.research_product_id, sourceId: change.source_id }
}
