'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import type { StudioFormState } from '@/components/studio/form-state'
import { requirePermission } from '@/lib/auth/require'
import { applyBulkOperation, previewBulkOperation } from '@/lib/bulk/run'
import { undoBulkOperation } from '@/lib/bulk/undo'
import { PermissionError, ValidationError } from '@/lib/supabase/errors'

/**
 * The bulk surface's Server Actions: preview, apply, undo.
 *
 * `'use server'` PUBLISHES EVERY EXPORT AS AN HTTP ENDPOINT, so `requirePermission('bulk.execute')`
 * is the first statement of each — and the engine checks the role AGAIN immediately before the
 * first write, including `destructive.execute`. That is not redundancy: this check decides whether
 * the request may proceed at all, and the engine's decides whether THIS OPERATION, whose
 * destructiveness is only known once its params are parsed, may proceed for THIS actor.
 *
 * NOTHING HERE THROWS. A thrown Server Action renders the error boundary and discards whatever the
 * operator had selected — which on this surface could be five hundred rows of work.
 */

function issue(message: string, code: string): StudioFormState {
  return { status: 'error', issues: [{ field: '_form', code, message }] }
}

function refusal(error: unknown): StudioFormState {
  if (error instanceof ValidationError) {
    return {
      status: 'error',
      issues: error.issues.map((i) => ({ field: i.path, code: 'invalid', message: i.message })),
    }
  }
  if (error instanceof PermissionError) {
    return issue('You cannot run that operation.', 'forbidden')
  }
  return issue('That operation was refused. Nothing was changed.', 'refused')
}

function ids(form: FormData): string[] {
  return form
    .getAll('selection')
    .flatMap((value) => (typeof value === 'string' ? value.split(',') : []))
    .map((value) => value.trim())
    .filter((value) => value !== '')
}

function params(form: FormData): unknown {
  const raw = form.get('params')
  if (typeof raw !== 'string' || raw.trim() === '') return {}
  try {
    return JSON.parse(raw)
  } catch {
    // Malformed params are the same as absent, and the Zod schema will refuse them with a message
    // naming the field rather than "invalid JSON", which tells an operator nothing.
    return {}
  }
}

export async function previewBulkAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('bulk.execute')
    const kind = form.get('kind')
    if (typeof kind !== 'string' || kind === '') return issue('Choose an action.', 'kind_missing')

    const preview = await previewBulkOperation({
      kind,
      selection: ids(form),
      params: params(form),
      actor: { userId: session.userId, role: session.role },
    })

    revalidatePath('/studio/catalog/bulk')

    /*
     * REDIRECT TO THE PREVIEW, CARRYING ONLY ITS ID — NOT ITS TOKEN.
     *
     * The token is read server-side from the row when the page renders Apply, so it never enters
     * the URL, the browser history or a shared link. What the URL carries is an id the operator
     * already has access to, which makes a preview something they can leave and come back to.
     *
     * `redirect` throws by design in Next, so it is the last statement and is outside the try's
     * catch below — see the re-throw there.
     */
    redirect(`/studio/catalog/bulk?operation=${preview.operationId}`)
  } catch (error) {
    // A `redirect` is implemented as a thrown control-flow signal. Swallowing it here would turn a
    // successful preview into "that operation was refused", which is the opposite of what happened.
    if (isRedirectError(error)) throw error
    return refusal(error)
  }
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

export async function applyBulkAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('bulk.execute')
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

    revalidatePath('/studio/catalog/bulk')
    revalidatePath('/studio/operations/audit')
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}

export async function undoBulkAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('bulk.execute')
    const operationId = form.get('operation_id')
    if (typeof operationId !== 'string') {
      return issue('That operation could not be found.', 'operation_missing')
    }

    await undoBulkOperation({
      operationId,
      actor: { userId: session.userId, role: session.role },
    })

    revalidatePath('/studio/catalog/bulk')
    revalidatePath('/studio/operations/audit')
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}
