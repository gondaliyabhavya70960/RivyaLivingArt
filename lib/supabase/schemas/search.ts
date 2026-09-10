import { z } from 'zod'

import type { Enums, Tables } from '../database.types'
import { contentStatusSchema, timestampSchema, uuidSchema } from './common'
import { ownerVerificationSchema, factClassificationSchema } from './common'

/**
 * Zod mirrors of the Phase 23 tables: the two search indexes, the query log, and the relationship
 * model.
 *
 * THE ENTITY-TYPE UNIONS ARE WRITTEN OUT RATHER THAN LEFT AS `z.string()`, and that is the point of
 * this file. `search_documents.entity_type` is `text` with a CHECK constraint, so the generated
 * type is `string` and a repository could hand a renderer `'research_product'` with the compiler
 * saying nothing. Parsing narrows it back, so the switch in `SearchResultCard` is exhaustive and a
 * ninth type added later fails to compile instead of rendering as a blank card.
 */

export const searchVisibilitySchema = z.enum(['PUBLIC', 'STAFF']) satisfies z.ZodType<
  Enums<'search_visibility'>
>

export const relationOriginSchema = z.enum(['EDITOR', 'RULE_ACCEPTED']) satisfies z.ZodType<
  Enums<'relation_origin'>
>

export const attributeTaxonomySchema = z.enum([
  'DESIGN_FAMILY',
  'RESIN_STYLE',
  'WOOD_SPECIES',
]) satisfies z.ZodType<Enums<'attribute_taxonomy'>>

/**
 * The eight indexable types, in the order results are grouped for a visitor.
 *
 * THE ORDER IS FIXED AND IS NOT A RANKING. FEAT §18 asks for grouped results; a group order that
 * moved with relevance would make the page rearrange itself between two similar queries, and a
 * reader who found Journal below Portfolio once would look there again. Products first because the
 * catalogue is what the site is for.
 */
export const PUBLIC_ENTITY_TYPES = [
  'product',
  'collection',
  'category',
  'portfolio_project',
  'journal_article',
] as const

export const STAFF_ENTITY_TYPES = ['material', 'media_asset', 'inquiry'] as const

export const SEARCH_ENTITY_TYPES = [...PUBLIC_ENTITY_TYPES, ...STAFF_ENTITY_TYPES] as const

export type PublicEntityType = (typeof PUBLIC_ENTITY_TYPES)[number]
export type SearchEntityType = (typeof SEARCH_ENTITY_TYPES)[number]

export const searchEntityTypeSchema = z.enum(SEARCH_ENTITY_TYPES)
export const publicEntityTypeSchema = z.enum(PUBLIC_ENTITY_TYPES)

/**
 * The twelve status tokens the column admits — `content_status` for the seven content types and
 * `inquiry_status` for an enquiry, with ARCHIVED shared. Deliberately not `contentStatusSchema`:
 * see the note in migration 0210 on why the column is text.
 */
export const searchDocumentStatusSchema = z.enum([
  'DRAFT',
  'REVIEW',
  'APPROVED',
  'PUBLISHED',
  'ARCHIVED',
  'NEW',
  'READ',
  'IN_CONVERSATION',
  'QUOTED',
  'WON',
  'LOST',
  'SPAM',
])

/**
 * A row of the index, as a repository returns it.
 *
 * `search_vector` IS ABSENT AND THAT IS DELIBERATE. It is a `tsvector` the database ranks with; no
 * caller has any use for it, it is the largest column in the row, and selecting it would move a
 * lexeme dump across the wire on every search. The repositories select an explicit column list.
 */
export const searchDocumentSchema = z.object({
  id: uuidSchema,
  entity_type: searchEntityTypeSchema,
  entity_id: uuidSchema,
  visibility: searchVisibilitySchema,
  status: searchDocumentStatusSchema,
  url_path: z.string().nullable(),
  title: z.string(),
  subtitle: z.string().nullable(),
  body: z.string().nullable(),
  keywords: z.array(z.string()),
  image_media_id: uuidSchema.nullable(),
  category_slug: z.string().nullable(),
  indexed_at: timestampSchema,
})

export type SearchDocument = z.infer<typeof searchDocumentSchema>

export const searchQuerySchema = z.object({
  id: uuidSchema,
  query_text: z.string(),
  normalized_query: z.string(),
  scope: z.enum(['PUBLIC', 'STUDIO']),
  result_count: z.number().int().nonnegative(),
  staff_user_id: uuidSchema.nullable(),
  occurred_at: timestampSchema,
}) satisfies z.ZodType<Tables<'search_queries'>>

export type SearchQueryLog = z.infer<typeof searchQuerySchema>

/** The nine relation names 0213 fixes. One list, mirrored by `is_relation_type()` in SQL. */
export const RELATION_VOCABULARY = [
  'RELATED_PRODUCT',
  'PORTFOLIO_PROJECT',
  'JOURNAL_ARTICLE',
  'DESIGN_FAMILY',
  'RESIN_STYLE',
  'WOOD_SPECIES',
  'CUSTOMIZATION_FORM',
  'MATERIAL_STORY',
  'DESIGN_DIRECTION',
] as const

export type RelationVocabulary = (typeof RELATION_VOCABULARY)[number]
export const relationVocabularySchema = z.enum(RELATION_VOCABULARY)

/**
 * The three types whose edges are created in both directions.
 *
 * A "related product" that is related in one direction only is a claim that A goes with B but B
 * does not go with A, which no editor means. The other six are one-way by nature: a product is in
 * a design family, the family is not "in" the product.
 */
export const RECIPROCAL_RELATION_TYPES = [
  'RELATED_PRODUCT',
  'PORTFOLIO_PROJECT',
  'JOURNAL_ARTICLE',
] as const

export function isReciprocal(relationType: string): boolean {
  return (RECIPROCAL_RELATION_TYPES as readonly string[]).includes(relationType)
}

/** What an edge may point at. Mirrors `is_relation_target()` in SQL. Lower-case; see 0213. */
export const RELATION_TARGETS = [
  'product',
  'collection',
  'portfolio',
  'journal',
  'material',
  'attribute_term',
] as const

export type RelationTarget = (typeof RELATION_TARGETS)[number]
export const relationTargetSchema = z.enum(RELATION_TARGETS)

/** The three tables a `content_relations` row may hang off. */
export const CONTENT_RELATION_SOURCES = [
  'portfolio_project',
  'journal_article',
  'collection',
] as const

export type ContentRelationSource = (typeof CONTENT_RELATION_SOURCES)[number]
export const contentRelationSourceSchema = z.enum(CONTENT_RELATION_SOURCES)

export const contentRelationSchema = z.object({
  id: uuidSchema,
  source_type: contentRelationSourceSchema,
  source_id: uuidSchema,
  target_type: relationTargetSchema,
  target_id: uuidSchema,
  relation_type: relationVocabularySchema,
  sort_order: z.number().int(),
  origin: relationOriginSchema,
  rule_key: z.string().nullable(),
  note: z.string().nullable(),
  paired_relation_id: uuidSchema.nullable(),
  created_at: timestampSchema,
  created_by: uuidSchema.nullable(),
})

export type ContentRelation = z.infer<typeof contentRelationSchema>

export const relationSuppressionSchema = z.object({
  id: uuidSchema,
  source_type: z.string(),
  source_id: uuidSchema,
  target_type: relationTargetSchema,
  target_id: uuidSchema,
  rule_key: z.string(),
  reason: z.string().nullable(),
  suppressed_by: uuidSchema.nullable(),
  suppressed_at: timestampSchema,
})

export type RelationSuppression = z.infer<typeof relationSuppressionSchema>

export const productAttributeTermSchema = z.object({
  id: uuidSchema,
  taxonomy: attributeTaxonomySchema,
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  sort_order: z.number().int(),
  status: contentStatusSchema,
  owner_verification: ownerVerificationSchema,
  fact_classification: factClassificationSchema,
  published_at: timestampSchema.nullable(),
  published_by: uuidSchema.nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  updated_by: uuidSchema.nullable(),
}) satisfies z.ZodType<Tables<'product_attribute_terms'>>

export type ProductAttributeTerm = z.infer<typeof productAttributeTermSchema>
