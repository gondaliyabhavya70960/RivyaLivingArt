import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/database.types'
import { PermissionError } from '@/lib/supabase/errors'
import { isReciprocal, type RelationTarget, type RelationVocabulary } from '@/lib/supabase/schemas'

import type { RuleKey, SuggestionSource } from './rules'

type Client = SupabaseClient<Database>

/**
 * The four editor gestures: accept, dismiss, create, remove — plus reorder.
 *
 * WHY THIS IS NOT IN A REPOSITORY. Every function here spans two tables, and two of them must span
 * them ATOMICALLY: accepting a reciprocal suggestion writes an edge, its inverse, and the pairing
 * that links them. The repositories are single-table readers and writers by the Phase 03 rule; this
 * is the transaction layer above them, and it calls SQL functions (0215 is not needed — the pairing
 * is done with two writes and a compensating delete, see `createEdge`) rather than pretending a
 * PostgREST call is a transaction.
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
  const origin = input.ruleKey ? ('RULE_ACCEPTED' as const) : ('EDITOR' as const)
  const sortOrder = await nextSortOrder(client, input)

  if (input.source.type === 'product') {
    const { data, error } = await client
      .from('product_relations')
      .insert({
        source_product_id: input.source.id,
        target_type: input.targetType,
        target_id: input.targetId,
        relation_type: input.relationType,
        sort_order: sortOrder,
        origin,
        rule_key: input.ruleKey ?? null,
        note: input.note ?? null,
        created_by: actorId,
      })
      .select('id')
      .maybeSingle()
    if (error !== null) throw error
    return data
  }

  const { data, error } = await client
    .from('content_relations')
    .insert({
      source_type: input.source.type,
      source_id: input.source.id,
      target_type: input.targetType,
      target_id: input.targetId,
      relation_type: input.relationType,
      sort_order: sortOrder,
      origin,
      rule_key: input.ruleKey ?? null,
      note: input.note ?? null,
      created_by: actorId,
    })
    .select('id')
    .maybeSingle()
  if (error !== null) throw error
  return data
}

async function nextSortOrder(client: Client, input: EdgeInput): Promise<number> {
  if (input.source.type === 'product') {
    const { data } = await client
      .from('product_relations')
      .select('sort_order')
      .eq('source_product_id', input.source.id)
      .eq('relation_type', input.relationType)
      .order('sort_order', { ascending: false })
      .limit(1)
    return (data?.[0]?.sort_order ?? -1) + 1
  }
  const { data } = await client
    .from('content_relations')
    .select('sort_order')
    .eq('source_type', input.source.type)
    .eq('source_id', input.source.id)
    .eq('relation_type', input.relationType)
    .order('sort_order', { ascending: false })
    .limit(1)
  return (data?.[0]?.sort_order ?? -1) + 1
}

async function pair(
  client: Client,
  aId: string,
  bId: string,
  aIsProduct: boolean,
  bIsProduct: boolean,
): Promise<void> {
  if (aIsProduct) {
    await client.from('product_relations').update({ paired_relation_id: bId }).eq('id', aId)
  } else {
    await client.from('content_relations').update({ paired_relation_id: bId }).eq('id', aId)
  }
  if (bIsProduct) {
    await client.from('product_relations').update({ paired_relation_id: aId }).eq('id', bId)
  } else {
    await client.from('content_relations').update({ paired_relation_id: aId }).eq('id', bId)
  }
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
  const { data, error } = await client
    .from('relation_suppressions')
    .upsert(
      {
        source_type: input.source.type,
        source_id: input.source.id,
        target_type: input.targetType,
        target_id: input.targetId,
        rule_key: input.ruleKey,
        reason: input.reason ?? null,
        suppressed_by: actorId,
      },
      { onConflict: 'source_type,source_id,target_type,target_id,rule_key' },
    )
    .select('id')
    .maybeSingle()

  if (error !== null) throw error
  if (data === null) {
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
  const { error } = await client
    .from('relation_suppressions')
    .delete()
    .eq('source_type', input.source.type)
    .eq('source_id', input.source.id)
    .eq('target_type', input.targetType)
    .eq('target_id', input.targetId)
    .eq('rule_key', input.ruleKey)
  if (error !== null) throw error
}

async function removeById(client: Client, isProduct: boolean, id: string): Promise<void> {
  if (isProduct) await client.from('product_relations').delete().eq('id', id)
  else await client.from('content_relations').delete().eq('id', id)
}

/**
 * Remove an edge and its inverse.
 *
 * DELETING ONE DELETES BOTH, always, including when the pair was created by accepting a rule. A
 * one-sided removal leaves the exact asymmetry `project-featured-product` exists to notice, so the
 * next visit to the workspace would propose re-creating what the editor just removed.
 */
export async function removeEdge(client: Client, isProduct: boolean, id: string): Promise<void> {
  const table = isProduct ? 'product_relations' : 'content_relations'
  const { data: row } = await client
    .from(table)
    .select('id, paired_relation_id')
    .eq('id', id)
    .maybeSingle()

  if (row === null || row === undefined) return

  const pairedId = row.paired_relation_id
  await removeById(client, isProduct, id)

  // The pair may live in either table, and which one is not recorded on the row — so both are
  // asked. A delete matching nothing is free, and storing the table name would be a third thing
  // that can disagree with the other two.
  if (pairedId !== null) {
    await client.from('product_relations').delete().eq('id', pairedId)
    await client.from('content_relations').delete().eq('id', pairedId)
  }

  const { data: survivor } = await client.from(table).select('id').eq('id', id).maybeSingle()
  if (survivor !== null && survivor !== undefined) {
    throw new PermissionError('relation', 'delete', id)
  }
}

/** Reorder within one relation type. Always available, including on accepted-from-rule edges. */
export async function reorderEdges(
  client: Client,
  isProduct: boolean,
  orderedIds: readonly string[],
): Promise<void> {
  const table = isProduct ? 'product_relations' : 'content_relations'
  for (const [index, id] of orderedIds.entries()) {
    const { error } = await client.from(table).update({ sort_order: index }).eq('id', id)
    if (error !== null) throw error
  }
}

async function findEdge(
  client: Client,
  input: EdgeInput,
): Promise<{ id: string; paired_relation_id: string | null } | null> {
  if (input.source.type === 'product') {
    const { data } = await client
      .from('product_relations')
      .select('id, paired_relation_id')
      .eq('source_product_id', input.source.id)
      .eq('target_type', input.targetType)
      .eq('target_id', input.targetId)
      .eq('relation_type', input.relationType)
      .maybeSingle()
    return data ?? null
  }
  const { data } = await client
    .from('content_relations')
    .select('id, paired_relation_id')
    .eq('source_type', input.source.type)
    .eq('source_id', input.source.id)
    .eq('target_type', input.targetType)
    .eq('target_id', input.targetId)
    .eq('relation_type', input.relationType)
    .maybeSingle()
  return data ?? null
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  )
}
