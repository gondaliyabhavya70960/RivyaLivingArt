import { z } from 'zod'

import type { Tables } from '../database.types'
import {
  auditColumns,
  contentColumns,
  factClassificationSchema,
  seedColumns,
  timestampSchema,
  uuidSchema,
} from './common'

/** Tier B with `fact_classification` NOT NULL, as every CMS-shaped table declares it. */
const cmsContentColumns = {
  ...contentColumns,
  fact_classification: factClassificationSchema,
}

/**
 * Row schemas for the two Phase 39 tables. `seo_entries` keeps its Phase 08 schema in `cms.ts`,
 * extended there with the four Phase 39 columns.
 *
 * `seo_keyword_themes` HAS NO NUMERIC FIELD, and this schema is the second place that says so:
 * a column added to the table would have to be added here, next to this sentence, before any code
 * could read it. SEED §42 — "must be refined through research before claiming ranking opportunity"
 * — is the reason there is nowhere to store a volume, a difficulty or a rank.
 */

export const KEYWORD_STATUSES = ['UNRESEARCHED', 'RESEARCHED', 'TARGETED', 'REJECTED'] as const
export type KeywordStatus = (typeof KEYWORD_STATUSES)[number]
export const keywordStatusSchema = z.enum(KEYWORD_STATUSES)

/** The Phase 39 structured-data allowlist, in the phase document's order. Nothing else is emitted. */
export const STRUCTURED_DATA_TYPES = [
  'Organization',
  'WebSite',
  'BreadcrumbList',
  'Product',
  'CollectionPage',
  'Article',
  'FAQPage',
  'ContactPoint',
] as const
export type StructuredDataType = (typeof STRUCTURED_DATA_TYPES)[number]

export const REDIRECT_STATUS_CODES = [301, 308] as const
export type RedirectStatusCode = (typeof REDIRECT_STATUS_CODES)[number]

/** A site-relative, lowercase path — the same shape `seo_entries_path_shape` enforces. */
export const SITE_PATH_PATTERN = /^\/[a-z0-9/-]*$/

export const seoKeywordThemeSchema = z.object({
  id: uuidSchema,
  theme: z.string(),
  normalized_theme: z.string(),
  mapped_path: z.string().nullable(),
  research_status: z.string(),
  notes: z.string().nullable(),
  evidence_url: z.string().nullable(),
  researched_by: uuidSchema.nullable(),
  researched_at: timestampSchema.nullable(),
  ...auditColumns,
  ...cmsContentColumns,
  ...seedColumns,
}) satisfies z.ZodType<Tables<'seo_keyword_themes'>>

export type SeoKeywordTheme = z.infer<typeof seoKeywordThemeSchema>

export const seoRedirectSchema = z.object({
  id: uuidSchema,
  from_path: z.string(),
  to_path: z.string(),
  status_code: z.number().int(),
  reason: z.string().nullable(),
  hit_count: z.number().int(),
  last_hit_at: timestampSchema.nullable(),
  created_by: uuidSchema.nullable(),
  ...auditColumns,
  ...cmsContentColumns,
}) satisfies z.ZodType<Tables<'seo_redirects'>>

export type SeoRedirect = z.infer<typeof seoRedirectSchema>

/** What the Studio may write to a keyword theme. The theme text itself is fixed on creation. */
export const keywordThemeInputSchema = z.object({
  theme: z.string().trim().min(1).max(120),
  mapped_path: z.string().regex(SITE_PATH_PATTERN).nullable(),
  research_status: keywordStatusSchema,
  notes: z.string().trim().max(2000).nullable(),
  evidence_url: z.string().trim().url().max(500).nullable(),
})

export const redirectInputSchema = z.object({
  from_path: z.string().regex(SITE_PATH_PATTERN),
  to_path: z.string().regex(SITE_PATH_PATTERN),
  status_code: z.union([z.literal(301), z.literal(308)]),
  reason: z.string().trim().max(500).nullable(),
})
