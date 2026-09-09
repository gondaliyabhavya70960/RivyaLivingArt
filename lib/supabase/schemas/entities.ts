import { z } from 'zod'

import type { Tables } from '../database.types'
import {
  auditColumns,
  availabilityStateSchema,
  clientConsentStateSchema,
  collectionConceptStateSchema,
  relationEntitySchema,
  relationKindSchema,
  contentColumns,
  demoColumn,
  editionStateSchema,
  factClassificationSchema,
  formFieldTypeSchema,
  formKindSchema,
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
  subtitle: z.string().nullable(),
  statement: z.string().nullable(),
  /**
   * Phase 16 `0141`. The long-form exhibition statement.
   *
   * NULL ON EVERY SEEDED CONCEPT, and that is the seed doing its job rather than an oversight.
   * FEAT §9 seeds ten names as "possible editable starting concepts"; a statement describing a
   * collection Rivya has not made would assert a business capability nobody has confirmed (D10).
   * The owner writes it, or it stays empty and the band does not render.
   */
  statement_long: z.string().nullable(),
  concept_state: collectionConceptStateSchema,
  hero_media_id: uuidSchema.nullable(),
  signature_media_id: uuidSchema.nullable(),
  video_media_id: uuidSchema.nullable(),
  /** The exhibition page this collection renders through. Null until one is created from template. */
  page_id: uuidSchema.nullable(),
  seo_entry_id: uuidSchema.nullable(),
  /**
   * Written by `enforce_collection_concept_authority`, never submitted by a form — so the record of
   * who confirmed a concept, and when, cannot be set by whoever is doing the confirming.
   */
  owner_confirmed_at: timestampSchema.nullable(),
  owner_confirmed_by: uuidSchema.nullable(),
  sort_order: z.number().int(),
  ...auditColumns,
  ...contentColumns,
  ...seedColumns,
}) satisfies z.ZodType<Tables<'collections'>>

/**
 * One hand-made edge between two entities. Phase 16 `0141`.
 *
 * NO STATUS, NO OWNER VERIFICATION, NO SEED COLUMNS — this is an edge, not content. Either an
 * editor connected two things or they did not, and a draft relation is a state nobody can act on.
 * What it carries instead is `created_by`: FEAT §11 says no edge is ever created automatically, and
 * the only way that stays true is if every row can name the person who made it.
 *
 * `source_id` and `target_id` are validated as uuids but have no foreign key in the database — the
 * referent may be any of six entity types, and a polymorphic edge cannot name six parents in one
 * constraint. Resolution happens in the repository, against the target table's own policies.
 */
export const entityRelationSchema = z.object({
  id: uuidSchema,
  source_type: relationEntitySchema,
  source_id: uuidSchema,
  target_type: relationEntitySchema,
  target_id: uuidSchema,
  relation_type: relationKindSchema,
  note: z.string().nullable(),
  sort_order: z.number().int(),
  created_at: timestampSchema,
  created_by: uuidSchema.nullable(),
}) satisfies z.ZodType<Tables<'entity_relations'>>

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
  /**
   * Phase 14 `0121`. Exact price, smallest unit. `products_price_state_coherent` allows it only
   * beside `price_state = 'FIXED'`, and forbids it beside either quote state — so a quote-only
   * piece cannot carry a number even as a zero.
   */
  price_minor: z.number().int().nullable(),
  currency: z.string().length(3).nullable(),
  availability_state: availabilityStateSchema.nullable(),
  edition_state: editionStateSchema.nullable(),
  edition_size: z.number().int().nullable(),
  is_customizable: z.boolean(),
  /** Curation handle. Null sorts LAST in the default listing order — unplaced, not first. */
  sort_order: z.number().int().nullable(),
  is_large_format: z.boolean(),
  /**
   * Phase 15 `0132`. The owner's deliberate "this piece publishes no specifications" decision.
   *
   * NOT A FACT ABOUT THE OBJECT and never rendered — it satisfies the Specifications readiness item
   * without a spec row, so publishing never requires inventing a measurement (D10).
   */
  specifications_omitted: z.boolean(),
  dimensions: jsonSchema.nullable(),
  hero_media_id: uuidSchema.nullable(),
  model_media_id: uuidSchema.nullable(),
  seo_title: z.string().nullable(),
  seo_description: z.string().nullable(),
  publication_readiness: jsonSchema,
  ...auditColumns,
  ...contentColumns,
  ...seedColumns,
  ...demoColumn,
}) satisfies z.ZodType<Tables<'products'>>

/**
 * One owner-entered specification row. Phase 15 `0130`.
 *
 * `label` and `value` are plain non-empty strings rather than anything structured, and that is the
 * point: the owner types "Seat height" and "450", the site shows "Seat height" and "450", and
 * nothing between the two parses, converts or rounds. `unit` is what they typed as well.
 *
 * No seed columns. The table has none, because a seeded specification would be a fabricated
 * measurement (D10) and the absence of a `seed_key` is what makes that structural.
 */
export const productSpecSchema = z.object({
  id: uuidSchema,
  product_id: uuidSchema,
  sort_order: z.number().int(),
  label: z.string(),
  value: z.string(),
  unit: z.string().nullable(),
  group_label: z.string().nullable(),
  ...auditColumns,
  ...contentColumns,
  /**
   * NOT NULL here, unlike every other content table. 0130 declares it
   * `not null default 'PRODUCT_FACT'` because that is what a row in this table IS by construction —
   * a measurement of a real object, typed by the person who made it. There is no other honest value
   * for it, so the column does not offer one and the schema follows the column rather than the
   * shared helper.
   */
  fact_classification: factClassificationSchema,
}) satisfies z.ZodType<Tables<'product_specs'>>

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
export type EntityRelation = z.infer<typeof entityRelationSchema>
export type Material = z.infer<typeof materialSchema>
export type MediaAsset = z.infer<typeof mediaAssetSchema>
export type Product = z.infer<typeof productSchema>
export type ProductRelation = z.infer<typeof productRelationSchema>
export type ProductSpec = z.infer<typeof productSpecSchema>

/**
 * A delivered project. Phase 17 `0150`.
 *
 * ZERO ROWS EXIST AND NONE IS SEEDED. SEED §17 forbids fictional customer projects in capitals and
 * D10 lists delivered projects and named customers as the first two things that may never be
 * fabricated — so this table has no Tier C columns at all, and a seed module cannot address a row
 * in it even if someone wrote one.
 *
 * TWO INDEPENDENT GATES STAND BETWEEN A ROW AND `PUBLISHED`, both enforced by
 * `enforce_project_evidence_gate()`: the owner has verified it happened, and anyone it names has
 * consented to be named. Nothing here re-implements them — a repository that re-tested them would
 * be a second copy of a rule that could drift from the trigger.
 */
export const portfolioProjectSchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  /** The project's story page, if one has been created. Null until it is. */
  page_id: uuidSchema.nullable(),
  title: z.string(),
  subtitle: z.string().nullable(),
  summary: z.string().nullable(),
  project_type: z.string().nullable(),
  /** A LABEL, NEVER AN ADDRESS — "a private residence in Ahmedabad", not a street. */
  location_label: z.string().nullable(),
  completed_on: z.string().nullable(),
  is_client_project: z.boolean(),
  client_display_name: z.string().nullable(),
  client_consent: clientConsentStateSchema,
  client_consent_reference: z.string().nullable(),
  client_consent_recorded_at: timestampSchema.nullable(),
  client_consent_recorded_by: uuidSchema.nullable(),
  /**
   * What proves this project happened. NEVER RENDERED PUBLICLY — it exists so that "is this real"
   * has an answer written down, for the owner and for whoever asks later.
   */
  evidence_note: z.string().nullable(),
  hero_media_id: uuidSchema.nullable(),
  seo_entry_id: uuidSchema.nullable(),
  sort_order: z.number().int(),
  ...auditColumns,
  ...contentColumns,
  /**
   * NOT NULL ON THIS TABLE, so the schema follows the column rather than the shared helper —
   * `contentColumns` types it nullable because the six Phase 03 tables declare it that way, and
   * `cms.ts` records the same override for the same reason. A project row always classifies as
   * something; there is no honest null.
   */
  fact_classification: factClassificationSchema,
  ...demoColumn,
}) satisfies z.ZodType<Tables<'portfolio_projects'>>

export type PortfolioProject = z.infer<typeof portfolioProjectSchema>

/** One picture in a project's gallery. A concept render may never be one — see 0150's trigger. */
export const portfolioProjectMediaSchema = z.object({
  project_id: uuidSchema,
  media_asset_id: uuidSchema,
  role: z.string(),
  caption: z.string().nullable(),
  /** What this picture is doing HERE, which is a different sentence from what it is of. */
  alt_override: z.string().nullable(),
  sort_order: z.number().int(),
  created_at: timestampSchema,
  created_by: uuidSchema.nullable(),
}) satisfies z.ZodType<Tables<'portfolio_project_media'>>

export type PortfolioProjectMedia = z.infer<typeof portfolioProjectMediaSchema>

/**
 * A quote from a real person. Phase 17 `0150`.
 *
 * ZERO ROWS, AND `consent` DEFAULTS TO `PENDING` rather than `NOT_APPLICABLE`: a quote always came
 * from someone, so consent is always a live question here in a way it is not for a project with no
 * client. D10 names testimonials outright, and one written in-house is the purest form of what it
 * forbids.
 */
export const testimonialSchema = z.object({
  id: uuidSchema,
  attributed_to: z.string().nullable(),
  attribution_role: z.string().nullable(),
  quote: z.string(),
  project_id: uuidSchema.nullable(),
  consent: clientConsentStateSchema,
  consent_reference: z.string().nullable(),
  sort_order: z.number().int(),
  ...auditColumns,
  ...contentColumns,
  /** NOT NULL here too — see the note on `portfolioProjectSchema`. */
  fact_classification: factClassificationSchema,
  ...demoColumn,
}) satisfies z.ZodType<Tables<'testimonials'>>

export type Testimonial = z.infer<typeof testimonialSchema>

/**
 * A journal category. Phase 18 `0160`.
 *
 * NINE OF THEM, SEEDED PUBLISHED, and the slug is an identity rather than a label. Renaming a
 * category edits `name`; changing `slug` changes a public URL, which needs a redirect row and is
 * Phase 39's work. The two are separate columns so that "rename this" and "move this" cannot be the
 * same act by accident.
 */
export const journalCategorySchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  name: z.string(),
  /** What a listing says ABOUT the category. */
  description: z.string().nullable(),
  /** What the category page says AS itself. A different sentence, deliberately. */
  intro_heading: z.string().nullable(),
  position: z.number().int(),
  ...auditColumns,
  ...contentColumns,
  ...seedColumns,
  /** NOT NULL on this table — see the note on `portfolioProjectSchema`. */
  fact_classification: factClassificationSchema,
}) satisfies z.ZodType<Tables<'journal_categories'>>

export type JournalCategory = z.infer<typeof journalCategorySchema>

/**
 * A journal article. Phase 18 `0160`.
 *
 * TEN OF THEM ARE SEEDED, AND ALL TEN ARE A TITLE AND AN ANGLE. SEED §20 supplies ideas and says
 * "Do NOT publish automatically"; the body is written by the owner in the Studio, into the linked
 * `ARTICLE` page. Nothing here can create a published article.
 *
 * `reading_minutes` IS DERIVED AND MAY NOT BE WRITTEN. `set_article_reading_minutes()` overwrites it
 * on every write from the linked page's visible sections, so a value sent by a caller does not
 * survive the statement that sent it. The field is present on this schema because it is a column
 * that comes BACK; nothing in the repository layer sends it.
 *
 * `angle_note` IS NEVER RENDERED PUBLICLY. It is the brief — what the piece is meant to be about,
 * for whoever writes it — and it is deliberately not `excerpt`, which is what a card shows. An angle
 * read as a summary would put the studio's editorial notes on the website.
 */
export const journalArticleSchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  /** The article's body page. Null until one is created. */
  page_id: uuidSchema.nullable(),
  title: z.string(),
  /** The line under the title on the article itself. */
  standfirst: z.string().nullable(),
  /** The line a CARD shows — read in a grid beside other cards, not alone. */
  excerpt: z.string().nullable(),
  angle_note: z.string().nullable(),
  primary_category_id: uuidSchema.nullable(),
  /** Desktop and mobile are separate slots (D6), never one asset cropped by CSS. */
  cover_media_id: uuidSchema.nullable(),
  cover_mobile_media_id: uuidSchema.nullable(),
  /** The organisation, until somebody verifies a person. */
  byline: z.string(),
  reading_minutes: z.number().int().nullable(),
  seo_entry_id: uuidSchema.nullable(),
  ...auditColumns,
  ...contentColumns,
  ...seedColumns,
  /** NOT NULL on this table — see the note on `portfolioProjectSchema`. */
  fact_classification: factClassificationSchema,
  ...demoColumn,
}) satisfies z.ZodType<Tables<'journal_articles'>>

export type JournalArticle = z.infer<typeof journalArticleSchema>

/** A secondary category on an article. The primary one lives on the article row. */
export const journalArticleCategorySchema = z.object({
  article_id: uuidSchema,
  category_id: uuidSchema,
  position: z.number().int(),
  created_at: timestampSchema,
  created_by: uuidSchema.nullable(),
}) satisfies z.ZodType<Tables<'journal_article_categories'>>

export type JournalArticleCategory = z.infer<typeof journalArticleCategorySchema>

/**
 * A customization form definition. Phase 19 `0170`.
 *
 * THE QUESTIONS LIVE IN ROWS, WHICH IS THE WHOLE PHASE. FEAT §15 fixes eleven steps and then says
 * every step is configurable from Studio — a sentence that only means something if the form is
 * data. `lib/cms/forms.ts` generates the Zod schema a submission is validated against from these
 * rows, so the validation and the questions cannot drift: there is only one copy of either.
 *
 * `submit_label_key` IS A KEY, NOT WORDS. `CTA.send_an_enquiry` resolves in `global_content`, where
 * the site's action vocabulary already lives. Storing the label here would fork it — change the CTA
 * library and eleven forms keep the old verb.
 *
 * NOTHING ON THIS SCHEMA PRICES ANYTHING, and the absence is enforced rather than observed: there
 * is no price column to mirror, `validation` is constrained to an allowlist of Zod keys, and
 * `tests/unit/no-pricing.test.ts` fails on a price-shaped identifier appearing here.
 */
export const customizationFormSchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  name: z.string(),
  kind: formKindSchema,
  /** What the Studio list says ABOUT the form. */
  description: z.string().nullable(),
  /** What the configurator says on its first screen. A different sentence, deliberately. */
  intro_heading: z.string().nullable(),
  intro_body: z.string().nullable(),
  submit_label_key: z.string().nullable(),
  /** The form used when a product has no binding of its own. At most one per kind. */
  is_default: z.boolean(),
  ...auditColumns,
  ...contentColumns,
  ...seedColumns,
  /** NOT NULL on this table — see the note on `portfolioProjectSchema`. */
  fact_classification: factClassificationSchema,
}) satisfies z.ZodType<Tables<'customization_forms'>>

export type CustomizationForm = z.infer<typeof customizationFormSchema>

/**
 * One screen of the configurator. Phase 19 `0170`.
 *
 * `position` IS REPORTED, NOT REQUESTED. `normalise_form_step_order()` renumbers a form's steps
 * densely with `contact` last after every write, so a position sent by a caller is a preference the
 * database may overrule. That is what makes "contact is always last" true rather than merely
 * required — see the header of migration 0170 for why a refusing constraint could not survive the
 * Studio, which writes one row per PostgREST statement.
 *
 * NO `status`. A step is switched on or off; it is not drafted, reviewed and published on its own.
 * Its visibility is its form's.
 */
export const customizationFormStepSchema = z.object({
  id: uuidSchema,
  form_id: uuidSchema,
  /** One of the eleven FEAT §15 keys, or an owner's own. `contact` is the only one the database knows by name. */
  key: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  position: z.number().int(),
  is_enabled: z.boolean(),
  is_required: z.boolean(),
  ...auditColumns,
  ...seedColumns,
}) satisfies z.ZodType<Tables<'customization_form_steps'>>

export type CustomizationFormStep = z.infer<typeof customizationFormStepSchema>

/**
 * One question. Phase 19 `0170`.
 *
 * EVERY ROW SUPPORTS THE SEED §33 CONTRACT — enabled, disabled, required, optional, reordered,
 * renamed — and the seed columns on this table are what make the last of those survive a re-seed.
 * Renaming "Finish Preference" sets `owner_edited`, the runner stands down for that field alone,
 * and the rest of the template stays correctable.
 *
 * `options` AND `validation` ARE `Json`, NOT PARSED SHAPES, and that is deliberate at this layer.
 * This schema mirrors the ROW; `lib/cms/forms.ts` is where the two are read into the option list
 * and the Zod rules a submission is checked against, because that is the only place that knows
 * which field type it is reading them for.
 */
export const customizationFormFieldSchema = z.object({
  id: uuidSchema,
  form_id: uuidSchema,
  step_id: uuidSchema,
  key: z.string(),
  label: z.string(),
  help_text: z.string().nullable(),
  placeholder: z.string().nullable(),
  field_type: formFieldTypeSchema,
  options: jsonSchema,
  /** Zod keys only, enforced by an allowlist CHECK — the door a price multiplier would come through. */
  validation: jsonSchema,
  is_enabled: z.boolean(),
  is_required: z.boolean(),
  position: z.number().int(),
  /** Phase 20 reads this when it builds the WhatsApp summary. */
  include_in_whatsapp: z.boolean(),
  ...auditColumns,
  ...seedColumns,
}) satisfies z.ZodType<Tables<'customization_form_fields'>>

export type CustomizationFormField = z.infer<typeof customizationFormFieldSchema>

/** Binds a form to a product or a category — exactly one of the two, checked in the database. */
export const productCustomizationFormSchema = z.object({
  id: uuidSchema,
  form_id: uuidSchema,
  product_id: uuidSchema.nullable(),
  category_id: uuidSchema.nullable(),
  position: z.number().int(),
  created_at: timestampSchema,
  created_by: uuidSchema.nullable(),
}) satisfies z.ZodType<Tables<'product_customization_forms'>>

export type ProductCustomizationForm = z.infer<typeof productCustomizationFormSchema>

/**
 * A feature flag. Phase 19 `0171`.
 *
 * A ROW MEANS SOMEBODY TOUCHED THE SWITCH. The register of which flags exist is `lib/flags/flags.ts`
 * — a flag key is an identifier that call sites spell out, so it belongs in the type system where
 * deleting one breaks its callers at compile time. `isEnabled()` returns false for a flag with no
 * row, which makes absence and "off" the same state on a fresh database, a restored backup and a
 * preview branch alike.
 */
export const featureFlagSchema = z.object({
  key: z.string(),
  description: z.string().nullable(),
  is_enabled: z.boolean(),
  updated_at: timestampSchema,
  updated_by: uuidSchema.nullable(),
}) satisfies z.ZodType<Tables<'feature_flags'>>

export type FeatureFlag = z.infer<typeof featureFlagSchema>
