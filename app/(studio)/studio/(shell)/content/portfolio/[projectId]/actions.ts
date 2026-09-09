'use server'

import { revalidatePath } from 'next/cache'

import { projectStorySections } from '@/content/templates/project-story'
import { withAudit } from '@/lib/auth/audit'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import type { StudioFormState } from '@/components/studio/form-state'
import {
  RELATION_ENTITIES,
  RELATION_KINDS,
  getRelations,
  setRelations,
  type RelationEntity,
  type RelationKind,
} from '@/lib/supabase/repositories/entity-relations'
import { insertEntityPage, insertSection } from '@/lib/supabase/repositories/cms'
import {
  PROJECT_MEDIA_ROLES,
  getProjectByIdForStudio,
  linkProjectPage,
  listProjectMedia,
  setProjectMediaEdges,
  updateProjectRow,
  type ProjectMediaEdge,
  type ProjectMediaRole,
} from '@/lib/supabase/repositories/portfolio'
import { clientConsentStateSchema } from '@/lib/supabase/schemas'
import { ValidationError } from '@/lib/supabase/errors'
import { createClient } from '@/lib/supabase/server'

/**
 * The project editor's Server Actions.
 *
 * `'use server'` PUBLISHES EVERY EXPORT AS AN HTTP ENDPOINT, reachable with a session cookie and no
 * page body at all, so `requirePermission` inside each one is the only check that runs. Every action
 * here calls it first, and reads use the same request-scoped client so RLS refuses underneath the
 * guard as well as beside it.
 *
 * THE CONSENT AND VERIFICATION ACTIONS ARE SEPARATE FROM THE IDENTITY FORM, AND THAT IS THE WHOLE
 * DESIGN. If `client_consent` were a field on the identity form, an editor could submit
 * `client_consent=GRANTED` in the same request that renames the project — and the thing standing
 * between a client's name and the public site would be one hidden input. They are separate actions
 * with separate permissions, so recording a consent is an act somebody performed rather than a
 * value that travelled.
 *
 * `content.verify` IS OWNER AND ADMIN, and it is the permission on both of them: confirming that a
 * project happened, and confirming that its client agreed to be named, are the two claims nobody
 * else may make on the business's behalf.
 */

/** The shared Studio form contract, under this editor's own name. See `components/studio/form-state.ts`. */
export type ProjectActionState = StudioFormState

const issue = (message: string, code = 'refused'): ProjectActionState => ({
  status: 'error',
  issues: [{ field: '_form', code, message }],
})

function refusalMessage(error: unknown): string {
  if (error instanceof AuthenticationError) return 'Your session has expired. Sign in again.'
  if (error instanceof AuthorizationError) return 'You do not have permission to do that.'
  // A trigger message names internal identifiers, so it is not shown verbatim. The refusals an
  // editor can act on are worded explicitly, and `OwnerVerificationPanel` names them before a
  // publish is ever attempted.
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

const editorPath = (id: string) => `/studio/content/portfolio/${id}`

/**
 * What this module's edges are edges FROM. A constant, never a form field — see
 * `setProjectRelationAction` for the bug that made the distinction concrete.
 */
const SOURCE = 'PORTFOLIO_PROJECT' as const

/**
 * Whether this refusal is `reject_concept_project_media` and not something else.
 *
 * MATCHED ON THE TRIGGER'S OWN WORDS. The trigger raises with `errcode = 'check_violation'`, so it
 * arrives as a `ValidationError` — but so does every other check constraint on the table, and
 * `raise exception` carries no constraint name for `constraintName` to have recorded. The message
 * is the only thing that distinguishes them.
 *
 * BRITTLE IN ONE DIRECTION ONLY, which is what makes it acceptable: if the trigger's wording ever
 * changes, this stops recognising it and the editor sees the ordinary refusal instead. A worse
 * message, never a wrong outcome — the write was refused either way, by the database.
 * `tests/unit/rls/phase17.test.ts` asserts the wording so the drift is caught rather than shipped.
 */
function isConceptRefusal(error: unknown): boolean {
  if (!(error instanceof ValidationError)) return false
  return error.issues.some((detail) => detail.message.includes('concept media cannot be attached'))
}

/**
 * Identity: what the project is. Never touches consent or verification.
 *
 * `completed_on` IS A DATE THE OWNER KNOWS OR LEAVES EMPTY. The phase's risk table names guessed
 * completion dates specifically, and the column is nullable so that "I do not remember" has a
 * representation other than a plausible-looking wrong answer.
 */
export async function saveProjectIdentityAction(
  _previous: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const session = await requirePermission('content.write')
    const id = uuid(form, 'id')
    if (id === null) return issue('That project could not be identified.', 'id_missing')

    const title = text(form, 'title')
    if (title === null) return issue('A project needs a title.', 'title_required')

    const client = await createClient()
    await withAudit(
      {
        action: 'content.page.update',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'portfolio_projects',
        entityId: id,
      },
      async () =>
        updateProjectRow(client, id, {
          title,
          subtitle: text(form, 'subtitle'),
          summary: text(form, 'summary'),
          project_type: text(form, 'project_type'),
          location_label: text(form, 'location_label'),
          completed_on: text(form, 'completed_on'),
          evidence_note: text(form, 'evidence_note'),
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
 * The client panel: whether this names anyone, and what they agreed to.
 *
 * SETTING CONSENT TO `GRANTED` REQUIRES `content.verify`, and the rest of the panel does not. An
 * editor may record that a project is a client project and type the name they were given; only an
 * owner or admin may assert that the person agreed to appear on the public site. The two are
 * checked separately here rather than gating the whole form, so the ordinary half stays usable.
 *
 * THE REFERENCE IS REQUIRED ALONGSIDE `GRANTED`. "Where is this recorded" is the question that makes
 * a consent auditable a year later, and a granted consent with no reference is an assertion with
 * nothing behind it.
 *
 * AN ABSENT CONSENT FIELD MEANS "UNCHANGED", NOT "NOT_APPLICABLE", and the difference matters more
 * than it looks. The phase document asks for the consent controls to be disabled until the
 * is-client-project toggle is on — but a disabled control posts NOTHING, so an editor who unticked
 * that box would submit a form with no `client_consent` in it at all. Reading that as
 * NOT_APPLICABLE would erase a recorded consent, and its date and its recorder with it, by
 * unticking a checkbox. So absence is read as "leave it alone"; the editor screen therefore does
 * not disable the controls, and this branch means it would be safe even if it did.
 */
export async function saveProjectClientAction(
  _previous: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const session = await requirePermission('content.write')
    const id = uuid(form, 'id')
    if (id === null) return issue('That project could not be identified.', 'id_missing')

    const client = await createClient()
    const before = await getProjectByIdForStudio(client, id)

    // Parsed against the schema the column is generated from, so a value this enum gains later
    // cannot be silently rejected here by a list that was copied once and never updated. An absent
    // field keeps what the row already says — see the note above about disabled controls.
    const submitted = text(form, 'client_consent')
    const parsed = clientConsentStateSchema.safeParse(submitted ?? before.client_consent)
    if (!parsed.success) return issue('That is not a consent state.', 'consent_unknown')
    const consent = parsed.data

    const isClientProject = form.get('is_client_project') === 'on'
    const name = isClientProject ? text(form, 'client_display_name') : null
    const reference = consent === 'NOT_APPLICABLE' ? null : text(form, 'client_consent_reference')

    if (consent === 'GRANTED') {
      await requirePermission('content.verify')
      if (reference === null) {
        return issue(
          'Record where the consent is held before marking it granted.',
          'consent_reference_required',
        )
      }
    }

    // The database refuses this too — `portfolio_projects_consent_coherent` — but the constraint
    // names itself rather than explaining, and an editor should not meet a constraint name.
    if (name !== null && consent === 'NOT_APPLICABLE') {
      return issue(
        'A project that names a client needs a consent state other than "not applicable".',
        'consent_incoherent',
      )
    }

    // THE STAMP RECORDS WHEN THE DECISION CHANGED, which is why the row was read above and is not
    // knowable from the form alone. Stamping on every submit would move the date each time somebody
    // corrected a spelling in the client's name; stamping only on GRANTED would leave a withdrawn
    // consent still reading "recorded by Asha on the 3rd" — the grant's date, presented as though
    // it described the withdrawal.
    const changed = before.client_consent !== consent

    await withAudit(
      {
        action: 'content.page.update',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'portfolio_projects',
        entityId: id,
      },
      async () =>
        updateProjectRow(client, id, {
          is_client_project: isClientProject,
          client_display_name: name,
          client_consent: consent,
          client_consent_reference: reference,
          // Stamped from the session, never from the form, so the record of who recorded a consent
          // cannot be written by whoever is recording it. Cleared outright when the project goes
          // back to naming nobody: there is then no decision for a timestamp to be about.
          ...(consent === 'NOT_APPLICABLE'
            ? { client_consent_recorded_at: null, client_consent_recorded_by: null }
            : changed
              ? {
                  client_consent_recorded_at: new Date().toISOString(),
                  client_consent_recorded_by: session.userId,
                }
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

/**
 * The owner's confirmation that this project happened.
 *
 * `content.verify`, OWNER AND ADMIN. This is the claim D10 is about — that Rivya delivered this —
 * and it is the gate `enforce_project_evidence_gate` checks first. Withdrawing it is the same
 * action with the other value, for the reason the collection editor gives: a toggle computed from
 * what the page was rendered with sends the wrong instruction when two people have it open.
 */
export async function setProjectVerificationAction(
  _previous: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const session = await requirePermission('content.verify')
    const id = uuid(form, 'id')
    if (id === null) return issue('That project could not be identified.', 'id_missing')

    const target = text(form, 'owner_verification')
    if (target !== 'VERIFIED' && target !== 'OWNER_VERIFICATION_REQUIRED') {
      return issue('That is not a verification state.', 'verification_unknown')
    }

    const client = await createClient()
    await withAudit(
      {
        action: 'content.page.update',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'portfolio_projects',
        entityId: id,
      },
      async () =>
        updateProjectRow(client, id, { owner_verification: target, updated_by: session.userId }),
    )

    revalidatePath(editorPath(id))
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error))
  }
}

/**
 * Add or remove one hand-made edge out of this project.
 *
 * A SECOND COPY OF THE COLLECTION ACTION, AND DELIBERATELY NOT A SHARED ONE PARAMETERISED BY SOURCE
 * TYPE. The editor first reused `setRelationAction` from the collection module, and that was a real
 * bug caught before it shipped: that action hardcodes `'COLLECTION'`, so every edge made from this
 * screen would have been stored claiming the project's id was a collection — a wrong row, written
 * silently, that reads back as a broken link months later.
 *
 * The obvious fix is to take the source type from the form. That is worse: it lets the CLIENT decide
 * what kind of thing the source is, and `entity_relations.source_id` is deliberately un-FK'd, so
 * nothing in the database would catch a mismatch. Here the source type is a compile-time constant,
 * which means this endpoint can only ever write project edges — whatever is posted to it.
 */
export async function setProjectRelationAction(
  _previous: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const session = await requirePermission('content.write')
    const id = uuid(form, 'id')
    if (id === null) return issue('That project could not be identified.', 'id_missing')

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
        action: 'content.page.update',
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

/**
 * Create the project's story page and link it.
 *
 * BOTH PERMISSIONS ARE THE SAME ONE HERE, UNLIKE THE COLLECTION VERSION. A collection's exhibition
 * page touches `pages` (content) and `collections.page_id` (catalogue), so that action asks for
 * both. A project is content on both sides, so `content.write` covers the whole operation — and
 * asking for a catalogue permission a project editor has no other use for would be theatre.
 *
 * THE PATH IS PASSED AND THEN WRITTEN AGAIN BY `sync_project_page_path`. Not redundant: the page row
 * must satisfy `pages_path_present` at insert time, before any link exists for a trigger to fire on.
 * After the link the trigger owns the value, which is what keeps the URL and the slug in step when
 * the slug is later edited.
 */
export async function createProjectStoryPageAction(
  _previous: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const session = await requirePermission('content.write')
    const id = uuid(form, 'id')
    if (id === null) return issue('That project could not be identified.', 'id_missing')

    const client = await createClient()
    const project = await getProjectByIdForStudio(client, id)
    if (project.page_id !== null) {
      return issue('This project already has a story page.', 'page_exists')
    }

    const slug = project.slug.toLowerCase()
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
          slug: `portfolio-${slug}`,
          path: `/portfolio/${slug}`,
          title: project.title,
          kind: 'PROJECT',
        })
        await linkProjectPage(client, id, page.id)

        for (const band of projectStorySections()) {
          await insertSection(client, page.id, band.blockType, {
            // `payload` is `Json` on the row and the template hands back a parsed object; the cast
            // restates the narrowing Zod already did, for the generated type.
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
 * Attach one photograph to the gallery, or change what an attached one says and where it sits.
 *
 * ONE FORM PER ROW, NOT ONE FORM FOR THE PANEL, exactly as the product Media tab is built and for
 * the same reason: `reject_concept_project_media` refuses a concept render, and a whole-panel form
 * would lose every other edit on the screen to one refused attachment.
 *
 * THE REFUSAL AN EDITOR IS MOST LIKELY TO MEET IS NAMED HERE rather than left to
 * `refusalMessage`'s generic sentence. "That change could not be saved" in front of somebody trying
 * to attach a render tells them nothing about the rule they just met — and this is the rule the
 * phase's risk table names first.
 */
export async function saveProjectMediaAction(
  _previous: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const session = await requirePermission('content.write')
    const id = uuid(form, 'project_id')
    const mediaAssetId = uuid(form, 'media_asset_id')
    if (id === null) return issue('That project could not be identified.', 'id_missing')
    if (mediaAssetId === null) return issue('Choose a picture to attach.', 'media_missing')

    const role = text(form, 'role')
    if (role === null || !(PROJECT_MEDIA_ROLES as readonly string[]).includes(role)) {
      return issue('Choose what this picture is.', 'role_unknown')
    }

    const sortOrder = Number.parseInt(text(form, 'sort_order') ?? '', 10)
    const client = await createClient()
    const current = await listProjectMedia(client, id)
    const existing = current.find((row) => row.media_asset_id === mediaAssetId)

    const edge: ProjectMediaEdge = {
      mediaAssetId,
      role: role as ProjectMediaRole,
      caption: text(form, 'caption'),
      altOverride: text(form, 'alt_override'),
      // An unreadable or absent order keeps the row where it is, and puts a new row last — never at
      // 0, which would silently displace whatever the editor had chosen to lead with.
      sortOrder: Number.isNaN(sortOrder) ? (existing?.sort_order ?? current.length) : sortOrder,
    }

    const next = [
      ...current
        .filter((row) => row.media_asset_id !== mediaAssetId)
        .map((row) => ({
          mediaAssetId: row.media_asset_id,
          role: row.role as ProjectMediaRole,
          caption: row.caption,
          altOverride: row.alt_override,
          sortOrder: row.sort_order,
        })),
      edge,
    ]

    await withAudit(
      {
        action: 'content.page.update',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'portfolio_project_media',
        entityId: id,
      },
      async () => setProjectMediaEdges(client, id, next, session.userId),
    )

    revalidatePath(editorPath(id))
    return { status: 'saved' }
  } catch (error) {
    if (isConceptRefusal(error)) {
      return issue(
        'That image is a concept render, and a project gallery may only show the work itself.',
        'media_is_concept',
      )
    }
    return issue(refusalMessage(error))
  }
}

/** Remove one photograph from the gallery. The asset itself is untouched. */
export async function detachProjectMediaAction(
  _previous: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const session = await requirePermission('content.write')
    const id = uuid(form, 'project_id')
    const mediaAssetId = uuid(form, 'media_asset_id')
    if (id === null) return issue('That project could not be identified.', 'id_missing')
    if (mediaAssetId === null)
      return issue('That picture could not be identified.', 'media_missing')

    const client = await createClient()
    const next = (await listProjectMedia(client, id))
      .filter((row) => row.media_asset_id !== mediaAssetId)
      .map((row) => ({
        mediaAssetId: row.media_asset_id,
        role: row.role as ProjectMediaRole,
        caption: row.caption,
        altOverride: row.alt_override,
        sortOrder: row.sort_order,
      }))

    await withAudit(
      {
        action: 'content.page.update',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'portfolio_project_media',
        entityId: id,
      },
      async () => setProjectMediaEdges(client, id, next, session.userId),
    )

    revalidatePath(editorPath(id))
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error))
  }
}
