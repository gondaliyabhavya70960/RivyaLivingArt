'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import type { StudioFormState } from '@/components/studio/form-state'
import { requirePermission } from '@/lib/auth/require'
import {
  RESEARCH_BULK_CAP,
  researchBulkParams,
  researchBulkQuery,
  researchBulkSurface,
  type ResearchBulkSurface,
} from '@/lib/bulk/research-surface'
import { applyBulkOperation, previewBulkOperation } from '@/lib/bulk/run'
import { PermissionError, ValidationError } from '@/lib/supabase/errors'

/**
 * Select → preview → confirm → apply, for the two research surfaces that carry a selection.
 *
 * **ONE MODULE FOR BOTH SCREENS, AND NO SECOND BULK ENGINE.** Phase 24 predicted exactly what
 * happens when a screen arrives with rows to act on and no toolbar to act with: it writes its own
 * selection handling, its own preview, its own confirmation and its own undo — and the second
 * implementation is always the one without the typed count. Nothing here implements any of that.
 * These three functions parse a form, call `previewBulkOperation` / `applyBulkOperation`, and
 * render what those return. The preview, the snapshot, the typed-count refusal and the 24-hour
 * undo are the engine's, unchanged.
 *
 * `bulk.execute` IS CHECKED HERE AND `research.confirm` IS CHECKED BY THE ENGINE. All five research
 * operations declare `extraPermission: 'research.confirm'`, so a researcher who holds
 * `bulk.execute` and operates the pipeline is refused these exactly as `assertMayMoveStage` refuses
 * them one row at a time. Checking the second permission here as well would read as the thing
 * carrying the rule, and a later reader might reasonably relax the declaration.
 *
 * THE THREE DECISIONS WORTH TESTING LIVE IN `lib/bulk/research-surface.ts` — which screen may be
 * redirected to, which query keys survive a round trip, and which parameter each operation
 * collects. A `'use server'` module can export nothing but async functions, so a helper written
 * here would be untestable; there they are ordinary functions over strings with no I/O.
 */

const issue = (message: string, code: string): StudioFormState => ({
  status: 'error',
  issues: [{ field: '_form', code, message }],
})

function refusal(error: unknown): StudioFormState {
  if (error instanceof ValidationError) {
    return {
      status: 'error',
      issues: error.issues.map((entry) => ({
        field: entry.path,
        code: 'invalid',
        message: entry.message,
      })),
    }
  }
  if (error instanceof PermissionError) return issue('You cannot run that operation.', 'forbidden')
  return issue('That operation was refused. Nothing was changed.', 'refused')
}

/** Next signals a redirect by throwing. Recognised by its digest rather than by instanceof. */
function isRedirectError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  )
}

function surfaceOf(form: FormData): ResearchBulkSurface | null {
  return researchBulkSurface(form.get('surface'))
}

function ids(form: FormData): string[] {
  return form
    .getAll('selection')
    .flatMap((value) => (typeof value === 'string' ? value.split(',') : []))
    .map((value) => value.trim())
    .filter((value) => value !== '')
}

export async function previewResearchBulkAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('bulk.execute')

    const surface = surfaceOf(form)
    if (surface === null) return issue('That screen cannot run bulk actions.', 'surface_unknown')

    const kind = String(form.get('kind') ?? '')
    if (kind === '') return issue('Choose an action.', 'kind_missing')

    const selection = ids(form)
    // Phase 35: refused above the cap, with the number in the sentence.
    if (selection.length > RESEARCH_BULK_CAP) {
      return issue(
        `A research bulk action takes at most ${String(RESEARCH_BULK_CAP)} rows at a time; ` +
          `${String(selection.length)} were selected.`,
        'over_cap',
      )
    }

    const preview = await previewBulkOperation({
      kind,
      selection,
      params: researchBulkParams(kind, (field) => String(form.get(field) ?? '').trim()),
      actor: { userId: session.userId, role: session.role },
    })

    revalidatePath(surface)

    const search = researchBulkQuery(form.get('filters'))
    search.set('operation', preview.operationId)
    // The preview id and nothing else: the confirmation token is read server-side when the page
    // renders Apply, so it never enters the URL, the history or a pasted link.
    redirect(`${surface}?${search.toString()}`)
  } catch (error) {
    if (isRedirectError(error)) throw error
    return refusal(error)
  }
}

export async function applyResearchBulkAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('bulk.execute')

    const surface = surfaceOf(form)
    if (surface === null) return issue('That screen cannot run bulk actions.', 'surface_unknown')

    const operationId = form.get('operation_id')
    const token = form.get('confirmation_token')
    if (typeof operationId !== 'string' || typeof token !== 'string') {
      return issue(
        'That preview could not be found. Preview the selection again.',
        'preview_missing',
      )
    }

    const typed = form.get('typed_count')
    await applyBulkOperation({
      operationId,
      confirmationToken: token,
      actor: { userId: session.userId, role: session.role },
      ...(typeof typed === 'string' && typed.trim() !== '' ? { typedCount: Number(typed) } : {}),
    })

    // Every research surface that reads a stage, a disposition or a decision stamp, plus the audit
    // trail the operation is now part of.
    revalidatePath(surface)
    revalidatePath('/studio/research/explorer')
    revalidatePath('/studio/research/dashboard')
    revalidatePath('/studio/research/shortlist')
    revalidatePath('/studio/research/confirmed')
    revalidatePath('/studio/operations/audit')
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}
