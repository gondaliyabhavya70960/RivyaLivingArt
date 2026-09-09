'use server'

import { revalidatePath } from 'next/cache'

import { withAudit } from '@/lib/auth/audit'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import type { ValidationIssue } from '@/lib/catalog/validation'
import { exhibitionSections } from '@/content/templates/exhibition'
import { updateCollectionRow } from '@/lib/supabase/repositories/catalog-admin'
import { insertEntityPage, insertSection } from '@/lib/supabase/repositories/cms'
import {
  getCollectionPageId,
  listCuratedEntries,
  linkCollectionPage,
  setCuratedProducts,
} from '@/lib/supabase/repositories/collections'
import {
  RELATION_ENTITIES,
  RELATION_KINDS,
  getRelations,
  setRelations,
  type RelationEntity,
  type RelationKind,
} from '@/lib/supabase/repositories/entity-relations'
import { getProductById } from '@/lib/supabase/repositories/catalog-admin'
import { createClient } from '@/lib/supabase/server'

/**
 * The collection editor's Server Actions.
 *
 * `'use server'` PUBLISHES EVERY EXPORT AS AN HTTP ENDPOINT, reachable with a session cookie and no
 * page body at all, so `requirePermission` inside each one is the only check that runs. Every
 * action here calls it first, and reads use the same request-scoped client so RLS refuses
 * underneath the guard as well as beside it.
 *
 * THE CONFIRMATION IS `content.verify`, NOT `catalog.write`. Confirming that a collection is real
 * is an owner verification act — the same act D10 asks for everywhere a document asserts business
 * capability — and `content.verify` is owner and admin, which is exactly the set
 * `enforce_collection_concept_authority` admits in the database. The two are written independently
 * and agree; if they ever stop agreeing, the trigger wins and the editor is told so, which is the
 * right way round for a rule about what is true.
 *
 * NOTHING HERE PUBLISHES ANYTHING. Confirming a concept makes it publishABLE; publishing happens
 * through the exhibition page's own workflow, where `sync_entity_page_status` carries the status
 * across. That separation is deliberate: the person who says "this collection is real" and the
 * person who says "this page is ready" are answering different questions, and Phase 16 ships with
 * zero published collections either way.
 */

export type CollectionActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'saved' }
  | { readonly status: 'error'; readonly issues: readonly ValidationIssue[] }

const IDLE_ISSUE = (message: string, code = 'refused'): CollectionActionState => ({
  status: 'error',
  issues: [{ field: '_form', code, message }],
})

function refusalMessage(error: unknown): string {
  if (error instanceof AuthenticationError) return 'Your session has expired. Sign in again.'
  if (error instanceof AuthorizationError) return 'You do not have permission to do that.'
  // A trigger message names internal identifiers, so it is not shown verbatim. The refusals an
  // editor can act on are worded explicitly above the calls that can raise them.
  return 'That change could not be saved.'
}

/** `''` is what an untouched input submits, and it means "not set", not "the empty string". */
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

const editorPath = (id: string) => `/studio/catalog/collections/${id}`

/**
 * The exhibition fields: subtitle, the long statement, and the two media bindings.
 *
 * THE SHORT `statement` IS EDITED ON THE LIST SCREEN and is left alone here, so the two forms
 * cannot both claim to own it. What this one adds is the exhibition-page material: a subtitle, the
 * long statement the page's `statement` band draws on, and the signature and video assets.
 *
 * IT DOES NOT TOUCH `concept_state`. That has its own action, its own permission and its own
 * trigger — a form field would let a merchandiser submit one in a payload and discover the refusal
 * only after the request reached the database, with nothing in the audit log to show for it.
 */
export async function saveExhibitionFieldsAction(
  _previous: CollectionActionState,
  form: FormData,
): Promise<CollectionActionState> {
  try {
    const session = await requirePermission('catalog.write')
    const id = uuid(form, 'id')
    if (id === null) return IDLE_ISSUE('That collection could not be identified.', 'id_missing')

    const client = await createClient()
    await withAudit(
      {
        action: 'catalog.collection.update',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'collections',
        entityId: id,
      },
      async () =>
        updateCollectionRow(client, id, {
          subtitle: text(form, 'subtitle'),
          statement_long: text(form, 'statement_long'),
          signature_media_id: uuid(form, 'signature_media_id'),
          video_media_id: uuid(form, 'video_media_id'),
          updated_by: session.userId,
        }),
    )

    revalidatePath(editorPath(id))
    return { status: 'saved' }
  } catch (error) {
    return IDLE_ISSUE(refusalMessage(error))
  }
}

/**
 * The owner's confirmation that a collection is real, and its withdrawal.
 *
 * ONE ACTION FOR BOTH DIRECTIONS, because they are the same decision with opposite signs and
 * splitting them would let the two drift apart on permission or audit. The target state arrives in
 * the form rather than being inferred from the current one: a toggle computed from what the page
 * was rendered with will send the wrong instruction the moment two people have the screen open.
 *
 * `owner_confirmed_at` AND `owner_confirmed_by` ARE NOT SET HERE. The trigger stamps them from the
 * session, so a client cannot name someone else as the confirmer, and withdrawal clears them.
 */
export async function setConceptStateAction(
  _previous: CollectionActionState,
  form: FormData,
): Promise<CollectionActionState> {
  try {
    const session = await requirePermission('content.verify')
    const id = uuid(form, 'id')
    if (id === null) return IDLE_ISSUE('That collection could not be identified.', 'id_missing')

    const target = text(form, 'concept_state')
    if (
      target !== 'OWNER_CONFIRMED' &&
      target !== 'RETIRED' &&
      target !== 'DRAFT_COLLECTION_CONCEPT'
    ) {
      return IDLE_ISSUE('That is not a concept state.', 'concept_state_unknown')
    }

    const client = await createClient()
    await withAudit(
      {
        action: 'catalog.collection.update',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'collections',
        entityId: id,
      },
      async () => updateCollectionRow(client, id, { concept_state: target }),
    )

    revalidatePath(editorPath(id))
    return { status: 'saved' }
  } catch (error) {
    return IDLE_ISSUE(refusalMessage(error))
  }
}

/**
 * Add one piece to the curation, at the end.
 *
 * THE PRODUCT IS READ BEFORE IT IS LINKED, so a mistyped id is refused in words rather than as a
 * foreign-key violation naming a constraint. The read runs through the same request-scoped client,
 * so a piece this role cannot see is indistinguishable from one that does not exist — which is
 * correct, and is why the message says neither.
 */
export async function addCuratedProductAction(
  _previous: CollectionActionState,
  form: FormData,
): Promise<CollectionActionState> {
  try {
    const session = await requirePermission('catalog.write')
    const id = uuid(form, 'id')
    const productId = uuid(form, 'product_id')
    if (id === null) return IDLE_ISSUE('That collection could not be identified.', 'id_missing')
    if (productId === null) return IDLE_ISSUE('Paste a product id.', 'product_id_shape')

    const client = await createClient()
    const product = await getProductById(client, productId).catch(() => null)
    if (product === null) return IDLE_ISSUE('No product with that id.', 'product_unknown')

    const entries = await listCuratedEntries(client, id)
    if (entries.some((entry) => entry.productId === productId)) {
      return IDLE_ISSUE('That piece is already in this collection.', 'product_duplicate')
    }

    const next = entries.reduce((max, entry) => Math.max(max, entry.sortOrder), -1) + 1
    await withAudit(
      {
        action: 'catalog.collection.update',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'product_collections',
        entityId: id,
      },
      async () =>
        setCuratedProducts(
          client,
          id,
          [...entries, { productId, sortOrder: next }],
          session.userId,
        ),
    )

    revalidatePath(editorPath(id))
    return { status: 'saved' }
  } catch (error) {
    return IDLE_ISSUE(refusalMessage(error))
  }
}

/**
 * Remove one piece, or move it one place.
 *
 * MOVING IS NOT DRAG AND DROP, AND THAT IS A DELIBERATE DEPARTURE from the phase document's "drag
 * ordering". A drag handle needs a keyboard equivalent to be usable at all — WCAG 2.1.1, and the
 * Studio is an internal tool used by exactly the people who cannot be told to use a mouse — so the
 * keyboard control has to exist either way. It is built first, and on its own: two buttons that
 * submit a form work without JavaScript, are announced correctly, and cannot lose an editor's
 * arrangement to a dropped pointer event. A pointer affordance can be layered over this later
 * without changing the write path.
 *
 * THE WHOLE ORDER IS REWRITTEN, not the moved row alone. `sort_order` has no unique constraint, so
 * two rows can hold the same number and the list would then order by product id — a reshuffle
 * nobody asked for. Renumbering from zero on every move keeps the sequence total.
 */
export async function reorderCuratedProductAction(
  _previous: CollectionActionState,
  form: FormData,
): Promise<CollectionActionState> {
  try {
    const session = await requirePermission('catalog.write')
    const id = uuid(form, 'id')
    const productId = uuid(form, 'product_id')
    const direction = text(form, 'direction')
    if (id === null) return IDLE_ISSUE('That collection could not be identified.', 'id_missing')
    if (productId === null)
      return IDLE_ISSUE('That piece could not be identified.', 'product_id_shape')

    const client = await createClient()
    const entries = await listCuratedEntries(client, id)
    const index = entries.findIndex((entry) => entry.productId === productId)
    if (index === -1) return IDLE_ISSUE('That piece is not in this collection.', 'product_absent')

    const ordered = [...entries]
    if (direction === 'remove') {
      ordered.splice(index, 1)
    } else {
      const to = direction === 'up' ? index - 1 : index + 1
      // A move off either end is a no-op rather than an error: the control is disabled at the
      // boundaries, and a request that arrives anyway asked for the arrangement it already has.
      if (to < 0 || to >= ordered.length) return { status: 'saved' }
      const [moved] = ordered.splice(index, 1)
      if (moved !== undefined) ordered.splice(to, 0, moved)
    }

    await withAudit(
      {
        action: 'catalog.collection.update',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'product_collections',
        entityId: id,
      },
      async () =>
        setCuratedProducts(
          client,
          id,
          ordered.map((entry, position) => ({ productId: entry.productId, sortOrder: position })),
          session.userId,
        ),
    )

    revalidatePath(editorPath(id))
    return { status: 'saved' }
  } catch (error) {
    return IDLE_ISSUE(refusalMessage(error))
  }
}

/**
 * Add or remove one hand-made edge in `entity_relations`.
 *
 * NO SUGGESTIONS, NO SCORING, NO "COLLECTIONS LIKE THIS". Phase 23 owns the relationship engine;
 * everything here is an edge a person made on purpose, which is why `created_by` is required by the
 * repository's own signature rather than defaulted.
 *
 * THE TARGET IS AN ID THE EDITOR PASTES. The ids in `entity_relations` are polymorphic and
 * un-FK'd — they must be, since three of the six target families have no table until Phases 17 and
 * 18 — so nothing here can validate that the target exists. An edge to a journal article that does
 * not exist yet is legitimate and stays invisible until it does.
 */
export async function setRelationAction(
  _previous: CollectionActionState,
  form: FormData,
): Promise<CollectionActionState> {
  try {
    const session = await requirePermission('catalog.write')
    const id = uuid(form, 'id')
    if (id === null) return IDLE_ISSUE('That collection could not be identified.', 'id_missing')

    const targetId = uuid(form, 'target_id')
    const targetType = text(form, 'target_type')
    const relationType = text(form, 'relation_type')
    const remove = text(form, 'intent') === 'remove'

    if (targetId === null)
      return IDLE_ISSUE('Paste the id of the thing to link to.', 'target_shape')
    if (targetType === null || !RELATION_ENTITIES.includes(targetType as RelationEntity)) {
      return IDLE_ISSUE('Choose what kind of thing this links to.', 'target_type_unknown')
    }
    if (relationType === null || !RELATION_KINDS.includes(relationType as RelationKind)) {
      return IDLE_ISSUE('Choose a kind of relationship.', 'relation_type_unknown')
    }

    const client = await createClient()
    const current = await getRelations(client, 'COLLECTION', id)
    const matches = (edge: (typeof current)[number]) =>
      edge.target_type === targetType &&
      edge.target_id === targetId &&
      edge.relation_type === relationType

    if (remove) {
      if (!current.some(matches)) return { status: 'saved' }
    } else if (current.some(matches)) {
      return IDLE_ISSUE('That link already exists.', 'relation_duplicate')
    }

    /*
     * THE READ AND THE WRITE SPEAK DIFFERENT SHAPES ON PURPOSE. `getRelations` returns rows —
     * snake_case, straight from the table — and `setRelations` takes edges, which are the caller's
     * intent rather than a row: no id, no `created_at`, and a `sourceType`/`sourceId` pair the
     * repository will not infer. Mapping between them here, once, is what stops a row read from one
     * collection being written back as an edge of another.
     */
    const kept = current
      .filter((edge) => !remove || !matches(edge))
      .map((edge) => ({
        sourceType: 'COLLECTION' as const,
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
            sourceType: 'COLLECTION' as const,
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
        action: 'catalog.collection.update',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'entity_relations',
        entityId: id,
      },
      async () =>
        setRelations(
          client,
          'COLLECTION',
          id,
          next.map((edge, position) => ({ ...edge, sortOrder: position })),
          session.userId,
        ),
    )

    revalidatePath(editorPath(id))
    return { status: 'saved' }
  } catch (error) {
    return IDLE_ISSUE(refusalMessage(error))
  }
}

/**
 * Create the exhibition page and fill it with the template.
 *
 * IT IS REFUSED IF ONE ALREADY EXISTS, and that check is a read rather than a hope:
 * `collections.page_id` is UNIQUE, so a second attempt would fail at the constraint with a message
 * naming an index. Reading first turns that into a sentence, and the unique constraint remains the
 * thing that actually prevents it if two editors press the button at the same moment.
 *
 * THE PAGE IS CREATED FIRST AND LINKED SECOND, in that order and not the other, because linking is
 * what fires `collections_sync_page_path`. A page created without a link would sit at whatever path
 * was passed and never be corrected if the slug changed.
 *
 * THE SECTIONS ARE INSERTED ONE AT A TIME, in order, and `insertSection` computes each position
 * from what is already there. That is slower than one bulk insert and it is what makes the
 * deferrable unique constraint on `position` hold when two editors act at once — the loser fails on
 * a constraint rather than overwriting.
 *
 * A FAILURE PART-WAY LEAVES A PARTIAL PAGE, and that is stated rather than hidden. There is no
 * transaction across HTTP calls to PostgREST; wrapping this in a `SECURITY DEFINER` function would
 * buy atomicity at the cost of moving the block template into SQL, where it could no longer be read
 * from `content/templates/exhibition.ts`. A partially-built page is visible, editable and
 * completable by hand in Studio, which a half-written stored procedure would not be.
 */
export async function createExhibitionPageAction(
  _previous: CollectionActionState,
  form: FormData,
): Promise<CollectionActionState> {
  try {
    // BOTH permissions, because this action does two things: it creates a `pages` row (content) and
    // it writes `collections.page_id` (catalogue). Asking for one would let a role that may do only
    // half of it get half-way and be refused by RLS on the other half.
    const session = await requirePermission('content.write')
    await requirePermission('catalog.write')

    const id = uuid(form, 'id')
    const slug = text(form, 'slug')
    const name = text(form, 'name')
    if (id === null || slug === null || name === null) {
      return IDLE_ISSUE('That collection could not be identified.', 'id_missing')
    }

    const client = await createClient()
    if ((await getCollectionPageId(client, id)) !== null) {
      return IDLE_ISSUE('This collection already has an exhibition page.', 'page_exists')
    }

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
          slug: `collections-${slug.toLowerCase()}`,
          path: `/collections/${slug.toLowerCase()}`,
          title: name,
          kind: 'COLLECTION',
        })
        await linkCollectionPage(client, id, page.id)

        for (const band of exhibitionSections()) {
          await insertSection(client, page.id, band.blockType, {
            // `payload` is `Json` on the row and the template hands back a parsed object; the cast
            // is the narrowing Zod already did, restated for the generated type.
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
    return IDLE_ISSUE(refusalMessage(error))
  }
}
