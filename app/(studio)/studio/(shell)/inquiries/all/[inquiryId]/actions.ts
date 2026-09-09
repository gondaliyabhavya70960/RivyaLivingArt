'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { type StudioFormState } from '@/components/studio/form-state'
import { withAudit } from '@/lib/auth/audit'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import { PermissionError } from '@/lib/supabase/errors'
import {
  appendInquiryEvent,
  assignInquiry,
  setInquiryStatus,
} from '@/lib/supabase/repositories/inquiries'
import { createClient } from '@/lib/supabase/server'

/**
 * The enquiry inbox's Server Actions.
 *
 * `'use server'` PUBLISHES EVERY EXPORT AS AN HTTP ENDPOINT, so `requirePermission('inquiries.write')`
 * inside each one is the only check that runs for a request that never touched the page. Every
 * write also goes through a repository that reads its row back, because RLS FILTERS an update
 * rather than refusing one — and a status that appears to move and does not is worse than one that
 * refuses.
 *
 * THE TIMELINE IS NOT WRITTEN HERE FOR A STATUS CHANGE OR AN ASSIGNMENT. Triggers on `inquiries`
 * write `STATUS_CHANGED` and `ASSIGNED` from the row itself, so a change made through PostgREST is
 * recorded as surely as one made through this screen. Only a NOTE is appended by hand, because a
 * note has no row to derive itself from.
 *
 * NOTHING HERE DELETES AN ENQUIRY. `SPAM` and `ARCHIVED` are pipeline statuses precisely so that a
 * judgement can be reversed; "we never received it" is the worst answer a studio can give somebody
 * who did send one.
 */

export type InquiryActionState = StudioFormState

const issue = (message: string, code: string, field = '_form'): InquiryActionState => ({
  status: 'error',
  issues: [{ field, code, message }],
})

function refusalMessage(error: unknown): string {
  if (error instanceof AuthenticationError) return 'Your session has expired. Sign in again.'
  if (error instanceof AuthorizationError) return 'You do not have permission to do that.'
  if (error instanceof PermissionError) return 'You do not have permission to do that.'
  return 'That change could not be saved.'
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function uuid(form: FormData, name: string): string | null {
  const value = form.get(name)
  if (typeof value !== 'string' || !UUID.test(value.trim())) return null
  return value.trim()
}

const statusSchema = z.enum([
  'NEW',
  'READ',
  'IN_CONVERSATION',
  'QUOTED',
  'WON',
  'LOST',
  'SPAM',
  'ARCHIVED',
])

const detailPath = (id: string) => `/studio/inquiries/all/${id}`

export async function setInquiryStatusAction(
  _previous: InquiryActionState,
  form: FormData,
): Promise<InquiryActionState> {
  try {
    const session = await requirePermission('inquiries.write')
    const id = uuid(form, 'id')
    if (id === null) return issue('That enquiry could not be identified.', 'id_missing')

    const status = statusSchema.safeParse(form.get('pipeline_status'))
    if (!status.success) return issue('That is not a status.', 'status_unknown', 'pipeline_status')

    const client = await createClient()
    await withAudit(
      {
        action: 'inquiries.status',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'inquiries',
        entityId: id,
        summary: `Moved to ${status.data}`,
      },
      async () => setInquiryStatus(client, id, status.data, session.userId),
    )

    revalidatePath(detailPath(id))
    revalidatePath('/studio/inquiries/all')
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error), 'refused')
  }
}

/** Assign, or unassign by choosing nobody. Both are the same decision with opposite signs. */
export async function assignInquiryAction(
  _previous: InquiryActionState,
  form: FormData,
): Promise<InquiryActionState> {
  try {
    const session = await requirePermission('inquiries.write')
    const id = uuid(form, 'id')
    if (id === null) return issue('That enquiry could not be identified.', 'id_missing')

    const client = await createClient()
    const assignee = uuid(form, 'assigned_to')
    await withAudit(
      {
        action: 'inquiries.assign',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'inquiries',
        entityId: id,
      },
      async () => assignInquiry(client, id, assignee, session.userId),
    )

    revalidatePath(detailPath(id))
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error), 'refused')
  }
}

/**
 * Append a note.
 *
 * IT CANNOT BE EDITED AFTERWARDS, and the screen says so. `inquiry_events` refuses UPDATE and
 * DELETE by trigger for every role including the owner's, so a mistaken note is corrected by adding
 * another — which is the behaviour a record of what happened has to have to be worth reading.
 */
export async function addInquiryNoteAction(
  _previous: InquiryActionState,
  form: FormData,
): Promise<InquiryActionState> {
  try {
    const session = await requirePermission('inquiries.write')
    const id = uuid(form, 'id')
    if (id === null) return issue('That enquiry could not be identified.', 'id_missing')

    const raw = form.get('note')
    const note = typeof raw === 'string' ? raw.trim() : ''
    if (note === '') return issue('A note needs something in it.', 'note_empty', 'note')

    const client = await createClient()
    await withAudit(
      {
        action: 'inquiries.note',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'inquiries',
        entityId: id,
      },
      async () => appendInquiryEvent(client, id, 'NOTE_ADDED', session.userId, note),
    )

    revalidatePath(detailPath(id))
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error), 'refused')
  }
}
