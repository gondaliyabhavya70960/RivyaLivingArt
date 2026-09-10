import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import { productRelationSchema, type ProductRelation } from '../schemas'
import { parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'product relation'

/**
 * Product relationship edges.
 *
 * Phase 23 builds the engine that proposes edges; this is only the storage and the reads. The rule
 * that engine must honour is worth stating where the table is accessed: NO EDGE IS EVER CREATED
 * AUTOMATICALLY WITHOUT A STATED, NAMED RULE, and an editor can always override one. That is why
 * Phase 23 adds `origin` and `rule_key` columns rather than letting a recommendation appear with
 * no account of where it came from.
 */

export async function listRelationsForProduct(
  client: Client,
  sourceProductId: string,
): Promise<ProductRelation[]> {
  const { data, error } = await client
    .from('product_relations')
    .select('*')
    .eq('source_product_id', sourceProductId)
    .order('relation_type', { ascending: true })
    .order('sort_order', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'list', sourceProductId, error)
  return parseRows(ENTITY, productRelationSchema, data ?? [])
}

/** Edges pointing AT something — served by `product_relations_target_idx`, which exists precisely
 *  because the unique edge key is ordered source-first and cannot answer this. */
export async function listRelationsToTarget(
  client: Client,
  targetType: string,
  targetId: string,
): Promise<ProductRelation[]> {
  const { data, error } = await client
    .from('product_relations')
    .select('*')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .order('sort_order', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'list', `${targetType}:${targetId}`, error)
  return parseRows(ENTITY, productRelationSchema, data ?? [])
}

// --- Phase 23: the relationship graph -------------------------------------------------------------
//
// EVERY `.from()` THE SUGGESTION RULES AND THE RELATION WRITER NEED LIVES HERE, and that is the
// Phase 03 rule rather than tidiness: `scripts/db/check-data-layer.mjs` fails the build on a query
// outside `lib/supabase/repositories/**`, and it caught the first draft of `lib/relations/**`
// doing exactly that. The rule earns its keep here — the reads below are the ones a rule could
// most easily get subtly wrong (an unpublished sibling, a concept collection), so having them in
// one file where the filters are visible together is worth more than the indirection costs.
//
// THE READS ARE NARROW ON PURPOSE. Each returns the few fields a rule reasons about, not a row.
// A rule that received whole products could start reasoning about a price, and FEAT §11 has
// nothing to say about prices.

/** A target already connected, as `type:id`. What a rule checks before proposing. */
export async function listConnectedTargets(
  client: Client,
  source: { type: string; id: string },
): Promise<Set<string>> {
  const connected = new Set<string>()

  if (source.type === 'product') {
    const { data, error } = await client
      .from('product_relations')
      .select('target_type, target_id')
      .eq('source_product_id', source.id)
    if (error) throw toRepositoryError(ENTITY, 'list-connected', source.id, error)
    for (const row of data ?? []) connected.add(`${row.target_type}:${row.target_id}`)
    return connected
  }

  const { data, error } = await client
    .from('content_relations')
    .select('target_type, target_id')
    .eq('source_type', source.type)
    .eq('source_id', source.id)
  if (error) throw toRepositoryError(ENTITY, 'list-connected', source.id, error)
  for (const row of data ?? []) connected.add(`${row.target_type}:${row.target_id}`)
  return connected
}

/** Dismissed suggestions, as `type:id:rule`. A dismissal is permanent by design. */
export async function listSuppressedSuggestions(
  client: Client,
  source: { type: string; id: string },
): Promise<Set<string>> {
  const { data, error } = await client
    .from('relation_suppressions')
    .select('target_type, target_id, rule_key')
    .eq('source_type', source.type)
    .eq('source_id', source.id)
  if (error) throw toRepositoryError(ENTITY, 'list-suppressions', source.id, error)

  const suppressed = new Set<string>()
  for (const row of data ?? []) {
    suppressed.add(`${row.target_type}:${row.target_id}:${row.rule_key}`)
  }
  return suppressed
}

export interface CollectionSibling {
  readonly collectionName: string
  readonly productId: string
  readonly productTitle: string
}

/**
 * Published products sharing a published, confirmed collection with this one.
 *
 * THE CONCEPT FILTER IS HERE, NOT IN THE RULE. FEAT §9's `DRAFT_COLLECTION_CONCEPT` rows are ideas,
 * and two products sitting in an idea are not related by anything yet. Keeping the filter beside
 * the query means a second caller cannot forget it.
 */
export async function listCollectionSiblings(
  client: Client,
  productId: string,
): Promise<CollectionSibling[]> {
  const { data: memberships, error: membershipError } = await client
    .from('product_collections')
    .select('collection_id, collections!inner(id, name, status, concept_state)')
    .eq('product_id', productId)
  if (membershipError) {
    throw toRepositoryError(ENTITY, 'list-collection-siblings', productId, membershipError)
  }

  const collections = (memberships ?? [])
    .map((row) => row.collections as unknown as CollectionRow | null)
    .filter(
      (row): row is CollectionRow =>
        row !== null &&
        row.status === 'PUBLISHED' &&
        row.concept_state !== 'DRAFT_COLLECTION_CONCEPT',
    )
  if (collections.length === 0) return []

  const { data: siblings, error: siblingError } = await client
    .from('product_collections')
    .select('collection_id, product_id, products!inner(id, title, status)')
    .in(
      'collection_id',
      collections.map((row) => row.id),
    )
  if (siblingError) {
    throw toRepositoryError(ENTITY, 'list-collection-siblings', productId, siblingError)
  }

  const nameById = new Map(collections.map((row) => [row.id, row.name]))
  const out: CollectionSibling[] = []
  for (const row of siblings ?? []) {
    const product = row.products as unknown as ProductRow | null
    if (product === null || product.id === productId || product.status !== 'PUBLISHED') continue
    const collectionName = nameById.get(row.collection_id)
    if (collectionName === undefined) continue
    out.push({ collectionName, productId: product.id, productTitle: product.title })
  }
  return out
}

type CollectionRow = { id: string; name: string; status: string; concept_state: string }
type ProductRow = { id: string; title: string; status: string }

export interface MaterialOverlap {
  readonly productId: string
  readonly productTitle: string
  readonly materialNames: readonly string[]
}

/** Published products sharing at least `minimum` materials with this one. Two, by the rule. */
export async function listMaterialOverlaps(
  client: Client,
  productId: string,
  minimum = 2,
): Promise<MaterialOverlap[]> {
  const { data: mine, error: mineError } = await client
    .from('product_materials')
    .select('material_id, materials!inner(id, name)')
    .eq('product_id', productId)
  if (mineError) throw toRepositoryError(ENTITY, 'list-material-overlaps', productId, mineError)

  const materialIds = (mine ?? []).map((row) => row.material_id)
  if (materialIds.length < minimum) return []

  const names = new Map<string, string>()
  for (const row of mine ?? []) {
    const material = row.materials as unknown as { id: string; name: string } | null
    if (material !== null) names.set(material.id, material.name)
  }

  const { data: others, error: othersError } = await client
    .from('product_materials')
    .select('product_id, material_id, products!inner(id, title, status)')
    .in('material_id', materialIds)
  if (othersError) throw toRepositoryError(ENTITY, 'list-material-overlaps', productId, othersError)

  const shared = new Map<string, { title: string; materials: string[] }>()
  for (const row of others ?? []) {
    if (row.product_id === productId) continue
    const product = row.products as unknown as ProductRow | null
    if (product === null || product.status !== 'PUBLISHED') continue
    const entry = shared.get(product.id) ?? { title: product.title, materials: [] }
    const name = names.get(row.material_id)
    if (name !== undefined) entry.materials.push(name)
    shared.set(product.id, entry)
  }

  return [...shared.entries()]
    .filter(([, entry]) => entry.materials.length >= minimum)
    .map(([id, entry]) => ({
      productId: id,
      productTitle: entry.title,
      materialNames: [...entry.materials].sort(),
    }))
}

/** The slug a journal link would have to contain. Null when the product is gone. */
export async function getProductSlug(client: Client, productId: string): Promise<string | null> {
  const { data, error } = await client
    .from('products')
    .select('slug')
    .eq('id', productId)
    .maybeSingle()
  if (error) throw toRepositoryError(ENTITY, 'get-product-slug', productId, error)
  return data?.slug ?? null
}

export interface LinkingArticle {
  readonly id: string
  readonly title: string
}

/**
 * Published articles whose page links to `path`.
 *
 * FOUR PLACES ARE SEARCHED, not one: prose (`body`, `supporting`), either call to action, and a
 * block's own `payload`. An author who linked the piece from a button linked it just as
 * deliberately as one who linked it mid-sentence, and a rule that noticed only the sentence would
 * quietly depend on how somebody chose to lay a page out.
 */
export async function listArticlesLinkingTo(
  client: Client,
  path: string,
): Promise<LinkingArticle[]> {
  const { data: articles, error: articleError } = await client
    .from('journal_articles')
    .select('id, title, page_id')
    .eq('status', 'PUBLISHED')
  if (articleError) throw toRepositoryError(ENTITY, 'list-linking-articles', path, articleError)

  const out: LinkingArticle[] = []
  for (const article of articles ?? []) {
    if (article.page_id === null) continue
    const { data: sections, error: sectionError } = await client
      .from('page_sections')
      .select('body, supporting, cta_url, cta_secondary_url, payload')
      .eq('page_id', article.page_id)
      .eq('status', 'PUBLISHED')
    if (sectionError) {
      throw toRepositoryError(ENTITY, 'list-linking-articles', article.id, sectionError)
    }

    const linked = (sections ?? []).some((section) =>
      [
        section.body,
        section.supporting,
        section.cta_url,
        section.cta_secondary_url,
        section.payload === null ? '' : JSON.stringify(section.payload),
      ].some((field) => typeof field === 'string' && field.includes(path)),
    )
    if (linked) out.push({ id: article.id, title: article.title })
  }
  return out
}

/** Published projects that already point at this product — the forward edge of the inverse rule. */
export async function listProjectsPointingAtProduct(
  client: Client,
  productId: string,
): Promise<Array<{ id: string; title: string }>> {
  const { data: edges, error: edgeError } = await client
    .from('content_relations')
    .select('source_id')
    .eq('source_type', 'portfolio_project')
    .eq('target_type', 'product')
    .eq('target_id', productId)
  if (edgeError) throw toRepositoryError(ENTITY, 'list-projects-pointing', productId, edgeError)

  const ids = [...new Set((edges ?? []).map((row) => row.source_id))]
  if (ids.length === 0) return []

  const { data: projects, error: projectError } = await client
    .from('portfolio_projects')
    .select('id, title, status')
    .in('id', ids)
    .eq('status', 'PUBLISHED')
  if (projectError) {
    throw toRepositoryError(ENTITY, 'list-projects-pointing', productId, projectError)
  }
  return (projects ?? []).map((row) => ({ id: row.id, title: row.title }))
}

/** Which of these products have at least one outward edge. The workspace's coverage count. */
export async function listProductIdsWithRelations(
  client: Client,
  productIds: readonly string[],
): Promise<Set<string>> {
  if (productIds.length === 0) return new Set()
  const { data, error } = await client
    .from('product_relations')
    .select('source_product_id')
    .in('source_product_id', [...productIds])
  if (error) throw toRepositoryError(ENTITY, 'list-with-relations', 'coverage', error)
  return new Set((data ?? []).map((row) => row.source_product_id))
}

// --- Phase 23: the writes -----------------------------------------------------------------------
//
// `lib/relations/write.ts` composes these into the four editor gestures — accept, dismiss, create,
// remove — and owns the reciprocity and the compensation. What lives here is one statement each,
// because that is what a repository is, and because `check-data-layer.mjs` requires it.
//
// EVERY WRITE RETURNS WHAT IT WROTE, OR NULL. RLS FILTERS A WRITE, IT DOES NOT REFUSE ONE: a role
// the policy does not admit changes nothing and is told it worked. Returning the row is how the
// caller can tell the two apart, and `null` is what makes a `PermissionError` possible upstairs.

export type RelationTable = 'product_relations' | 'content_relations'

export interface NewRelationEdge {
  readonly sourceType: string
  readonly sourceId: string
  readonly targetType: string
  readonly targetId: string
  readonly relationType: string
  readonly sortOrder: number
  readonly origin: 'EDITOR' | 'RULE_ACCEPTED'
  readonly ruleKey: string | null
  readonly note: string | null
}

/** The next free position within one relation type. `-1 + 1` when the group is empty. */
export async function nextRelationSortOrder(
  client: Client,
  edge: Pick<NewRelationEdge, 'sourceType' | 'sourceId' | 'relationType'>,
): Promise<number> {
  if (edge.sourceType === 'product') {
    const { data, error } = await client
      .from('product_relations')
      .select('sort_order')
      .eq('source_product_id', edge.sourceId)
      .eq('relation_type', edge.relationType)
      .order('sort_order', { ascending: false })
      .limit(1)
    if (error) throw toRepositoryError(ENTITY, 'next-sort-order', edge.sourceId, error)
    return (data?.[0]?.sort_order ?? -1) + 1
  }

  const { data, error } = await client
    .from('content_relations')
    .select('sort_order')
    .eq('source_type', edge.sourceType)
    .eq('source_id', edge.sourceId)
    .eq('relation_type', edge.relationType)
    .order('sort_order', { ascending: false })
    .limit(1)
  if (error) throw toRepositoryError(ENTITY, 'next-sort-order', edge.sourceId, error)
  return (data?.[0]?.sort_order ?? -1) + 1
}

/** Insert one edge. Throws the raw PostgREST error so the caller can recognise a unique violation. */
export async function insertRelationEdge(
  client: Client,
  edge: NewRelationEdge,
  actorId: string | null,
): Promise<{ id: string } | null> {
  if (edge.sourceType === 'product') {
    const { data, error } = await client
      .from('product_relations')
      .insert({
        source_product_id: edge.sourceId,
        target_type: edge.targetType,
        target_id: edge.targetId,
        relation_type: edge.relationType,
        sort_order: edge.sortOrder,
        origin: edge.origin,
        rule_key: edge.ruleKey,
        note: edge.note,
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
      source_type: edge.sourceType,
      source_id: edge.sourceId,
      target_type: edge.targetType,
      target_id: edge.targetId,
      relation_type: edge.relationType,
      sort_order: edge.sortOrder,
      origin: edge.origin,
      rule_key: edge.ruleKey,
      note: edge.note,
      created_by: actorId,
    })
    .select('id')
    .maybeSingle()
  if (error !== null) throw error
  return data
}

/** The existing edge with this identity, or null. How a duplicate insert is resolved. */
export async function findRelationEdge(
  client: Client,
  edge: Pick<
    NewRelationEdge,
    'sourceType' | 'sourceId' | 'targetType' | 'targetId' | 'relationType'
  >,
): Promise<{ id: string; paired_relation_id: string | null } | null> {
  if (edge.sourceType === 'product') {
    const { data, error } = await client
      .from('product_relations')
      .select('id, paired_relation_id')
      .eq('source_product_id', edge.sourceId)
      .eq('target_type', edge.targetType)
      .eq('target_id', edge.targetId)
      .eq('relation_type', edge.relationType)
      .maybeSingle()
    if (error) throw toRepositoryError(ENTITY, 'find-edge', edge.sourceId, error)
    return data ?? null
  }

  const { data, error } = await client
    .from('content_relations')
    .select('id, paired_relation_id')
    .eq('source_type', edge.sourceType)
    .eq('source_id', edge.sourceId)
    .eq('target_type', edge.targetType)
    .eq('target_id', edge.targetId)
    .eq('relation_type', edge.relationType)
    .maybeSingle()
  if (error) throw toRepositoryError(ENTITY, 'find-edge', edge.sourceId, error)
  return data ?? null
}

/** Point one edge at its inverse. Called twice, once per direction. */
export async function setPairedRelation(
  client: Client,
  table: RelationTable,
  id: string,
  pairedId: string | null,
): Promise<void> {
  const { error } = await client.from(table).update({ paired_relation_id: pairedId }).eq('id', id)
  if (error) throw toRepositoryError(ENTITY, 'set-paired', id, error)
}

export async function getRelationEdge(
  client: Client,
  table: RelationTable,
  id: string,
): Promise<{ id: string; paired_relation_id: string | null } | null> {
  const { data, error } = await client
    .from(table)
    .select('id, paired_relation_id')
    .eq('id', id)
    .maybeSingle()
  if (error) throw toRepositoryError(ENTITY, 'get-edge', id, error)
  return data ?? null
}

/**
 * Remove one edge by id, from whichever table holds it.
 *
 * BOTH TABLES ARE ASKED when the caller does not know which one, and a delete matching nothing is
 * free. The alternative — recording the table name on `paired_relation_id` — would be a third
 * thing that can disagree with the other two.
 */
export async function deleteRelationEdge(
  client: Client,
  table: RelationTable,
  id: string,
): Promise<void> {
  const { error } = await client.from(table).delete().eq('id', id)
  if (error) throw toRepositoryError(ENTITY, 'delete-edge', id, error)
}

export async function updateRelationSortOrder(
  client: Client,
  table: RelationTable,
  id: string,
  sortOrder: number,
): Promise<void> {
  const { error } = await client.from(table).update({ sort_order: sortOrder }).eq('id', id)
  if (error) throw toRepositoryError(ENTITY, 'reorder', id, error)
}

/** Record a dismissal. Idempotent on the (source, target, rule) triple. */
export async function upsertRelationSuppression(
  client: Client,
  entry: {
    readonly sourceType: string
    readonly sourceId: string
    readonly targetType: string
    readonly targetId: string
    readonly ruleKey: string
    readonly reason: string | null
  },
  actorId: string | null,
): Promise<{ id: string } | null> {
  const { data, error } = await client
    .from('relation_suppressions')
    .upsert(
      {
        source_type: entry.sourceType,
        source_id: entry.sourceId,
        target_type: entry.targetType,
        target_id: entry.targetId,
        rule_key: entry.ruleKey,
        reason: entry.reason,
        suppressed_by: actorId,
      },
      { onConflict: 'source_type,source_id,target_type,target_id,rule_key' },
    )
    .select('id')
    .maybeSingle()
  if (error) throw toRepositoryError(ENTITY, 'suppress', entry.sourceId, error)
  return data ?? null
}

/** Un-dismiss. An editor may change their mind, and the suggestion becomes proposable again. */
export async function deleteRelationSuppression(
  client: Client,
  entry: {
    readonly sourceType: string
    readonly sourceId: string
    readonly targetType: string
    readonly targetId: string
    readonly ruleKey: string
  },
): Promise<void> {
  const { error } = await client
    .from('relation_suppressions')
    .delete()
    .eq('source_type', entry.sourceType)
    .eq('source_id', entry.sourceId)
    .eq('target_type', entry.targetType)
    .eq('target_id', entry.targetId)
    .eq('rule_key', entry.ruleKey)
  if (error) throw toRepositoryError(ENTITY, 'unsuppress', entry.sourceId, error)
}
