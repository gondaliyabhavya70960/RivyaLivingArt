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

/**
 * Phase 16 `0140`. The lifecycle of a collection CONCEPT (FEAT §9).
 *
 * IN LIFECYCLE ORDER, NOT ALPHABETICAL, matching the enum's own `enumsortorder`: a concept is
 * drafted, confirmed by the owner, and eventually retired. A Studio list ordered by this column
 * therefore reads as progress rather than as accident.
 *
 * `OWNER_CONFIRMED` IS THE ONLY STATE A COLLECTION MAY BE PUBLISHED IN, and that is not a
 * convention this schema enforces — `enforce_collection_publish_gate` refuses the row. FEAT §9 is
 * explicit that the ten seeded names are "possible editable starting concepts" and must not be
 * fabricated as real published collections, so the gate exists to make a mistaken publish
 * impossible rather than merely discouraged.
 */
/**
 * Phase 16 `0141`. What an `entity_relations` edge may point at or from.
 *
 * CLOSED BY CONSTRUCTION, and the database agrees — these are real enum types, unlike
 * `product_relations.target_type`, which is plain text. An edge to a table no renderer knows about
 * is an association nobody can display, so the vocabulary is fixed where it is stored.
 */
export const relationEntitySchema = z.enum([
  'PRODUCT',
  'COLLECTION',
  'CATEGORY',
  'PORTFOLIO_PROJECT',
  'JOURNAL_ARTICLE',
  'MATERIAL',
]) satisfies z.ZodType<Enums<'relation_entity'>>

/**
 * What an edge MEANS.
 *
 * Closed so that "customers also bought" — a claim about behaviour this business does not measure —
 * cannot be stored at all (FEAT §11). Every value here is something an editor asserts, not
 * something a system infers.
 */
export const relationKindSchema = z.enum([
  'RELATED',
  'FEATURES',
  'REFERENCES',
  'USES_MATERIAL',
  'PART_OF',
]) satisfies z.ZodType<Enums<'relation_kind'>>

/**
 * Phase 17 `0150`. Whether the person or client a row names has agreed to be named.
 *
 * `GRANTED` IS THE ONLY VALUE THAT PERMITS PUBLICATION of a row carrying a name, and the two tables
 * that use it default differently on purpose: a project defaults to `NOT_APPLICABLE` because most
 * projects name nobody, while a testimonial defaults to `PENDING` because a quote always came from
 * someone. `WITHDRAWN` is not merely a refusal — it archives the row on the same statement.
 */
export const clientConsentStateSchema = z.enum([
  'NOT_APPLICABLE',
  'PENDING',
  'GRANTED',
  'WITHDRAWN',
]) satisfies z.ZodType<Enums<'client_consent_state'>>

/**
 * Phase 19 `0170`. Which of the three SEED §33-35 templates a form descends from.
 *
 * `CUSTOM` IS NOT A FOURTH TEMPLATE. It is what a form the owner built from nothing is, and it
 * exists so that "which template is this" always has an answer — a nullable `kind` would have made
 * every consumer handle a case that means the same thing as this value does.
 */
export const formKindSchema = z.enum([
  'FURNITURE',
  'PRESERVATION',
  'THREE_D_RESIN',
  'CUSTOM',
]) satisfies z.ZodType<Enums<'form_kind'>>

/**
 * Phase 19 `0170`. What a question IS, which decides both how it renders and how it validates.
 *
 * NOT A LIST OF HTML INPUT TYPES. `DIMENSION` carries a unit and is not a bare `NUMBER`;
 * `COLOUR_DIRECTION` is a choice among named directions rather than a colour picker, because Rivya
 * works in directions ("warm amber, low transparency") and a hex value would be a promise about a
 * finish nobody has agreed. The three `CONTACT_*` members exist so the publish gate can ask "is
 * there a way to reply to this brief?" without pattern-matching on a label an editor may rename.
 */
export const formFieldTypeSchema = z.enum([
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'DIMENSION',
  'SELECT',
  'MULTISELECT',
  'RADIO',
  'CHECKBOX',
  'COLOUR_DIRECTION',
  'FILE',
  'CITY',
  'CONTACT_NAME',
  'CONTACT_PHONE',
  'CONTACT_EMAIL',
]) satisfies z.ZodType<Enums<'form_field_type'>>

export const collectionConceptStateSchema = z.enum([
  'DRAFT_COLLECTION_CONCEPT',
  'OWNER_CONFIRMED',
  'RETIRED',
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
