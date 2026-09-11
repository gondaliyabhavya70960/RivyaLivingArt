'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { StudioFormState } from '@/components/studio/form-state'
import { requirePermission } from '@/lib/auth/require'
import {
  addProductNote,
  confirmProduct,
  ignoreChange,
  markDuplicate,
  recordComparison,
  rejectProduct,
  reviewChange,
  shortlistProduct,
  tagProduct,
  undoAction,
  ReviewActionError,
} from '@/lib/scraper/workflows/review-actions'
import { createAdminClient } from '@/lib/supabase/admin'
import { getChange } from '@/lib/supabase/repositories/research/changes'
import { createClient } from '@/lib/supabase/server'

import type { Actor } from '@/lib/scraper/workflows/review-actions'

/**
 * The nine FEAT §25 actions, as Server Actions.
 *
 * ALL NINE REQUIRE `research.confirm` AND THE CHECK IS THE FIRST LINE OF EVERY ONE. A Server Action
 * is an HTTP endpoint: the absence of a button on the screen is not a gate, and a researcher
 * crafting a POST is exactly the case `requirePermission` exists for. RLS says the same thing at
 * the three tables a person writes here, so a bug in this file meets a second refusal rather than
 * a service-role key — which is the whole reason the action row and the note go through the
 * SESSION client while the stage move and the decision stamp go through the admin one.
 *
 * THE PRODUCT IS READ FROM THE CHANGE ROW, NEVER FROM THE FORM. Every action that names a change
 * resolves the product through `getChange`, because a crafted POST pairing a change id with
 * somebody else's product id would otherwise stage-move a row the change says nothing about.
 *
 * **NONE OF THEM CREATES A RIVYA PRODUCT.** Confirm moves a research row to a research stage. The
 * dialog says so in seeded copy, `scripts/research/check-no-autoimport.mjs` proves there is no
 * path, and `tests/unit/research-no-autoimport.test.ts` proves it by counting rows either side.
 */

const ok = (): StudioFormState => ({ status: 'saved' })

const issue = (message: string, code = 'refused'): StudioFormState => ({
  status: 'error',
  issues: [{ field: '_form', code, message }],
})

const uuid = z.string().uuid()

/** What every queued action needs, read once and validated once. */
async function resolveTarget(
  form: FormData,
): Promise<
  | { readonly ok: true; readonly changeId: string; readonly productId: string }
  | { readonly ok: false; readonly state: StudioFormState }
> {
  const changeId = uuid.safeParse(form.get('change_id'))
  if (!changeId.success) {
    return { ok: false, state: issue('That change could not be identified.', 'required') }
  }
  const client = await createClient()
  const change = await getChange(client, changeId.data)
  if (change === null) {
    return { ok: false, state: issue('That change could not be found.', 'missing') }
  }
  return { ok: true, changeId: change.id, productId: change.research_product_id }
}

function refresh(): void {
  revalidatePath('/studio/research/changes')
  revalidatePath('/studio/research/explorer')
  revalidatePath('/studio/research/dashboard')
  // Phase 30's workspace renders the same action bar over the same rows, so a decision taken there
  // has to invalidate the screen it was taken on as well as the queue it came from.
  revalidatePath('/studio/research/large-format')
}

/**
 * One shape for all nine, because they differ only in which function they call.
 *
 * THE ERROR HANDLING IS WHY THIS IS SHARED. `ReviewActionError` carries a sentence written for the
 * person — "REJECT needs a reason: it closes the row without a re-read" — and everything else is a
 * database or permission failure whose message is not theirs to read. Repeating that distinction
 * nine times is nine chances to leak a constraint name onto a screen.
 */
async function runAction(
  form: FormData,
  run: (context: {
    readonly client: Awaited<ReturnType<typeof createClient>>
    readonly admin: ReturnType<typeof createAdminClient>
    readonly actor: Actor
    readonly changeId: string | null
    readonly productId: string
    readonly reason: string | null
  }) => Promise<void>,
  options: {
    readonly requiresChange?: boolean
    /**
     * COMPARE IS THE ONE THAT NEEDS ONLY `research.read`, per STUDIO_GUIDE.md §12.6.
     *
     * Eight of the nine decide something and are `research.confirm` — the same permission
     * `assertMayMoveStage` checks one row at a time inside `core/stage.ts`, checked here first so
     * the person gets a refusal they can read and again at the table by RLS. Comparing decides
     * nothing: a researcher who may open `/studio/research/compare` directly must not be refused
     * the identical read-only view from the queue.
     */
    readonly permission?: 'research.read' | 'research.confirm'
  } = {},
): Promise<StudioFormState> {
  try {
    const session = await requirePermission(options.permission ?? 'research.confirm')

    let changeId: string | null = null
    let productId: string

    if (options.requiresChange === false) {
      const parsed = uuid.safeParse(form.get('product_id'))
      if (!parsed.success) return issue('That row could not be identified.', 'required')
      productId = parsed.data
      const maybeChange = form.get('change_id')
      if (typeof maybeChange === 'string' && uuid.safeParse(maybeChange).success) {
        changeId = maybeChange
      }
    } else {
      const target = await resolveTarget(form)
      if (!target.ok) return target.state
      changeId = target.changeId
      productId = target.productId
    }

    const rawReason = form.get('reason')
    const reason =
      typeof rawReason === 'string' && rawReason.trim() !== '' ? rawReason.trim() : null

    const client = await createClient()
    const admin = createAdminClient()

    await run({
      client,
      admin,
      actor: { userId: session.userId, role: session.role },
      changeId,
      productId,
      reason,
    })

    refresh()
    return ok()
  } catch (error) {
    if (error instanceof ReviewActionError) return issue(error.message, 'invalid')
    throw error
  }
}

export async function reviewChangeAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  return runAction(
    form,
    async (context) =>
      void (await reviewChange(context.client, context.admin, {
        productId: context.productId,
        changeId: context.changeId,
        reason: context.reason,
        actor: context.actor,
      })),
  )
}

export async function ignoreChangeAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  return runAction(
    form,
    async (context) =>
      void (await ignoreChange(context.client, context.admin, {
        productId: context.productId,
        changeId: context.changeId,
        reason: context.reason,
        actor: context.actor,
      })),
  )
}

export async function shortlistAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  return runAction(
    form,
    async (context) =>
      void (await shortlistProduct(context.client, context.admin, {
        productId: context.productId,
        changeId: context.changeId,
        reason: context.reason,
        actor: context.actor,
      })),
    { requiresChange: false },
  )
}

export async function rejectAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  return runAction(
    form,
    async (context) =>
      void (await rejectProduct(context.client, context.admin, {
        productId: context.productId,
        changeId: context.changeId,
        reason: context.reason,
        actor: context.actor,
      })),
    { requiresChange: false },
  )
}

export async function markDuplicateAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  const surviving = uuid.safeParse(form.get('surviving_product_id'))
  if (!surviving.success) {
    return issue('Choose the row that survives before marking a duplicate.', 'required')
  }
  return runAction(
    form,
    async (context) =>
      void (await markDuplicate(context.client, context.admin, {
        productId: context.productId,
        changeId: context.changeId,
        reason: context.reason,
        actor: context.actor,
        survivingProductId: surviving.data,
      })),
    { requiresChange: false },
  )
}

/**
 * Confirm.
 *
 * THE DIALOG'S COPY IS SEEDED AND SAYS WHAT THIS DOES NOT DO. That is the fourth of the never-
 * auto-import guarantees, and it is the one aimed at people rather than at code: a screen full of
 * "confirmed" competitor rows is read, six months later, as a catalogue somebody approved.
 */
export async function confirmAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  return runAction(
    form,
    async (context) =>
      void (await confirmProduct(context.client, context.admin, {
        productId: context.productId,
        changeId: context.changeId,
        reason: context.reason,
        actor: context.actor,
      })),
    { requiresChange: false },
  )
}

export async function addNoteAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  const body = String(form.get('body') ?? '').trim()
  if (body === '') return issue('A note needs something in it.', 'required')

  const supersedes = form.get('supersedes_note_id')
  const supersedesId =
    typeof supersedes === 'string' && uuid.safeParse(supersedes).success ? supersedes : undefined

  return runAction(
    form,
    async (context) =>
      void (await addProductNote(context.client, context.admin, {
        productId: context.productId,
        changeId: context.changeId,
        reason: null,
        actor: context.actor,
        body,
        ...(supersedesId === undefined ? {} : { supersedesNoteId: supersedesId }),
      })),
    { requiresChange: false },
  )
}

export async function tagAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  const tagId = uuid.safeParse(form.get('tag_id'))
  if (!tagId.success) return issue('Choose a tag from the list.', 'required')
  const remove = String(form.get('remove') ?? '') === 'true'

  return runAction(
    form,
    async (context) =>
      void (await tagProduct(context.client, context.admin, {
        productId: context.productId,
        changeId: context.changeId,
        reason: null,
        actor: context.actor,
        tagId: tagId.data,
        remove,
      })),
    { requiresChange: false },
  )
}

/**
 * Compare.
 *
 * **RECORDS AN ACTIVITY EVENT AND NOTHING ELSE.** No stage, no disposition, no decision stamp, no
 * change to any row being compared. Comparison is how somebody makes up their mind, and a tool
 * that recorded a verdict for looking would make people avoid looking.
 */
export async function compareAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  const others = form
    .getAll('against')
    .map((value) => String(value))
    .filter((value) => uuid.safeParse(value).success)

  return runAction(
    form,
    async (context) =>
      void (await recordComparison(context.client, context.admin, {
        productId: context.productId,
        changeId: context.changeId,
        reason: null,
        actor: context.actor,
        againstProductIds: others,
      })),
    { requiresChange: false, permission: 'research.read' },
  )
}

/**
 * Undo a decision.
 *
 * THE REVERSAL IS A NEW ROW AND THE QUEUE'S STAMP IS RECOMPUTED FROM THE LOG. Undoing a shortlist
 * does not always return a change to undecided — somebody may have reviewed it first — so the
 * stamp is read back rather than cleared.
 */
export async function undoActionAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  const actionId = uuid.safeParse(form.get('action_id'))
  if (!actionId.success) return issue('That action could not be identified.', 'required')

  return runAction(
    form,
    async (context) => {
      await undoAction(context.client, context.admin, {
        actionId: actionId.data,
        productId: context.productId,
        changeId: context.changeId,
        reason: context.reason,
        actor: context.actor,
      })
    },
    { requiresChange: false },
  )
}
