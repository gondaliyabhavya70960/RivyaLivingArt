'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { type StudioFormState } from '@/components/studio/form-state'
import { withAudit } from '@/lib/auth/audit'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import { insertArticle, updateCategoryRow } from '@/lib/supabase/repositories/journal'
import { createClient } from '@/lib/supabase/server'

/**
 * The journal list's actions: create an article, edit a category.
 *
 * A NEW ARTICLE IS A TITLE AND AN ADDRESS AND NOTHING ELSE. Not a status, not a byline, not a
 * category — SEED §20 forbids a machine publishing an article, and everything else is better set on
 * the editor screen where each field sits beside the sentence explaining what it is for. A wide
 * create form invites a half-filled row typed from memory.
 *
 * A CATEGORY'S SLUG IS IMMUTABLE AND THIS FILE IS WHERE THAT IS ENFORCED. `journal_categories.slug`
 * is a public URL — `/journal/category/materials` — and changing one silently breaks every link
 * anybody made to it. The database does not stop it, deliberately: a slug change is legitimate once
 * there is a redirect to go with it, and redirects are Phase 39. Until then the action refuses, and
 * the refusal says why rather than the form simply ignoring the field.
 */

export type JournalActionState = StudioFormState

const issue = (message: string, code: string, field = '_form'): JournalActionState => ({
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

function uuid(form: FormData, name: string): string | null {
  const value = text(form, name)
  if (value === null) return null
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null
}

const LIST = '/studio/content/journal'
const CATEGORIES = '/studio/content/journal/categories'

/** The same shape the rest of the site uses: lower case, digits and single hyphens. */
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export async function createArticleAction(
  _previous: JournalActionState,
  form: FormData,
): Promise<JournalActionState> {
  try {
    const session = await requirePermission('content.write')

    const title = text(form, 'title')
    if (title === null) return issue('An article needs a title.', 'title_required', 'title')

    // Lowercased before validation: the column is `citext`, and `pages_path_shape` refuses an
    // upper-case character in the path derived from it.
    const slug = (text(form, 'slug') ?? '').toLowerCase()
    if (!slugSchema.safeParse(slug).success) {
      return issue(
        'An address is lower-case letters, digits and single hyphens — "choosing-a-table".',
        'slug_shape',
        'slug',
      )
    }

    const client = await createClient()
    await withAudit(
      {
        action: 'content.article.create',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'journal_articles',
        summary: `Created journal article ${title}`,
      },
      async () =>
        insertArticle(client, {
          slug,
          title,
          primaryCategoryId: uuid(form, 'primary_category_id'),
          createdBy: session.userId,
        }),
    )

    revalidatePath(LIST)
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error), 'refused')
  }
}

export async function saveCategoryAction(
  _previous: JournalActionState,
  form: FormData,
): Promise<JournalActionState> {
  try {
    const session = await requirePermission('content.write')
    const id = uuid(form, 'id')
    if (id === null) return issue('That category could not be identified.', 'id_missing')

    const name = text(form, 'name')
    if (name === null) return issue('A category needs a name.', 'name_required', 'name')

    /*
     * THE SLUG IS COMPARED, NOT WRITTEN. The form carries it so an editor can see the address they
     * are keeping; submitting a different one is refused rather than silently discarded, because a
     * field that accepts a value and ignores it is worse than one that says no.
     */
    const submittedSlug = text(form, 'slug')
    const currentSlug = text(form, 'current_slug')
    if (
      submittedSlug !== null &&
      currentSlug !== null &&
      submittedSlug.toLowerCase() !== currentSlug.toLowerCase()
    ) {
      return issue(
        'A category address cannot change: it is a public URL somebody may have linked to. Renaming the category changes its name, not its address.',
        'slug_immutable',
        'slug',
      )
    }

    const position = Number.parseInt(text(form, 'position') ?? '', 10)
    if (text(form, 'position') !== null && Number.isNaN(position)) {
      return issue('An order position is a whole number.', 'position_shape', 'position')
    }

    const client = await createClient()
    await withAudit(
      {
        action: 'content.journal_category.update',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'journal_categories',
        entityId: id,
        summary: `Updated journal category ${name}`,
      },
      async () =>
        updateCategoryRow(client, id, {
          name,
          description: text(form, 'description'),
          intro_heading: text(form, 'intro_heading'),
          ...(Number.isNaN(position) ? {} : { position }),
          updated_by: session.userId,
        }),
    )

    revalidatePath(CATEGORIES)
    revalidatePath(LIST)
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error), 'refused')
  }
}
