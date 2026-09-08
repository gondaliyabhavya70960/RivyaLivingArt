import { z } from 'zod'

import type { Tables } from '../database.types'
import {
  auditColumns,
  collectionConceptStateSchema,
  contentColumns,
  jsonSchema,
  mediaKindSchema,
  mediaSourceSchema,
  priceStateSchema,
  seedColumns,
  timestampSchema,
  uuidSchema,
} from './common'

/**
 * Row schemas for the Phase 03 entities.
 *
 * Every schema carries `satisfies z.ZodType<Tables<'...'>>`. That is what ties this file to the
 * generated types, and through them to the migrations: drop a column from a schema and the
 * annotation stops compiling, because the parsed output no longer covers the generated Row type.
 * A schema is therefore never quietly out of date with the database — `npm run typecheck` says so.
 *
 * These validate on the way OUT of the database as well as in. A row that fails here means the
 * database contains something the model calls impossible; see ValidationError in ../errors.ts for
 * why that is worth failing on rather than passing through.
 */

export const categorySchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  parent_id: uuidSchema.nullable(),
  name: z.string(),
  subtitle: z.string().nullable(),
  description: z.string().nullable(),
  sort_order: z.number().int(),
  is_primary: z.boolean(),
  hero_media_id: uuidSchema.nullable(),
  seo_title: z.string().nullable(),
  seo_description: z.string().nullable(),
  ...auditColumns,
  ...contentColumns,
  ...seedColumns,
}) satisfies z.ZodType<Tables<'categories'>>

export const collectionSchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  name: z.string(),
  statement: z.string().nullable(),
  concept_state: collectionConceptStateSchema,
  hero_media_id: uuidSchema.nullable(),
  sort_order: z.number().int(),
  ...auditColumns,
  ...contentColumns,
  ...seedColumns,
}) satisfies z.ZodType<Tables<'collections'>>

export const materialSchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  name: z.string(),
  // Mirrors the check constraint in 0004_taxonomy.sql. Kept as a Zod enum rather than a plain
  // string so a bad family is caught before the round trip, with a field-level message.
  family: z.enum(['resin', 'timber', 'metal', 'stone', 'finish']),
  description: z.string().nullable(),
  ...auditColumns,
  ...contentColumns,
  ...seedColumns,
}) satisfies z.ZodType<Tables<'materials'>>

export const mediaAssetSchema = z.object({
  id: uuidSchema,
  provider: z.string(),
  resource_type: z.enum(['image', 'video', 'raw']),
  public_id: z.string(),
  folder: z.string(),
  filename: z.string().nullable(),
  rivya_asset_id: z.string().nullable(),
  kind: mediaKindSchema,
  // D6's three mandatory columns. `alt_text` is non-empty here as well as in the database,
  // because a blank alt text is worse than a missing one: it tells a screen reader the image
  // carries no information, when in fact nobody wrote the sentence yet.
  alt_text: z.string().min(1),
  is_ai_generated: z.boolean(),
  is_concept: z.boolean(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  aspect_ratio: z.string().nullable(),
  duration_s: z.number().nullable(),
  uploaded_by: uuidSchema.nullable(),

  // --- Phase 06 (0030_phase06_media.sql) ---------------------------------------------------------
  // `source` is the only one of these that is not nullable, and it is not `.optional()` either.
  // The column carries no default precisely so that provenance cannot be assumed, and a schema
  // that let it be omitted would hand back the default the migration refused to write.
  source: mediaSourceSchema,
  title: z.string().nullable(),
  caption: z.string().nullable(),
  tags: z.array(z.string()),
  subject_tags: z.array(z.string()),

  // Technical metadata. Every one of these is written from `MediaProvider.probe()`, never from a
  // client, so the schema's job here is to catch a provider response that changed shape — not to
  // police a form.
  mime_type: z.string().nullable(),
  bytes: z.number().int().positive().nullable(),
  checksum: z.string().nullable(),
  poster_public_id: z.string().nullable(),

  // 3D (FEAT §13). `model_format` mirrors the database's GLB|GLTF check rather than accepting any
  // string, so a row that no viewer could load fails here too and not only at the constraint.
  model_format: z.enum(['GLB', 'GLTF']).nullable(),
  file_size_bytes: z.number().int().positive().nullable(),
  poly_count: z.number().int().nonnegative().nullable(),
  texture_count: z.number().int().nonnegative().nullable(),
  model_thumbnail_id: uuidSchema.nullable(),
  model_poster_id: uuidSchema.nullable(),
  associated_product_id: uuidSchema.nullable(),
  // Validated as a uuid here even though the database has no foreign key on it until Phase 17.
  // The two are independent: the column's shape is knowable now, the referent is not.
  associated_project_id: uuidSchema.nullable(),

  // Higgsfield provenance, filled by the Phase 07 import.
  higgsfield_generation_id: z.string().nullable(),
  higgsfield_model: z.string().nullable(),
  higgsfield_prompt: z.string().nullable(),
  manifest_version: z.string().nullable(),
  migrated_at: timestampSchema.nullable(),

  ...auditColumns,
  ...contentColumns,
}) satisfies z.ZodType<Tables<'media_assets'>>

/**
 * The reverse index from 0030. `context_type` and `role` are Zod enums rather than plain strings
 * because the database stores them as text under a check constraint: without the enum here, a
 * typo'd `'THUMBNAIl'` would pass validation and fail at the constraint, which reports the row as
 * a database error rather than as the field-level mistake it is.
 */
export const mediaUsageSchema = z.object({
  id: uuidSchema,
  media_id: uuidSchema,
  context_type: z.enum([
    'PAGE_SECTION',
    'PRODUCT',
    'CATEGORY',
    'COLLECTION',
    'PORTFOLIO',
    'JOURNAL',
    'GLOBAL',
    'SEO',
  ]),
  context_id: uuidSchema,
  // Non-empty mirrors `media_usages_slot_key_present`. A blank slot key would bind an asset to
  // nothing while still counting as "used", which is exactly the state the Missing Media card
  // exists to detect.
  slot_key: z.string().min(1),
  role: z.enum(['DESKTOP', 'MOBILE', 'POSTER', 'THUMBNAIL', 'GALLERY', 'OG']),
  created_at: timestampSchema,
  created_by: uuidSchema.nullable(),
}) satisfies z.ZodType<Tables<'media_usages'>>

export const productSchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  sku: z.string().nullable(),
  title: z.string().nullable(),
  subtitle: z.string().nullable(),
  summary: z.string().nullable(),
  description: z.string().nullable(),
  category_id: uuidSchema.nullable(),
  price_state: priceStateSchema,
  price_from_minor: z.number().int().nullable(),
  currency: z.string().length(3).nullable(),
  is_large_format: z.boolean(),
  dimensions: jsonSchema.nullable(),
  hero_media_id: uuidSchema.nullable(),
  model_media_id: uuidSchema.nullable(),
  seo_title: z.string().nullable(),
  seo_description: z.string().nullable(),
  publication_readiness: jsonSchema,
  ...auditColumns,
  ...contentColumns,
  ...seedColumns,
}) satisfies z.ZodType<Tables<'products'>>

export const productRelationSchema = z.object({
  id: uuidSchema,
  source_product_id: uuidSchema,
  target_type: z.string(),
  target_id: uuidSchema,
  relation_type: z.string(),
  sort_order: z.number().int(),
  created_at: timestampSchema,
  created_by: uuidSchema.nullable(),
}) satisfies z.ZodType<Tables<'product_relations'>>

export type Category = z.infer<typeof categorySchema>
export type Collection = z.infer<typeof collectionSchema>
export type Material = z.infer<typeof materialSchema>
export type MediaAsset = z.infer<typeof mediaAssetSchema>
export type Product = z.infer<typeof productSchema>
export type ProductRelation = z.infer<typeof productRelationSchema>
