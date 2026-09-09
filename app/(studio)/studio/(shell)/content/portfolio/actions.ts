'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { withAudit } from '@/lib/auth/audit'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import { type StudioFormState } from '@/components/studio/form-state'
import { insertProject } from '@/lib/supabase/repositories/portfolio'
import { createClient } from '@/lib/supabase/server'

/**
 * Creating a project.
 *
 * IT MAKES A DRAFT NOBODY HAS CONFIRMED, AND IT CANNOT MAKE ANYTHING ELSE. The two columns that
 * decide whether a project may be published — `owner_verification` and `client_consent` — are not
 * accepted here at all, so the row takes the table's defaults: OWNER_VERIFICATION_REQUIRED and
 * NOT_APPLICABLE. Confirming that a project happened, and recording that a client agreed to be
 * named, are separate acts on the editor screen with a separate permission behind them. A create
 * form that accepted either would let a project arrive already verified by whoever typed it.
 *
 * ONLY A SLUG AND A TITLE, for the same reason. Everything else — the location, the completion date,
 * the evidence — is a business fact the owner supplies, and a wide create form invites a half-filled
 * row entered from memory. Two fields, then the editor, where each field sits beside the sentence
 * explaining what it is for.
 */

/**
 * The shared Studio form contract. NOTE THAT IT CARRIES NO NEW PROJECT'S ID, deliberately: an earlier
 * draft returned one so the form could jump straight into the editor, and that made this action's
 * state wider than every other Studio action's — which `ActionForm` then could not accept, because
 * an action's state parameter is contravariant. The list revalidates and the new project is on it,
 * linked; one click is a fair price for one form component instead of two.
 */
export type NewProjectState = StudioFormState

const issue = (message: string, code: string, field = '_form'): NewProjectState => ({
  status: 'error',
  issues: [{ field, code, message }],
})

function refusalMessage(error: unknown): string {
  if (error instanceof AuthenticationError) return 'Your session has expired. Sign in again.'
  if (error instanceof AuthorizationError) return 'You do not have permission to do that.'
  return 'That project could not be created.'
}

function text(form: FormData, name: string): string | null {
  const value = form.get(name)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** The same shape the catalogue uses, and the shape `pages_path_shape` will accept once this
 *  project has a story page: lower case, digits and single hyphens. */
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export async function createProjectAction(
  _previous: NewProjectState,
  form: FormData,
): Promise<NewProjectState> {
  try {
    const session = await requirePermission('content.write')

    const title = text(form, 'title')
    if (title === null) return issue('A project needs a title.', 'title_required', 'title')

    // Lowercased before validation rather than after: the column is `citext`, so `Mehta-Residence`
    // and `mehta-residence` are already the same slug to the database, and `pages_path_shape`
    // refuses an upper-case character in the path derived from it.
    const slug = (text(form, 'slug') ?? '').toLowerCase()
    if (!slugSchema.safeParse(slug).success) {
      return issue(
        'An address is lower-case letters, digits and single hyphens — "mehta-residence".',
        'slug_shape',
        'slug',
      )
    }

    const client = await createClient()
    await withAudit(
      {
        action: 'content.page.create',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'portfolio_projects',
        summary: `Created portfolio project ${title}`,
      },
      async () => insertProject(client, { slug, title, createdBy: session.userId }),
    )

    revalidatePath('/studio/content/portfolio')
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error), 'refused')
  }
}
