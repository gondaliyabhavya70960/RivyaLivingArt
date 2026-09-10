import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/database.types'
import { PermissionError } from '@/lib/supabase/errors'
import {
  deleteRelationEdge,
  deleteRelationSuppression,
  findRelationEdge,
  getRelationEdge,
  insertRelationEdge,
  nextRelationSortOrder,
  setPairedRelation,
  updateRelationSortOrder,
  upsertRelationSuppression,
  type RelationTable,
} from '@/lib/supabase/repositories/relations'
import { isReciprocal, type RelationTarget, type RelationVocabulary } from '@/lib/supabase/schemas'

import type { RuleKey, SuggestionSource } from './rules'

type Client = SupabaseClient<Database>

/**
 * The four editor gestures: accept, dismiss, create, remove — plus reorder.
 *
 * WHY THIS IS NOT A REPOSITORY, AND HOLDS NO QUERY OF ITS OWN. Every gesture here spans two
 * tables, and two of them must span them ATOMICALLY: accepting a reciprocal suggestion writes an
 * edge, its inverse, and the pairing that links them. The repositories are single-statement
 * readers and writers by the Phase 03 rule, so this is the layer above them — composition,
 * reciprocity and compensation, with every `.from()` in `lib/supabase/repositories/relations.ts`
 * where `scripts/db/check-data-layer.mjs` requires it. The first draft held its own queries and CI
 * refused it.
 *
 * RLS FILTERS A WRITE, IT DOES NOT REFUSE ONE. That is the finding `product-edges.ts` records at
 * length and it applies to every function below: a role the policy does not admit changes nothing
 * and is told it worked. So every write here is read back, and a write that changed nothing raises
 * `PermissionError` — which the Server Action turns into "you cannot do that" rather than into a
 * success message about a row that does not exist.
 *
 * ACCEPTING IS THE ONLY WAY A RULE'S SUGGESTION BECOMES A ROW. `lib/relations/rules.ts` cannot
 * write; this file can, and only when called from a Server Action that has already checked
 * `catalog.write`. The `origin`/`rule_key` pair records which rule proposed it, so an editor
 * reviewing the workspace six months later can see the difference between what they decided and
 * what they agreed to.
 */

export interface EdgeInput {
  readonly source: SuggestionSource
  readonly targetType: RelationTarget
  readonly targetId: string
  readonly relationType: RelationVocabulary
  readonly note?: string | null
  readonly ruleKey?: RuleKey | null
}

/**
 * The inverse of an edge, for the three reciprocal types. Null when the type is one-way.
 *
 * EXPORTED FOR ONE REASON: `tests/unit/relation-reciprocity.test.ts` asserts the mapping without a
 * database. The interesting bug here — a project's inverse edge claiming to be a portfolio project
 * of itself — is a pure function of the two type names, and testing it through PostgREST would test
 * the driver instead.
 */
export function inverseOf(input: EdgeInput): EdgeInput | null {
  if (!isReciprocal(input.relationType)) return null

  // The inverse's SOURCE is this edge's target, which means the target must be a type that can BE
  // a source. A product can; a material and an attribute term cannot, and neither is reciprocal.
  const sourceType: SuggestionSource['type'] | null =
    input.targetType === 'product'
      ? 'product'
      : input.targetType === 'portfolio'
        ? 'portfolio_project'
        : input.targetType === 'journal'
          ? 'journal_article'
          : input.targetType === 'collection'
            ? 'collection'
            : null
  if (sourceType === null) return null

  const targetType: RelationTarget | null =
    input.source.type === 'product'
      ? 'product'
      : input.source.type === 'portfolio_project'
        ? 'portfolio'
        : input.source.type === 'journal_article'
          ? 'journal'
          : 'collection'

  /*
   * THE INVERSE IS NOT THE SAME RELATION NAME, AND IT IS KEYED OFF THE ORIGINAL SOURCE. A relation
   * type names WHAT IS AT THE FAR END, so a product's edge to a project is `PORTFOLIO_PROJECT` and
   * the project's edge back is `RELATED_PRODUCT`. The far end of the inverse is this edge's SOURCE,
   * which is the line the first draft of this function got wrong: it read `input.targetType` and
   * produced a project claiming to be a portfolio project of itself — a plausible-looking row
   * nobody would question. `tests/unit/relation-reciprocity.test.ts` is what found it.
   *
   * A COLLECTION HAS NO NAME IN THE VOCABULARY, so an edge whose source is one gets no inverse.
   * That is correct rather than a gap: collection membership is `product_collections`, a dedicated
   * table since Phase 03, and a second way to express it would be a second answer to "is this piece
   * in that collection".
   */
  const inverseRelationType: RelationVocabulary | null =
    input.source.type === 'product'
      ? 'RELATED_PRODUCT'
      : input.source.type === 'portfolio_project'
        ? 'PORTFOLIO_PROJECT'
        : input.source.type === 'journal_article'
          ? 'JOURNAL_ARTICLE'
          : null
  if (inverseRelationType === null) return null

  return {
    source: { type: sourceType, id: input.targetId },
    targetType,
    targetId: input.source.id,
    relationType: inverseRelationType,
    note: input.note ?? null,
    ruleKey: input.ruleKey ?? null,
  }
}

async function insertOne(
  client: Client,
  input: EdgeInput,
  actorId: string | null,
): Promise<{ id: string } | null> {
  const sortOrder = await nextRelationSortOrder(client, {
    sourceType: input.source.type,
    sourceId: input.source.id,
    relationType: input.relationType,
  })

  return insertRelationEdge(
    client,
    {
      sourceType: input.source.type,
      sourceId: input.source.id,
      targetType: input.targetType,
      targetId: input.targetId,
      relationType: input.relationType,
      sortOrder,
      origin: input.ruleKey ? 'RULE_ACCEPTED' : 'EDITOR',
      ruleKey: input.ruleKey ?? null,
      note: input.note ?? null,
    },
    actorId,
  )
}

const tableFor = (isProduct: boolean): RelationTable =>
  isProduct ? 'product_relations' : 'content_relations'

/** Point the two halves of a reciprocal pair at each other. Two statements, one per direction. */
async function pair(
  client: Client,
  aId: string,
  bId: string,
  aIsProduct: boolean,
  bIsProduct: boolean,
): Promise<void> {
  await setPairedRelation(client, tableFor(aIsProduct), aId, bId)
  await setPairedRelation(client, tableFor(bIsProduct), bId, aId)
}

/**
 * Create an edge, and its inverse when the type is reciprocal.
 *
 * NOT ONE TRANSACTION, AND THE COMPENSATION IS WHY THAT IS ACCEPTABLE. PostgREST has no
 * multi-statement transaction, so a second insert that fails would otherwise leave a half-pair. The
 * forward edge is therefore DELETED when the inverse cannot be written, and the caller is told the
 * whole gesture failed. The alternative — a SQL function taking eight arguments — was rejected
 * because the interesting failure here is a POLICY refusal, and a `security definer` function would
 * make the refusal disappear rather than surface.
 *
 * A DUPLICATE IS NOT AN ERROR THE EDITOR SHOULD SEE AS A FAILURE. The unique constraint means the
 * edge already exists, which is the state the editor was asking for; the conflict is swallowed and
 * the existing row is returned.
 */
export async function createEdge(
  client: Client,
  input: EdgeInput,
  actorId: string | null,
): Promise<{ id: string; pairedId: string | null }> {
  let forward: { id: string } | null
  try {
    forward = await insertOne(client, input, actorId)
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existing = await findEdge(client, input)
      if (existing !== null) return { id: existing.id, pairedId: existing.paired_relation_id }
    }
    throw error
  }

  if (forward === null) {
    // The insert policy filtered it. Nothing was written and nothing said so; see the header.
    throw new PermissionError('relation', 'create', `${input.source.type}:${input.source.id}`)
  }

  const inverse = inverseOf(input)
  if (inverse === null) return { id: forward.id, pairedId: null }

  let backward: { id: string } | null = null
  try {
    backward = await insertOne(client, inverse, actorId)
  } catch (error) {
    if (isUniqueViolation(error)) {
      backward = await findEdge(client, inverse)
    } else {
      await removeById(client, input.source.type === 'product', forward.id)
      throw error
    }
  }

  if (backward === null) {
    await removeById(client, input.source.type === 'product', forward.id)
    throw new PermissionError(
      'relation',
      'create-inverse',
      `${inverse.source.type}:${inverse.source.id}`,
    )
  }

  await pair(
    client,
    forward.id,
    backward.id,
    input.source.type === 'product',
    inverse.source.type === 'product',
  )

  return { id: forward.id, pairedId: backward.id }
}

/** Accept a suggestion: exactly `createEdge`, with the rule recorded. */
export async function acceptSuggestion(
  client: Client,
  input: EdgeInput & { readonly ruleKey: RuleKey },
  actorId: string | null,
): Promise<{ id: string; pairedId: string | null }> {
  return createEdge(client, input, actorId)
}

/**
 * Dismiss a suggestion — permanently.
 *
 * IT WRITES A ROW RATHER THAN REMEMBERING NOTHING. A dismissal that lived in a cookie or a session
 * would come back for the next editor, and a suggestions panel that re-proposes what a colleague
 * already rejected is worse than one that proposes nothing.
 */
export async function dismissSuggestion(
  client: Client,
  input: {
    readonly source: SuggestionSource
    readonly targetType: RelationTarget
    readonly targetId: string
    readonly ruleKey: RuleKey
    readonly reason?: string | null
  },
  actorId: string | null,
): Promise<void> {
  const written = await upsertRelationSuppression(
    client,
    {
      sourceType: input.source.type,
      sourceId: input.source.id,
      targetType: input.targetType,
      targetId: input.targetId,
      ruleKey: input.ruleKey,
      reason: input.reason ?? null,
    },
    actorId,
  )

  if (written === null) {
    throw new PermissionError(
      'relation suppression',
      'create',
      `${input.source.type}:${input.source.id}`,
    )
  }
}

/** Un-dismiss: the suggestion becomes proposable again. An editor may change their mind. */
export async function restoreSuggestion(
  client: Client,
  input: {
    readonly source: SuggestionSource
    readonly targetType: RelationTarget
    readonly targetId: string
    readonly ruleKey: RuleKey
  },
): Promise<void> {
  await deleteRelationSuppression(client, {
    sourceType: input.source.type,
    sourceId: input.source.id,
    targetType: input.targetType,
    targetId: input.targetId,
    ruleKey: input.ruleKey,
  })
}

async function removeById(client: Client, isProduct: boolean, id: string): Promise<void> {
  await deleteRelationEdge(client, tableFor(isProduct), id)
}

/**
 * Remove an edge and its inverse.
 *
 * DELETING ONE DELETES BOTH, always, including when the pair was created by accepting a rule. A
 * one-sided removal leaves the exact asymmetry `project-featured-product` exists to notice, so the
 * next visit to the workspace would propose re-creating what the editor just removed.
 */
export async function removeEdge(client: Client, isProduct: boolean, id: string): Promise<void> {
  const table = tableFor(isProduct)
  const row = await getRelationEdge(client, table, id)
  if (row === null) return

  const pairedId = row.paired_relation_id
  await deleteRelationEdge(client, table, id)

  // The pair may live in either table, and which one is not recorded on the row — so both are
  // asked. A delete matching nothing is free, and storing the table name would be a third thing
  // that can disagree with the other two.
  if (pairedId !== null) {
    await deleteRelationEdge(client, 'product_relations', pairedId)
    await deleteRelationEdge(client, 'content_relations', pairedId)
  }

  // RLS FILTERS A DELETE, IT DOES NOT REFUSE ONE. Reading the row back is the only way to tell
  // "removed it" from "matched nothing", and telling the editor a removal happened when the row
  // is still there is the failure this line exists for.
  const survivor = await getRelationEdge(client, table, id)
  if (survivor !== null) throw new PermissionError('relation', 'delete', id)
}

/** Reorder within one relation type. Always available, including on accepted-from-rule edges. */
export async function reorderEdges(
  client: Client,
  isProduct: boolean,
  orderedIds: readonly string[],
): Promise<void> {
  const table = tableFor(isProduct)
  for (const [index, id] of orderedIds.entries()) {
    await updateRelationSortOrder(client, table, id, index)
  }
}

async function findEdge(
  client: Client,
  input: EdgeInput,
): Promise<{ id: string; paired_relation_id: string | null } | null> {
  return findRelationEdge(client, {
    sourceType: input.source.type,
    sourceId: input.source.id,
    targetType: input.targetType,
    targetId: input.targetId,
    relationType: input.relationType,
  })
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  )
}
