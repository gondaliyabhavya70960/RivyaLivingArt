import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/database.types'
import {
  getProductSlug,
  listArticlesLinkingTo,
  listCollectionSiblings,
  listConnectedTargets,
  listMaterialOverlaps,
  listProjectsPointingAtProduct,
  listSuppressedSuggestions,
} from '@/lib/supabase/repositories/relations'
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
 * NOTHING HERE WRITES, AND NOTHING HERE QUERIES EITHER. Every read goes through
 * `lib/supabase/repositories/relations.ts`, which is the Phase 03 rule and which
 * `scripts/db/check-data-layer.mjs` enforces — it caught the first draft of this file holding its
 * own `.from()` calls. What is left here is the four rules as arithmetic over what the repository
 * returns, which is the right shape anyway: the filters a rule could most easily get subtly wrong
 * (an unpublished sibling, a concept collection) now sit together beside the queries.
 *
 * `tests/unit/relation-rules.test.ts` asserts that this module exports no function whose name
 * matches a mutation and that its source contains no `.insert(`/`.update(`/`.delete(`/`.rpc(`. A
 * rule that persisted would make the `origin` column a lie: a row would exist that no editor
 * accepted, and "where did this relation come from" would have no answer.
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

/**
 * TWO SHARED MATERIALS, NOT ONE.
 *
 * Named rather than inlined because the number IS the rule: at one, almost everything this
 * workshop makes contains resin and the catalogue connects to itself.
 */
export const SHARED_MATERIAL_MINIMUM = 2

const edgeKey = (targetType: string, targetId: string, ruleKey: string): string =>
  `${targetType}:${targetId}:${ruleKey}`

const targetKey = (targetType: string, targetId: string): string => `${targetType}:${targetId}`

async function loadExclusions(client: Client, source: SuggestionSource): Promise<Excluded> {
  const [existing, suppressed] = await Promise.all([
    listConnectedTargets(client, source),
    listSuppressedSuggestions(client, source),
  ])
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
 * RELIABLE BECAUSE AN EDITOR DELIBERATELY PUT BOTH IN THAT COLLECTION. The repository applies the
 * two filters that make the claim true — the collection must be PUBLISHED and out of concept, and
 * the sibling must be PUBLISHED — so what is left here is de-duplication and the exclusion test.
 */
async function sameCollection(
  client: Client,
  productId: string,
  excluded: Excluded,
): Promise<Suggestion[]> {
  const siblings = await listCollectionSiblings(client, productId)

  const seen = new Set<string>()
  const out: Suggestion[] = []
  for (const sibling of siblings) {
    if (seen.has(sibling.productId)) continue
    if (!admits(excluded, 'product', sibling.productId, 'same-collection')) continue
    seen.add(sibling.productId)
    out.push({
      ruleKey: 'same-collection',
      reasonKey: RULE_REASON_KEY['same-collection'],
      relationType: RULE_RELATION_TYPE['same-collection'],
      targetType: 'product',
      targetId: sibling.productId,
      targetTitle: sibling.productTitle,
      evidence: [sibling.collectionName],
    })
  }
  return out
}

/**
 * `shared-materials` — products sharing at least TWO materials.
 *
 * TWO, NOT ONE, AND THE THRESHOLD IS THE RULE. Nearly everything this workshop makes contains
 * resin; one shared material would connect the entire catalogue to itself and propose a hundred
 * edges nobody wants. Two shared materials is a specification an editor chose twice. The number is
 * passed to the repository rather than applied afterwards, so the query and the rule agree.
 */
async function sharedMaterials(
  client: Client,
  productId: string,
  excluded: Excluded,
): Promise<Suggestion[]> {
  const overlaps = await listMaterialOverlaps(client, productId, SHARED_MATERIAL_MINIMUM)

  const out: Suggestion[] = []
  for (const overlap of overlaps) {
    if (!admits(excluded, 'product', overlap.productId, 'shared-materials')) continue
    out.push({
      ruleKey: 'shared-materials',
      reasonKey: RULE_REASON_KEY['shared-materials'],
      relationType: RULE_RELATION_TYPE['shared-materials'],
      targetType: 'product',
      targetId: overlap.productId,
      targetTitle: overlap.productTitle,
      evidence: overlap.materialNames,
    })
  }
  return out
}

/**
 * `journal-linked-product` — a published article whose page links to `/product/<slug>`.
 *
 * RELIABLE BECAUSE THE AUTHOR TYPED THE LINK. It matches on the product's SLUG rather than its
 * title: a link is a fact, a title mention is a coincidence.
 */
async function journalLinkedProduct(
  client: Client,
  productId: string,
  excluded: Excluded,
): Promise<Suggestion[]> {
  const slug = await getProductSlug(client, productId)
  if (slug === null) return []

  const path = `/product/${slug}`
  const articles = await listArticlesLinkingTo(client, path)

  const out: Suggestion[] = []
  for (const article of articles) {
    if (!admits(excluded, 'journal', article.id, 'journal-linked-product')) continue
    out.push({
      ruleKey: 'journal-linked-product',
      reasonKey: RULE_REASON_KEY['journal-linked-product'],
      relationType: RULE_RELATION_TYPE['journal-linked-product'],
      targetType: 'journal',
      targetId: article.id,
      targetTitle: article.title,
      evidence: [path],
    })
  }
  return out
}

/**
 * `project-featured-product` — a published project already points at this product, so propose the
 * inverse.
 *
 * RELIABLE BECAUSE THE FORWARD EDGE ALREADY EXISTS AND SOMEBODY MADE IT BY HAND. This rule adds no
 * judgement at all; it notices an asymmetry and offers to close it.
 */
async function projectFeaturedProduct(
  client: Client,
  productId: string,
  excluded: Excluded,
): Promise<Suggestion[]> {
  const projects = await listProjectsPointingAtProduct(client, productId)

  const out: Suggestion[] = []
  for (const project of projects) {
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
