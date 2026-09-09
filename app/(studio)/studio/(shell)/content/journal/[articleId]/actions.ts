'use server'

import { revalidatePath } from 'next/cache'

import { type StudioFormState } from '@/components/studio/form-state'
import { articleBodySections } from '@/content/templates/article-body'
import { withAudit, writeAudit } from '@/lib/auth/audit'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import { insertEntityPage, insertSection } from '@/lib/supabase/repositories/cms'
import {
  RELATION_ENTITIES,
  RELATION_KINDS,
  getRelations,
  setRelations,
  type RelationEntity,
  type RelationKind,
} from '@/lib/supabase/repositories/entity-relations'
import {
  getArticleByIdForStudio,
  linkArticlePage,
  updateArticleRow,
} from '@/lib/supabase/repositories/journal'
import { createClient } from '@/lib/supabase/server'

/**
 * The article editor's Server Actions.
 *
 * `'use server'` PUBLISHES EVERY EXPORT AS AN HTTP ENDPOINT, reachable with a session cookie and no
 * page body at all, so `requirePermission` inside each one is the only check that runs.
 *
 * THE BYLINE AND THE VERIFICATION ARE SEPARATE ACTIONS, for the same reason a project's consent is
 * separate from its identity. Typing a person's name into `byline` is a claim that a real
 * individual wrote this — a fact about who works at Rivya — and confirming it is an owner's act.
 * Keeping them in one form would mean a hidden input could carry a confirmation alongside a typo
 * correction.
 *
 * `reading_minutes` IS NEVER SENT. A trigger derives it from the article's own blocks on every
 * write and overwrites whatever arrives, so an action that sent a value would be writing something
 * the database discards — which is worse than not sending it, because a reader of this file would
 * think the value came from here.
 */

export type ArticleActionState = StudioFormState

const issue = (message: string, code = 'refused', field = '_form'): ArticleActionState => ({
  status: 'error',
  issues: [{ field, code, message }],
})

function refusalMessage(error: unknown): string {
  if (error instanceof AuthenticationError) return 'Your session has expired. Sign in again.'
  if (error instanceof AuthorizationError) return 'You do not have permission to do that.'
  // A trigger message names internal identifiers, so it is not shown verbatim. The refusals an
  // editor can act on are worded explicitly wherever they are foreseeable.
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

const editorPath = (id: string) => `/studio/content/journal/${id}`

/** Edges out of an ARTICLE. A compile-time constant — see the project editor for the bug that made
 *  taking this from the form, or borrowing another editor's action, a mistake worth naming. */
const SOURCE = 'JOURNAL_ARTICLE' as const

/** Identity: what the article is. Never touches the byline, the status or the cover. */
export async function saveArticleIdentityAction(
  _previous: ArticleActionState,
  form: FormData,
): Promise<ArticleActionState> {
  try {
    const session = await requirePermission('content.write')
    const id = uuid(form, 'id')
    if (id === null) return issue('That article could not be identified.', 'id_missing')

    const title = text(form, 'title')
    if (title === null) return issue('An article needs a title.', 'title_required', 'title')

    const client = await createClient()
    await withAudit(
      {
        action: 'content.article.update',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'journal_articles',
        entityId: id,
      },
      async () =>
        updateArticleRow(client, id, {
          title,
          standfirst: text(form, 'standfirst'),
          excerpt: text(form, 'excerpt'),
          // The brief, not the summary. Never rendered publicly.
          angle_note: text(form, 'angle_note'),
          primary_category_id: uuid(form, 'primary_category_id'),
          updated_by: session.userId,
        }),
    )

    revalidatePath(editorPath(id))
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error))
  }
}

/**
 * The byline.
 *
 * SETTING IT BACK TO THE STUDIO ALSO CLEARS THE VERIFICATION REQUIREMENT, and setting it to
 * anything else raises one. That coupling is the whole point of the action: an editor may type a
 * name, and the article stops being publishable until an owner confirms that the person wrote it.
 * Doing it here rather than in a trigger keeps the rule where an editor can read it — and the
 * `verified_before_publish` constraint is what actually enforces the consequence.
 *
 * AN EMPTY FIELD MEANS THE STUDIO, not an empty byline. `journal_articles_byline_present` refuses a
 * blank one, and an article with no author at all is not a thing this site publishes.
 */
export async function saveArticleBylineAction(
  _previous: ArticleActionState,
  form: FormData,
): Promise<ArticleActionState> {
  try {
    const session = await requirePermission('content.write')
    const id = uuid(form, 'id')
    if (id === null) return issue('That article could not be identified.', 'id_missing')

    const organisation = text(form, 'organisation_name')
    if (organisation === null) {
      return issue('The studio’s own name is not configured, so a byline cannot be compared to it.')
    }

    const byline = text(form, 'byline') ?? organisation
    const namesAPerson = byline.toLowerCase() !== organisation.toLowerCase()

    const client = await createClient()
    const before = await getArticleByIdForStudio(client, id)

    await withAudit(
      {
        action: 'content.article.byline',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'journal_articles',
        entityId: id,
        summary: namesAPerson ? 'Byline names a person' : 'Byline set to the studio',
      },
      async () =>
        updateArticleRow(client, id, {
          byline,
          /*
           * A NAME RAISES THE REQUIREMENT; REMOVING IT LOWERS THE REQUIREMENT AND NOT A CONFIRMATION
           * SOMEBODY GAVE. If the article was already VERIFIED for some other reason — article 04's
           * capability claims, article 08's preservation language — that stands: only the
           * requirement this action raised is withdrawn.
           */
          ...(namesAPerson
            ? before.owner_verification === 'NOT_REQUIRED'
              ? { owner_verification: 'OWNER_VERIFICATION_REQUIRED' as const }
              : {}
            : before.owner_verification === 'OWNER_VERIFICATION_REQUIRED'
              ? { owner_verification: 'NOT_REQUIRED' as const }
              : {}),
          updated_by: session.userId,
        }),
    )

    revalidatePath(editorPath(id))
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error))
  }
}

/** The two cover slots. Desktop and mobile are separate pictures (D6), never one cropped. */
export async function saveArticleCoverAction(
  _previous: ArticleActionState,
  form: FormData,
): Promise<ArticleActionState> {
  try {
    const session = await requirePermission('content.write')
    const id = uuid(form, 'id')
    if (id === null) return issue('That article could not be identified.', 'id_missing')

    const client = await createClient()
    await withAudit(
      {
        action: 'content.article.cover',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'journal_articles',
        entityId: id,
      },
      async () =>
        updateArticleRow(client, id, {
          cover_media_id: uuid(form, 'cover_media_id'),
          cover_mobile_media_id: uuid(form, 'cover_mobile_media_id'),
          updated_by: session.userId,
        }),
    )

    revalidatePath(editorPath(id))
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error))
  }
}

/** The owner's confirmation. `content.verify` — owner and admin only. */
export async function setArticleVerificationAction(
  _previous: ArticleActionState,
  form: FormData,
): Promise<ArticleActionState> {
  try {
    const session = await requirePermission('content.verify')
    const id = uuid(form, 'id')
    if (id === null) return issue('That article could not be identified.', 'id_missing')

    const target = text(form, 'owner_verification')
    if (target !== 'VERIFIED' && target !== 'OWNER_VERIFICATION_REQUIRED') {
      return issue('That is not a verification state.', 'verification_unknown')
    }

    const client = await createClient()
    await withAudit(
      {
        action: 'content.article.verify',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'journal_articles',
        entityId: id,
        summary: `Verification set to ${target}`,
      },
      async () =>
        updateArticleRow(client, id, { owner_verification: target, updated_by: session.userId }),
    )

    revalidatePath(editorPath(id))
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error))
  }
}

/**
 * Create the article's body page and link it.
 *
 * ONE BAND, NOT FOUR. `content/templates/article-body.ts` records why at length: a project page has
 * a known shape and an article does not, so the template gives somewhere to write and no opinion
 * about what goes around it.
 *
 * WITHOUT A PAGE THE ARTICLE CANNOT PUBLISH AT ALL: `enforce_article_has_body` refuses it, naming
 * the article. So this is not an optional convenience; it is the first step of writing.
 */
export async function createArticlePageAction(
  _previous: ArticleActionState,
  form: FormData,
): Promise<ArticleActionState> {
  try {
    const session = await requirePermission('content.write')
    const id = uuid(form, 'id')
    if (id === null) return issue('That article could not be identified.', 'id_missing')

    const client = await createClient()
    const article = await getArticleByIdForStudio(client, id)
    if (article.page_id !== null) return issue('This article already has a page.', 'page_exists')

    const slug = article.slug.toLowerCase()
    const opening = articleBodySections()

    await withAudit(
      {
        action: 'content.page.create',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'pages',
        entityId: id,
      },
      async () => {
        const page = await insertEntityPage(client, {
          slug: `journal-${slug}`,
          path: `/journal/${slug}`,
          title: article.title,
          kind: 'ARTICLE',
        })
        await linkArticlePage(client, id, page.id)

        for (const band of opening) {
          await insertSection(client, page.id, band.blockType, {
            payload: band.payload as Parameters<typeof insertSection>[3]['payload'],
            updated_by: session.userId,
          })
        }
        return page
      },
    )

    revalidatePath(editorPath(id))
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error))
  }
}

/**
 * Publish, or refuse and say why.
 *
 * THE THREE REFUSALS AN EDITOR CAN MEET ARE WORDED HERE. The database enforces all of them —
 * `enforce_article_has_body`, `journal_articles_verified_before_publish` and
 * `journal_articles_published_dated` — but a raised exception naming a constraint teaches nobody
 * anything. Recomputing them from the SAVED row means the sentence and the refusal cannot disagree.
 *
 * A DATE IN THE FUTURE IS A SCHEDULE, NOT AN ERROR. The RLS policy gates the public read on
 * `published_at <= now()`, so a published article with tomorrow's date is invisible until tomorrow
 * — which is the whole scheduling mechanism, and the reason this action accepts a date at all.
 */
export async function publishArticleAction(
  _previous: ArticleActionState,
  form: FormData,
): Promise<ArticleActionState> {
  try {
    const session = await requirePermission('content.publish')
    const id = uuid(form, 'id')
    if (id === null) return issue('That article could not be identified.', 'id_missing')

    const client = await createClient()
    const article = await getArticleByIdForStudio(client, id)

    const blockers: { code: string; message: string }[] = []
    if (article.page_id === null) {
      blockers.push({
        code: 'no_page',
        message: 'This article has no page yet. Create one and write something in it.',
      })
    }
    if (article.owner_verification === 'OWNER_VERIFICATION_REQUIRED') {
      blockers.push({
        code: 'unverified',
        message: 'An owner or administrator has not confirmed what this article claims.',
      })
    }

    if (blockers.length > 0) {
      await writeAudit({
        action: 'content.article.publish',
        result: 'DENIED',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'journal_articles',
        entityId: id,
        summary: `Publication refused: ${blockers.map((b) => b.code).join(', ')}`,
      })
      return {
        status: 'error',
        issues: blockers.map((blocker) => ({ field: 'publish', ...blocker })),
      }
    }

    // An empty date means "now". The column is NOT NULL for a published row
    // (`journal_articles_published_dated`), so something has to fill it, and the honest default for
    // a publish somebody just pressed is the moment they pressed it.
    const requested = text(form, 'published_at')
    const when = requested === null ? new Date().toISOString() : new Date(requested).toISOString()

    await withAudit(
      {
        action: 'content.article.publish',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'journal_articles',
        entityId: id,
        summary: `Published article ${article.slug}`,
      },
      async () =>
        updateArticleRow(client, id, {
          status: 'PUBLISHED',
          published_at: when,
          published_by: session.userId,
          updated_by: session.userId,
        }),
    )

    revalidatePath(editorPath(id))
    revalidatePath('/journal')
    return { status: 'saved' }
  } catch (error) {
    // The body gate is the one refusal a caller can trip after the checks above — an editor who
    // deleted the last block in another tab. Worth its own sentence rather than the generic one.
    if (error instanceof Error && /empty body/.test((error.cause as Error)?.message ?? '')) {
      return issue('There is nothing written in this article yet.', 'empty_body', 'publish')
    }
    return issue(refusalMessage(error))
  }
}

/** Take the article off the site. No gate: an unpublish is always safe and never argues. */
export async function unpublishArticleAction(
  _previous: ArticleActionState,
  form: FormData,
): Promise<ArticleActionState> {
  try {
    const session = await requirePermission('content.publish')
    const id = uuid(form, 'id')
    if (id === null) return issue('That article could not be identified.', 'id_missing')

    const client = await createClient()
    await withAudit(
      {
        action: 'content.article.unpublish',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'journal_articles',
        entityId: id,
      },
      async () =>
        updateArticleRow(client, id, {
          status: 'DRAFT',
          published_at: null,
          published_by: null,
          updated_by: session.userId,
        }),
    )

    revalidatePath(editorPath(id))
    revalidatePath('/journal')
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error))
  }
}

/** Add or remove one hand-made edge out of this article. Source type is a constant, never a field. */
export async function setArticleRelationAction(
  _previous: ArticleActionState,
  form: FormData,
): Promise<ArticleActionState> {
  try {
    const session = await requirePermission('content.write')
    const id = uuid(form, 'id')
    if (id === null) return issue('That article could not be identified.', 'id_missing')

    const targetId = uuid(form, 'target_id')
    const targetType = text(form, 'target_type')
    const relationType = text(form, 'relation_type')
    const remove = text(form, 'intent') === 'remove'

    if (targetId === null) return issue('Paste the id of the thing to link to.', 'target_shape')
    if (targetType === null || !RELATION_ENTITIES.includes(targetType as RelationEntity)) {
      return issue('Choose what kind of thing this links to.', 'target_type_unknown')
    }
    if (relationType === null || !RELATION_KINDS.includes(relationType as RelationKind)) {
      return issue('Choose a kind of relationship.', 'relation_type_unknown')
    }

    const client = await createClient()
    const current = await getRelations(client, SOURCE, id)
    const matches = (edge: (typeof current)[number]) =>
      edge.target_type === targetType &&
      edge.target_id === targetId &&
      edge.relation_type === relationType

    if (remove) {
      if (!current.some(matches)) return { status: 'saved' }
    } else if (current.some(matches)) {
      return issue('That link already exists.', 'relation_duplicate')
    }

    const kept = current
      .filter((edge) => !remove || !matches(edge))
      .map((edge) => ({
        sourceType: SOURCE,
        sourceId: id,
        targetType: edge.target_type,
        targetId: edge.target_id,
        relationType: edge.relation_type,
        note: edge.note,
        sortOrder: edge.sort_order,
      }))

    const next = remove
      ? kept
      : [
          ...kept,
          {
            sourceType: SOURCE,
            sourceId: id,
            targetType: targetType as RelationEntity,
            targetId,
            relationType: relationType as RelationKind,
            note: text(form, 'note'),
            sortOrder: kept.length,
          },
        ]

    await withAudit(
      {
        action: 'content.article.relation',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'entity_relations',
        entityId: id,
      },
      async () =>
        setRelations(
          client,
          SOURCE,
          id,
          next.map((edge, position) => ({ ...edge, sortOrder: position })),
          session.userId,
        ),
    )

    revalidatePath(editorPath(id))
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error))
  }
}
