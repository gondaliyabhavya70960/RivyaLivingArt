import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/database.types'
import type { RelationTarget, RelationVocabulary } from '@/lib/supabase/schemas'

type Client = SupabaseClient<Database>

/**
 * The four suggestion rules, and the reason there are exactly four.
 *
 * FEAT §11 PERMITS AN AUTOMATIC RELATION ONLY WHERE A RELIABLE RULE EXISTS. Everything in this file
 * is therefore a rule somebody could defend out loud: two pieces are related because an editor put
 * both in the same collection, or because they share two materials, or because an author linked one
 * from an article, or because the opposite edge already exists and was made by hand. Each is a
 * decision a person already made; the rule only notices it.
 *
 * NOTHING HERE WRITES. Not one function in this module takes a writable client, and
 * `tests/unit/relation-rules.test.ts` asserts that the module exports no function whose name
 * matches a mutation and that its source contains no `.insert(`/`.update(`/`.delete(`. A rule that
 * persisted would make the `origin` column a lie: a row would exist that no editor accepted, and
 * "where did this relation come from" would have no answer.
 *
 * EXPLICITLY NOT RULES, and each for a stated reason:
 *   view-count affinity     — there is no view counter, and FEAT §28 forbids manufacturing one
 *   price-band affinity     — most products have no price at all (REQUEST_QUOTE), so the band is
 *                             absent for exactly the pieces the rule would matter for
 *   title similarity        — "Resin River Table" and "Resin Wall Panel" share two words and
 *                             nothing else; this rule proposes noise and calls it insight
 *   image similarity        — Phase 33, and even then research-only
 *   "customers also viewed" — there are no customer accounts (D1), so the sentence is false before
 *                             the arithmetic starts
 *
 * A DISMISSED SUGGESTION NEVER RETURNS. Every rule filters against `relation_suppressions` before
 * it proposes, so an editor's "no" is permanent. That is not politeness: a suggestions panel that
 * re-proposes what was rejected is a panel people learn to ignore, and an ignored panel is worse
 * than no panel because it still occupies the screen.
 */

export const RULE_KEYS = [
  'same-collection',
  'shared-materials',
  'journal-linked-product',
  'project-featured-product',
] as const

export type RuleKey = (typeof RULE_KEYS)[number]

/** What each rule proposes, and the `relation_type` an accepted suggestion is written with. */
export const RULE_RELATION_TYPE: Record<RuleKey, RelationVocabulary> = {
  'same-collection': 'RELATED_PRODUCT',
  'shared-materials': 'RELATED_PRODUCT',
  'journal-linked-product': 'JOURNAL_ARTICLE',
  'project-featured-product': 'PORTFOLIO_PROJECT',
}

/**
 * A `global_content` key per rule, so the reason a reader sees is editable copy rather than a
 * sentence compiled into a library. The rules themselves are code; what they SAY is content.
 */
export const RULE_REASON_KEY: Record<RuleKey, string> = {
  'same-collection': 'relations.rule.same_collection',
  'shared-materials': 'relations.rule.shared_materials',
  'journal-linked-product': 'relations.rule.journal_linked_product',
  'project-featured-product': 'relations.rule.project_featured_product',
}

export interface Suggestion {
  readonly ruleKey: RuleKey
  /** The `global_content` key for the human-readable reason. Never a literal. */
  readonly reasonKey: string
  readonly relationType: RelationVocabulary
  readonly targetType: RelationTarget
  readonly targetId: string
  /** The target's own title, read from the row so the panel does not have to fetch again. */
  readonly targetTitle: string
  /**
   * What the rule actually observed — the collection's name, the two shared materials, the
   * article's title. Rendered after the reason so an editor can check the rule's working rather
   * than trusting it.
   */
  readonly evidence: readonly string[]
}

export interface SuggestionSource {
  readonly type: 'product' | 'portfolio_project' | 'journal_article' | 'collection'
  readonly id: string
}

/** Everything already connected or already refused, so no rule proposes it again. */
interface Excluded {
  readonly existing: ReadonlySet<string>
  readonly suppressed: ReadonlySet<string>
}

const edgeKey = (targetType: string, targetId: string, ruleKey: string): string =>
  `${targetType}:${targetId}:${ruleKey}`

const targetKey = (targetType: string, targetId: string): string => `${targetType}:${targetId}`

async function loadExclusions(client: Client, source: SuggestionSource): Promise<Excluded> {
  const existing = new Set<string>()
  const suppressed = new Set<string>()

  if (source.type === 'product') {
    const { data } = await client
      .from('product_relations')
      .select('target_type, target_id')
      .eq('source_product_id', source.id)
    for (const row of data ?? []) existing.add(targetKey(row.target_type, row.target_id))
  } else {
    const { data } = await client
      .from('content_relations')
      .select('target_type, target_id')
      .eq('source_type', source.type)
      .eq('source_id', source.id)
    for (const row of data ?? []) existing.add(targetKey(row.target_type, row.target_id))
  }

  const { data: dismissals } = await client
    .from('relation_suppressions')
    .select('target_type, target_id, rule_key')
    .eq('source_type', source.type)
    .eq('source_id', source.id)
  for (const row of dismissals ?? []) {
    suppressed.add(edgeKey(row.target_type, row.target_id, row.rule_key))
  }

  return { existing, suppressed }
}

function admits(excluded: Excluded, targetType: string, targetId: string, rule: RuleKey): boolean {
  if (excluded.existing.has(targetKey(targetType, targetId))) return false
  if (excluded.suppressed.has(edgeKey(targetType, targetId, rule))) return false
  return true
}

/**
 * `same-collection` — products sharing a published collection.
 *
 * RELIABLE BECAUSE AN EDITOR DELIBERATELY PUT BOTH IN THAT COLLECTION. The collection must be
 * PUBLISHED and out of concept: FEAT §9's `DRAFT_COLLECTION_CONCEPT` rows are ideas, and two
 * products sitting in an idea are not related by anything yet.
 */
async function sameCollection(
  client: Client,
  productId: string,
  excluded: Excluded,
): Promise<Suggestion[]> {
  const { data: memberships } = await client
    .from('product_collections')
    .select('collection_id, collections!inner(id, name, status, concept_state)')
    .eq('product_id', productId)

  const out: Suggestion[] = []
  const seen = new Set<string>()

  for (const membership of memberships ?? []) {
    const collection = membership.collections as unknown as {
      id: string
      name: string
      status: string
      concept_state: string
    } | null
    if (collection === null) continue
    if (collection.status !== 'PUBLISHED') continue
    if (collection.concept_state === 'DRAFT_COLLECTION_CONCEPT') continue

    const { data: siblings } = await client
      .from('product_collections')
      .select('product_id, products!inner(id, title, status)')
      .eq('collection_id', collection.id)

    for (const sibling of siblings ?? []) {
      const product = sibling.products as unknown as {
        id: string
        title: string
        status: string
      } | null
      if (product === null || product.id === productId) continue
      if (product.status !== 'PUBLISHED') continue
      if (seen.has(product.id)) continue
      if (!admits(excluded, 'product', product.id, 'same-collection')) continue
      seen.add(product.id)
      out.push({
        ruleKey: 'same-collection',
        reasonKey: RULE_REASON_KEY['same-collection'],
        relationType: RULE_RELATION_TYPE['same-collection'],
        targetType: 'product',
        targetId: product.id,
        targetTitle: product.title,
        evidence: [collection.name],
      })
    }
  }

  return out
}

/**
 * `shared-materials` — products sharing at least TWO materials.
 *
 * TWO, NOT ONE, AND THE THRESHOLD IS THE RULE. Nearly everything this workshop makes contains
 * resin; one shared material would connect the entire catalogue to itself and propose a hundred
 * edges nobody wants. Two shared materials is a specification an editor chose twice.
 */
async function sharedMaterials(
  client: Client,
  productId: string,
  excluded: Excluded,
): Promise<Suggestion[]> {
  const { data: mine } = await client
    .from('product_materials')
    .select('material_id, materials!inner(id, name)')
    .eq('product_id', productId)

  const materialIds = (mine ?? []).map((row) => row.material_id)
  if (materialIds.length < 2) return []

  const names = new Map<string, string>()
  for (const row of mine ?? []) {
    const material = row.materials as unknown as { id: string; name: string } | null
    if (material !== null) names.set(material.id, material.name)
  }

  const { data: others } = await client
    .from('product_materials')
    .select('product_id, material_id, products!inner(id, title, status)')
    .in('material_id', materialIds)

  const shared = new Map<string, { title: string; materials: string[] }>()
  for (const row of others ?? []) {
    if (row.product_id === productId) continue
    const product = row.products as unknown as { id: string; title: string; status: string } | null
    if (product === null || product.status !== 'PUBLISHED') continue
    const entry = shared.get(product.id) ?? { title: product.title, materials: [] }
    const name = names.get(row.material_id)
    if (name !== undefined) entry.materials.push(name)
    shared.set(product.id, entry)
  }

  const out: Suggestion[] = []
  for (const [targetId, entry] of shared) {
    if (entry.materials.length < 2) continue
    if (!admits(excluded, 'product', targetId, 'shared-materials')) continue
    out.push({
      ruleKey: 'shared-materials',
      reasonKey: RULE_REASON_KEY['shared-materials'],
      relationType: RULE_RELATION_TYPE['shared-materials'],
      targetType: 'product',
      targetId,
      targetTitle: entry.title,
      evidence: [...entry.materials].sort(),
    })
  }
  return out
}

/**
 * `journal-linked-product` — a published article whose body links to `/product/<slug>`.
 *
 * RELIABLE BECAUSE THE AUTHOR TYPED THE LINK. The article body lives in `page_sections`, so the
 * rule reads the section content rather than the article row; that is also why it matches on the
 * product's SLUG rather than its title — a link is a fact, a title mention is a coincidence.
 */
async function journalLinkedProduct(
  client: Client,
  productId: string,
  excluded: Excluded,
): Promise<Suggestion[]> {
  const { data: product } = await client
    .from('products')
    .select('slug')
    .eq('id', productId)
    .maybeSingle()
  if (product === null || product === undefined) return []

  const needle = `/product/${product.slug}`

  const { data: articles } = await client
    .from('journal_articles')
    .select('id, title, slug, page_id, status')
    .eq('status', 'PUBLISHED')

  const out: Suggestion[] = []
  for (const article of articles ?? []) {
    if (article.page_id === null) continue
    // THE LINK CAN BE IN ANY OF FOUR PLACES, so all four are read rather than only `body`: prose
    // (`body`, `supporting`), either call to action (`cta_url`, `cta_secondary_url`), or a block's
    // own `payload`. An author who linked the piece from a button linked it just as deliberately as
    // one who linked it mid-sentence, and a rule that noticed only the sentence would be a rule
    // that quietly depends on how somebody chose to lay a page out.
    const { data: sections } = await client
      .from('page_sections')
      .select('body, supporting, cta_url, cta_secondary_url, payload')
      .eq('page_id', article.page_id)
      .eq('status', 'PUBLISHED')

    const linked = (sections ?? []).some((section) =>
      [
        section.body,
        section.supporting,
        section.cta_url,
        section.cta_secondary_url,
        section.payload === null ? '' : JSON.stringify(section.payload),
      ].some((field) => typeof field === 'string' && field.includes(needle)),
    )
    if (!linked) continue
    if (!admits(excluded, 'journal', article.id, 'journal-linked-product')) continue

    out.push({
      ruleKey: 'journal-linked-product',
      reasonKey: RULE_REASON_KEY['journal-linked-product'],
      relationType: RULE_RELATION_TYPE['journal-linked-product'],
      targetType: 'journal',
      targetId: article.id,
      targetTitle: article.title,
      evidence: [needle],
    })
  }
  return out
}

/**
 * `project-featured-product` — a published project already points at this product, so propose the
 * inverse.
 *
 * RELIABLE BECAUSE THE FORWARD EDGE ALREADY EXISTS AND SOMEBODY MADE IT BY HAND. This rule adds no
 * new judgement at all; it notices an asymmetry and offers to close it.
 */
async function projectFeaturedProduct(
  client: Client,
  productId: string,
  excluded: Excluded,
): Promise<Suggestion[]> {
  const { data: edges } = await client
    .from('content_relations')
    .select('source_id, portfolio_projects:source_id(id, title, status)')
    .eq('source_type', 'portfolio_project')
    .eq('target_type', 'product')
    .eq('target_id', productId)

  const out: Suggestion[] = []
  for (const edge of edges ?? []) {
    const { data: project } = await client
      .from('portfolio_projects')
      .select('id, title, status')
      .eq('id', edge.source_id)
      .maybeSingle()
    if (project === null || project === undefined) continue
    if (project.status !== 'PUBLISHED') continue
    if (!admits(excluded, 'portfolio', project.id, 'project-featured-product')) continue

    out.push({
      ruleKey: 'project-featured-product',
      reasonKey: RULE_REASON_KEY['project-featured-product'],
      relationType: RULE_RELATION_TYPE['project-featured-product'],
      targetType: 'portfolio',
      targetId: project.id,
      targetTitle: project.title,
      evidence: [project.title],
    })
  }
  return out
}

/**
 * Every suggestion for one source, from every rule that applies to it.
 *
 * READ-ONLY, and the signature says so as loudly as a signature can: the client is used for
 * `.select()` and nothing else, and the return value is a list of proposals with no ids of their
 * own. An accepted proposal becomes an edge in `lib/relations/write.ts`, which is a different file
 * requiring a different permission.
 */
export async function suggestRelations(
  client: Client,
  source: SuggestionSource,
): Promise<Suggestion[]> {
  const excluded = await loadExclusions(client, source)

  // Three of the four rules take a product on the source side. A project or an article asking for
  // suggestions gets an empty list rather than an error: there is no reliable rule for them yet,
  // and inventing one to fill the panel is precisely what FEAT §11 forbids.
  if (source.type !== 'product') return []

  const [collection, materials, journal, project] = await Promise.all([
    sameCollection(client, source.id, excluded),
    sharedMaterials(client, source.id, excluded),
    journalLinkedProduct(client, source.id, excluded),
    projectFeaturedProduct(client, source.id, excluded),
  ])

  return [...collection, ...materials, ...journal, ...project]
}
