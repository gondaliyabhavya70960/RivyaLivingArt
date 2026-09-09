'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { type StudioFormState } from '@/components/studio/form-state'
import { withAudit } from '@/lib/auth/audit'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import { insertForm } from '@/lib/supabase/repositories/customization-forms'
import { createClient } from '@/lib/supabase/server'

/**
 * The form list's one action: bring a new form into existence.
 *
 * A NEW FORM IS A NAME, AN ADDRESS AND A KIND. Nothing else, and in particular no status: a form
 * arrives DRAFT because it has no steps yet, and a form with no steps has no contact step, which is
 * the one thing `enforce_form_publishable()` refuses outright. Offering a status field here would
 * be offering a choice the database will not honour.
 *
 * THE KIND IS SET AT CREATION AND EDITABLE AFTERWARDS. It decides which templates a category
 * inherits and which form `/custom-commissions` reaches for by default, so it is a real decision
 * rather than a label — but it is one made about a form that already exists, so the editor screen
 * owns it too.
 */

export type FormActionState = StudioFormState

const issue = (message: string, code: string, field = '_form'): FormActionState => ({
  status: 'error',
  issues: [{ field, code, message }],
})

function refusalMessage(error: unknown): string {
  if (error instanceof AuthenticationError) return 'Your session has expired. Sign in again.'
  if (error instanceof AuthorizationError) return 'You do not have permission to do that.'
  return 'That change could not be saved.'
}

function text(form: FormData, name: string): string | null {
  const value = form.get(name)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

const LIST = '/studio/catalog/customization-forms'

/** The same shape the rest of the site uses: lower case, digits and single hyphens. */
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

/** The four `form_kind` values, checked here so a hand-made payload cannot carry a fifth. */
const kindSchema = z.enum(['FURNITURE', 'PRESERVATION', 'THREE_D_RESIN', 'CUSTOM'])

export async function createFormAction(
  _previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  try {
    const session = await requirePermission('catalog.write')

    const name = text(form, 'name')
    if (name === null) return issue('A form needs a name.', 'name_required', 'name')

    // Lowercased before validation because `customization_forms.slug` is `citext`: a capital would
    // be accepted by the column and then read back differently from what was typed.
    const slug = (text(form, 'slug') ?? '').toLowerCase()
    if (!slugSchema.safeParse(slug).success) {
      return issue(
        'An address is lower-case letters, digits and single hyphens — "bespoke-furniture".',
        'slug_shape',
        'slug',
      )
    }

    const kind = kindSchema.safeParse(text(form, 'kind') ?? 'CUSTOM')
    if (!kind.success) return issue('That is not a kind of form.', 'kind_unknown', 'kind')

    const client = await createClient()
    await withAudit(
      {
        action: 'catalog.form.create',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'customization_forms',
        summary: `Created customization form ${name}`,
      },
      async () =>
        insertForm(client, {
          slug,
          name,
          kind: kind.data,
          description: text(form, 'description'),
          updated_by: session.userId,
        }),
    )

    revalidatePath(LIST)
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error), 'refused')
  }
}
