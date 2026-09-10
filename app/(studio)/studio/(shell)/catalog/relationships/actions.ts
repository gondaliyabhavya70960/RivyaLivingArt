'use server'

import { revalidatePath } from 'next/cache'

import type { StudioFormState } from '@/components/studio/form-state'
import { withAudit } from '@/lib/auth/audit'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import { RULE_KEYS, type RuleKey } from '@/lib/relations/rules'
import {
  acceptSuggestion,
  createEdge,
  dismissSuggestion,
  removeEdge,
  reorderEdges,
} from '@/lib/relations/write'
import { createClient } from '@/lib/supabase/server'
import {
  RELATION_TARGETS,
  RELATION_VOCABULARY,
  type RelationTarget,
  type RelationVocabulary,
} from '@/lib/supabase/schemas'

/**
 * The relationship workspace's Server Actions: accept, dismiss, create, remove, reorder.
 *
 * `'use server'` PUBLISHES EVERY EXPORT AS AN HTTP ENDPOINT, so `requirePermission('catalog.write')`
 * is the first statement of each one and is the only check that runs — no page body, no layout, no
 * proxy matcher stands in front of a Server Action. RLS refuses underneath as the second layer.
 *
 * EVERY VOCABULARY IS RE-CHECKED HERE AGAINST THE CLOSED LIST, even though `0213` now carries the
 * same lists as CHECK constraints. A constraint violation is a 500 with a message naming a
 * constraint; this is a sentence an editor can act on, and the two agree because both read the same
 * exported constant.
 *
 * NOTHING HERE THROWS. A thrown Server Action renders the error boundary and discards what the
 * editor was doing. Each returns a `StudioFormState` instead, which the form renders in place.
 */

const SOURCE_TYPES = ['product', 'portfolio_project', 'journal_article', 'collection'] as const
type SourceType = (typeof SOURCE_TYPES)[number]

function issue(message: string, code: string): StudioFormState {
  return { status: 'error', issues: [{ field: '_form', code, message }] }
}

function text(form: FormData, key: string): string | null {
  const value = form.get(key)
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function isSourceType(value: string | null): value is SourceType {
  return value !== null && (SOURCE_TYPES as readonly string[]).includes(value)
}
function isTarget(value: string | null): value is RelationTarget {
  return value !== null && (RELATION_TARGETS as readonly string[]).includes(value)
}
function isRelationType(value: string | null): value is RelationVocabulary {
  return value !== null && (RELATION_VOCABULARY as readonly string[]).includes(value)
}
function isRuleKey(value: string | null): value is RuleKey {
  return value !== null && (RULE_KEYS as readonly string[]).includes(value)
}

/** `PermissionError` and everything else, as one sentence the editor can read. */
function refusal(error: unknown): StudioFormState {
  if (error instanceof AuthenticationError)
    return issue('Sign in again to make that change.', 'unauthenticated')
  if (error instanceof AuthorizationError)
    return issue('You cannot change relationships.', 'forbidden')
  return issue('That change was refused. Nothing was saved.', 'refused')
}

export async function createRelationAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('catalog.write')
    const sourceType = text(form, 'source_type')
    const sourceId = text(form, 'source_id')
    const targetType = text(form, 'target_type')
    const targetId = text(form, 'target_id')
    const relationType = text(form, 'relation_type')

    if (!isSourceType(sourceType) || sourceId === null) {
      return issue('That is not something a relationship can start from.', 'source_unknown')
    }
    if (!isTarget(targetType) || targetId === null) {
      return issue('That is not something a relationship can point at.', 'target_unknown')
    }
    if (!isRelationType(relationType)) {
      return issue('That is not a relationship this site knows how to render.', 'relation_unknown')
    }

    const client = await createClient()
    await withAudit(
      {
        action: 'catalog.relation.create',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: sourceType,
        entityId: sourceId,
        summary: `Created ${relationType} from ${sourceType} ${sourceId} to ${targetType} ${targetId}`,
        after: { targetType, targetId, relationType, origin: 'EDITOR' } as never,
      },
      () =>
        createEdge(
          client,
          {
            source: { type: sourceType, id: sourceId },
            targetType,
            targetId,
            relationType,
            note: text(form, 'note'),
          },
          session.userId,
        ),
    )

    revalidatePath('/studio/catalog/relationships')
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}

/**
 * Accept a suggestion.
 *
 * THE RULE KEY IS RECORDED, and that is the difference between this and `createRelationAction`. Six
 * months later the workspace can show which edges an editor made and which they agreed to, and a
 * rule that started proposing badly can be found by its accepted edges rather than by memory.
 */
export async function acceptSuggestionAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('catalog.write')
    const sourceType = text(form, 'source_type')
    const sourceId = text(form, 'source_id')
    const targetType = text(form, 'target_type')
    const targetId = text(form, 'target_id')
    const relationType = text(form, 'relation_type')
    const ruleKey = text(form, 'rule_key')

    if (!isSourceType(sourceType) || sourceId === null) {
      return issue('That is not something a relationship can start from.', 'source_unknown')
    }
    if (!isTarget(targetType) || targetId === null) {
      return issue('That is not something a relationship can point at.', 'target_unknown')
    }
    if (!isRelationType(relationType)) {
      return issue('That is not a relationship this site knows how to render.', 'relation_unknown')
    }
    if (!isRuleKey(ruleKey)) {
      // A suggestion with an unknown rule key is not a suggestion this build produced, so accepting
      // it would write an `origin = 'RULE_ACCEPTED'` row naming a rule that does not exist.
      return issue('That suggestion is no longer available.', 'rule_unknown')
    }

    const client = await createClient()
    await withAudit(
      {
        action: 'catalog.relation.accept',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: sourceType,
        entityId: sourceId,
        summary: `Accepted ${ruleKey} suggestion: ${relationType} to ${targetType} ${targetId}`,
        after: { targetType, targetId, relationType, ruleKey, origin: 'RULE_ACCEPTED' } as never,
      },
      () =>
        acceptSuggestion(
          client,
          {
            source: { type: sourceType, id: sourceId },
            targetType,
            targetId,
            relationType,
            ruleKey,
          },
          session.userId,
        ),
    )

    revalidatePath('/studio/catalog/relationships')
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}

/** Dismiss a suggestion. Permanent, by design — see `relation_suppressions`. */
export async function dismissSuggestionAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('catalog.write')
    const sourceType = text(form, 'source_type')
    const sourceId = text(form, 'source_id')
    const targetType = text(form, 'target_type')
    const targetId = text(form, 'target_id')
    const ruleKey = text(form, 'rule_key')

    if (
      !isSourceType(sourceType) ||
      sourceId === null ||
      !isTarget(targetType) ||
      targetId === null
    ) {
      return issue('That suggestion could not be found.', 'suggestion_unknown')
    }
    if (!isRuleKey(ruleKey)) return issue('That suggestion is no longer available.', 'rule_unknown')

    const client = await createClient()
    await withAudit(
      {
        action: 'catalog.relation.dismiss',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: sourceType,
        entityId: sourceId,
        summary: `Dismissed ${ruleKey} suggestion to ${targetType} ${targetId}`,
        after: { targetType, targetId, ruleKey } as never,
      },
      () =>
        dismissSuggestion(
          client,
          {
            source: { type: sourceType, id: sourceId },
            targetType,
            targetId,
            ruleKey,
            reason: text(form, 'reason'),
          },
          session.userId,
        ),
    )

    revalidatePath('/studio/catalog/relationships')
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}

/** Remove an edge, and its inverse. Always available, including on an accepted-from-rule edge. */
export async function removeRelationAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('catalog.write')
    const id = text(form, 'relation_id')
    const table = text(form, 'relation_table')
    if (id === null || (table !== 'product_relations' && table !== 'content_relations')) {
      return issue('That relationship could not be found.', 'relation_unknown')
    }

    const client = await createClient()
    await withAudit(
      {
        action: 'catalog.relation.delete',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: table,
        entityId: id,
        summary: `Removed relationship ${id} and its inverse`,
      },
      () => removeEdge(client, table === 'product_relations', id),
    )

    revalidatePath('/studio/catalog/relationships')
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}

/** Reorder within one relation type. The ids arrive as a comma-separated list in display order. */
export async function reorderRelationsAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('catalog.write')
    const table = text(form, 'relation_table')
    const ordered = (text(form, 'ordered_ids') ?? '').split(',').filter((id) => id !== '')
    if (ordered.length === 0 || (table !== 'product_relations' && table !== 'content_relations')) {
      return issue('That order could not be read.', 'order_unknown')
    }

    const client = await createClient()
    await withAudit(
      {
        action: 'catalog.relation.reorder',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: table,
        entityId: ordered[0],
        summary: `Reordered ${ordered.length} relationship(s)`,
      },
      () => reorderEdges(client, table === 'product_relations', ordered),
    )

    revalidatePath('/studio/catalog/relationships')
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}
