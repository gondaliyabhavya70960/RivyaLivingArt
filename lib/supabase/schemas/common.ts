import { z } from 'zod'

import type { Enums, Json } from '../database.types'

/**
 * Zod mirrors of the database enums, plus the column groups every content table shares.
 *
 * Each enum schema is annotated with the generated `Enums<'...'>` type. That annotation is the
 * point of this file: if a migration adds a value to `content_status` and nobody updates this
 * list, the annotation stops compiling — the schema's output type no longer covers the generated
 * union. Without it, the drift would surface at runtime as a ValidationError on a real row, in
 * production, for the one row that used the new value.
 */

export const contentStatusSchema = z.enum([
  'DRAFT',
  'REVIEW',
  'APPROVED',
  'PUBLISHED',
  'ARCHIVED',
]) satisfies z.ZodType<Enums<'content_status'>>

export const ownerVerificationSchema = z.enum([
  'NOT_REQUIRED',
  'OWNER_VERIFICATION_REQUIRED',
  'VERIFIED',
]) satisfies z.ZodType<Enums<'owner_verification'>>

export const factClassificationSchema = z.enum([
  'BRAND_COPY',
  'EDITORIAL_COPY',
  'VERIFIED_BUSINESS_FACT',
  'PRODUCT_FACT',
  'SEO_COPY',
  'LEGAL_COPY',
]) satisfies z.ZodType<Enums<'fact_classification'>>

export const mediaKindSchema = z.enum([
  'IMAGE',
  'VIDEO',
  'MODEL_3D',
  'DOCUMENT',
  'BRAND',
]) satisfies z.ZodType<Enums<'media_kind'>>

/**
 * D6's asset-priority ladder, in D6's order. See supabase/migrations/0030_phase06_media.sql —
 * the column is `not null` with no default, so this schema has no `.optional()` either: an asset
 * whose provenance nobody stated is a row this codebase declines to construct.
 */
export const mediaSourceSchema = z.enum([
  'REAL',
  'USER_UPLOAD',
  'HIGGSFIELD',
  'RENDER',
  'FALLBACK',
]) satisfies z.ZodType<Enums<'media_source'>>

/** No FIXED until Phase 14. See supabase/migrations/0006_catalog.sql. */
export const priceStateSchema = z.enum([
  'FIXED',
  'STARTING_FROM',
  'REQUEST_QUOTE',
  'PRICE_ON_REQUEST',
]) satisfies z.ZodType<Enums<'price_state'>>

/**
 * Phase 14 `0120`. Whether a piece exists now or is made when ordered.
 *
 * Nullable everywhere it appears: null means the owner has not stated it, which is not the same as
 * MADE_TO_ORDER and must not render as it. READY_STOCK is an inventory claim and the database
 * refuses to publish a product asserting it until the owner has verified the row (D10).
 */
export const availabilityStateSchema = z.enum(['READY_STOCK', 'MADE_TO_ORDER']) satisfies z.ZodType<
  Enums<'availability_state'>
>

/** Phase 14 `0120`. LIMITED_EDITION must state `edition_size`; the other two must not carry one. */
export const editionStateSchema = z.enum([
  'ONE_OF_ONE',
  'LIMITED_EDITION',
  'OPEN_EDITION',
]) satisfies z.ZodType<Enums<'edition_state'>>

/** One value until Phase 16 adds OWNER_CONFIRMED and RETIRED. */
export const collectionConceptStateSchema = z.enum([
  'DRAFT_COLLECTION_CONCEPT',
]) satisfies z.ZodType<Enums<'collection_concept_state'>>

/**
 * Timestamps arrive from PostgREST as ISO 8601 strings. Validated as such rather than passed
 * through as `z.string()`, because a malformed timestamp reaching a `new Date()` in a component
 * produces "Invalid Date" on the page instead of an error anyone can act on.
 */
export const timestampSchema = z.iso.datetime({ offset: true })

export const uuidSchema = z.uuid()

/** Tier A — audit columns. Present on every table except pure join tables and append-only logs. */
export const auditColumns = {
  created_at: timestampSchema,
  updated_at: timestampSchema,
  updated_by: uuidSchema.nullable(),
}

/** Tier B — content columns. Present on every content-bearing table. */
export const contentColumns = {
  status: contentStatusSchema,
  owner_verification: ownerVerificationSchema,
  fact_classification: factClassificationSchema.nullable(),
  published_at: timestampSchema.nullable(),
  published_by: uuidSchema.nullable(),
}

/** Tier C — seed columns. Present on every table a content/seed module writes to. */
export const seedColumns = {
  seed_key: z.string().nullable(),
  content_seed_version: z.string().nullable(),
  seed_content_hash: z.string().nullable(),
  seed_last_applied_at: timestampSchema.nullable(),
  owner_edited: z.boolean(),
}

/**
 * A `jsonb` column, typed as the generated `Json` union rather than `unknown`.
 *
 * `unknown` would compile here and fail at the `satisfies z.ZodType<Tables<'...'>>` annotation on
 * every schema that uses it — which is how this was found. It matters beyond the type check:
 * `products.dimensions` is a jsonb column D10 forbids inventing values for, and a caller handed
 * `unknown` has to cast before reading it, which is exactly where a fabricated measurement would
 * slip in unchecked.
 */
export const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonSchema),
    z.record(z.string(), jsonSchema),
  ]),
)
