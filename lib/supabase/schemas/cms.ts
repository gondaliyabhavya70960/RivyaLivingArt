import { z } from 'zod'

import type { Tables } from '../database.types'
import {
  auditColumns,
  contentColumns,
  demoColumn,
  contentStatusSchema,
  factClassificationSchema,
  jsonSchema,
  seedColumns,
  timestampSchema,
  uuidSchema,
} from './common'

/**
 * Row schemas for the Phase 08 CMS tables.
 *
 * Every schema carries `satisfies z.ZodType<Tables<'...'>>`, which is what ties this file to the
 * generated types: adding a column to a migration and forgetting it here is a compile error rather
 * than a field that silently arrives as `undefined` at a render.
 *
 * THE VOCABULARY COLUMNS ARE `z.string()`, NOT `z.enum()`, and that is deliberate. `kind`, `menu`,
 * `group_key`, `scope` and `action` are `text` with check constraints in the database rather than
 * enums, precisely so four later phases can add values without an `alter type` that cannot run in
 * a transaction. Mirroring them as a Zod enum here would reintroduce exactly the coupling the
 * database avoided — Phase 39 adds an `seo_entries.scope` value and this file rejects every row
 * that uses it, at read time, in production. Where a narrow union genuinely helps a caller, it
 * belongs at the edit boundary (a Studio form's own schema), not on the row read.
 */

/**
 * Tier B, with ONE deliberate narrowing for the CMS tables.
 *
 * `contentColumns` types `fact_classification` as nullable because the six Phase 03 tables declare
 * it that way. All six Phase 08 tables declare it `not null` with a default, and that difference
 * is a decision rather than an oversight: a null classification means "nobody has said what kind
 * of claim this text makes", which is precisely the state D10 exists to make impossible. On a
 * product row the column is metadata about an entity; on a `page_sections` row it describes the
 * COPY ITSELF, and unclassified copy is how a marketing sentence ends up filed as a verified
 * business fact.
 *
 * Overriding here rather than loosening the database keeps the stronger guarantee where it
 * belongs. Recorded as a §1.8 correction row.
 */
const cmsContentColumns = {
  ...contentColumns,
  fact_classification: factClassificationSchema,
}

export const pageSchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  /** Null only for `kind = 'SYSTEM'`. See migration 0050 — the null is what keeps it unservable. */
  path: z.string().nullable(),
  kind: z.string(),
  title: z.string(),
  publish_at: timestampSchema.nullable(),
  unpublish_at: timestampSchema.nullable(),
  seo_entry_id: uuidSchema.nullable(),
  is_system: z.boolean(),
  ...auditColumns,
  ...cmsContentColumns,
  ...seedColumns,
  ...demoColumn,
}) satisfies z.ZodType<Tables<'pages'>>

export const pageSectionSchema = z.object({
  id: uuidSchema,
  page_id: uuidSchema,
  block_type: z.string(),
  position: z.number().int(),
  is_visible: z.boolean(),
  theme: z.string().nullable(),
  layout_variant: z.string().nullable(),

  eyebrow: z.string().nullable(),
  heading: z.string().nullable(),
  heading_highlight: z.string().nullable(),
  body: z.string().nullable(),
  supporting: z.string().nullable(),
  cta_label: z.string().nullable(),
  cta_url: z.string().nullable(),
  cta_secondary_label: z.string().nullable(),
  cta_secondary_url: z.string().nullable(),

  media_desktop_id: uuidSchema.nullable(),
  media_mobile_id: uuidSchema.nullable(),
  media_alt_override: z.string().nullable(),
  media_slot_key: z.string().nullable(),

  payload: jsonSchema,
  field_classifications: jsonSchema,

  publish_at: timestampSchema.nullable(),
  unpublish_at: timestampSchema.nullable(),

  schedule_state: z.string(),
  schedule_attempts: z.number().int(),
  schedule_error: z.string().nullable(),
  schedule_last_attempt_at: timestampSchema.nullable(),

  ...auditColumns,
  ...cmsContentColumns,
  ...seedColumns,
  ...demoColumn,
}) satisfies z.ZodType<Tables<'page_sections'>>

/**
 * A revision row.
 *
 * No `updated_at` and no `status`: this table records what happened and cannot be edited, which is
 * why `check-schema.mjs` records it as a §1.4 exemption rather than giving it the content tiers.
 */
export const contentRevisionSchema = z.object({
  id: uuidSchema,
  entity_type: z.string(),
  entity_id: uuidSchema,
  revision_no: z.number().int(),
  action: z.string(),
  snapshot: jsonSchema,
  change_summary: z.string().nullable(),
  created_at: timestampSchema,
  created_by: uuidSchema.nullable(),
}) satisfies z.ZodType<Tables<'content_revisions'>>

export const navigationItemSchema = z.object({
  id: uuidSchema,
  menu: z.string(),
  parent_id: uuidSchema.nullable(),
  label: z.string(),
  href: z.string(),
  position: z.number().int(),
  is_visible: z.boolean(),
  target: z.string(),
  ...auditColumns,
  ...cmsContentColumns,
  ...seedColumns,
}) satisfies z.ZodType<Tables<'navigation_items'>>

export const globalContentSchema = z.object({
  id: uuidSchema,
  group_key: z.string(),
  key: z.string(),
  label: z.string().nullable(),
  value: z.string(),
  description: z.string().nullable(),
  is_enabled: z.boolean(),
  ...auditColumns,
  ...cmsContentColumns,
  ...seedColumns,
}) satisfies z.ZodType<Tables<'global_content'>>

export const seoEntrySchema = z.object({
  id: uuidSchema,
  scope: z.string(),
  path: z.string().nullable(),
  entity_type: z.string().nullable(),
  entity_id: uuidSchema.nullable(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  social_title: z.string().nullable(),
  social_description: z.string().nullable(),
  og_media_id: uuidSchema.nullable(),
  canonical_url: z.string().nullable(),
  robots: z.string().nullable(),
  // Phase 39. The editable directive as two booleans, the one structured-data type the page may
  // emit, and whether the Studio derived this row from page content rather than an owner typing.
  structured_data_type: z.string().nullable(),
  noindex: z.boolean(),
  nofollow: z.boolean(),
  derived: z.boolean(),
  ...auditColumns,
  ...cmsContentColumns,
  ...seedColumns,
}) satisfies z.ZodType<Tables<'seo_entries'>>

export const faqSchema = z.object({
  id: uuidSchema,
  question: z.string(),
  answer: z.string(),
  category: z.string().nullable(),
  position: z.number().int(),
  ...auditColumns,
  ...cmsContentColumns,
  ...seedColumns,
}) satisfies z.ZodType<Tables<'faqs'>>

/**
 * What `cms_publish_section` returns.
 *
 * VALIDATED LIKE ANY OTHER BOUNDARY, even though the function is ours. It arrives as `Json` from
 * PostgREST — the generated `Functions` map types every return as `Json`, deliberately — so
 * without a schema the caller reads `result.promoted` off an `unknown` and finds out at render
 * time whether the function changed shape. This is the one place the media cascade's outcome
 * crosses back into TypeScript.
 */
export const publishResultSchema = z.object({
  section_id: uuidSchema,
  from: contentStatusSchema,
  to: contentStatusSchema,
  /** Null only if the section somehow has no revisions, which write_revision makes impossible. */
  revision_no: z.number().int().nullable(),
  /** `rivya_asset_id` values promoted to PUBLISHED by this call. Empty on an unpublish. */
  promoted: z.array(z.string()),
  /** Paths to revalidate. Empty for a SYSTEM page, which has none. */
  paths: z.array(z.string()),
})

export type PublishResult = z.infer<typeof publishResultSchema>

/**
 * What `cms_run_content_schedule` returns.
 *
 * `published` REUSES `publishResultSchema` because each entry IS one `cms_publish_section` result —
 * the sweep is a loop over that function, and giving its entries a looser shape here would let the
 * two drift apart silently.
 *
 * `paths` IS ALREADY DEDUPED AND SORTED BY THE FUNCTION. Two sections on one page produce one path,
 * because the caller turns each of these into a `revalidatePath` and revalidating the same route
 * twice in one pass is wasted work on every tick, forever.
 */
export const scheduleFailureSchema = z.object({
  section_id: uuidSchema,
  target: z.string(),
  attempts: z.number().int(),
  state: z.enum(['PENDING', 'BLOCKED']),
  error: z.string(),
})

export const scheduleRunResultSchema = z.object({
  ran_at: timestampSchema,
  published: z.array(publishResultSchema),
  failed: z.array(scheduleFailureSchema),
  paths: z.array(z.string()),
})

export const reorderResultSchema = z.object({
  page_id: uuidSchema,
  count: z.number().int(),
})

/**
 * The section snapshot a revision carries.
 *
 * PARTIAL AND PERMISSIVE ON PURPOSE. A snapshot is a historical record of a row as it was, and the
 * shape of `page_sections` will change — Phase 14 and Phase 39 both add columns. A strict schema
 * would make every revision written before a migration unreadable after it, which turns the audit
 * trail into a liability at exactly the moment somebody needs it. So the fields a restore actually
 * writes are typed, and everything else passes through.
 */
export const sectionSnapshotSchema = z
  .object({
    id: uuidSchema,
    page_id: uuidSchema,
    block_type: z.string(),
    position: z.number().int(),
    media_desktop_id: uuidSchema.nullable().optional(),
    media_mobile_id: uuidSchema.nullable().optional(),
    media_slot_key: z.string().nullable().optional(),
    payload: jsonSchema.optional(),
  })
  .loose()

export type Page = z.infer<typeof pageSchema>
export type PageSection = z.infer<typeof pageSectionSchema>
export type ContentRevision = z.infer<typeof contentRevisionSchema>
export type NavigationItem = z.infer<typeof navigationItemSchema>
export type GlobalContent = z.infer<typeof globalContentSchema>
export type SeoEntry = z.infer<typeof seoEntrySchema>
export type Faq = z.infer<typeof faqSchema>
export type ScheduleFailure = z.infer<typeof scheduleFailureSchema>
export type ScheduleRunResult = z.infer<typeof scheduleRunResultSchema>
