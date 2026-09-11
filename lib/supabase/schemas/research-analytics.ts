import { z } from 'zod'

import { BAND_RULES } from '@/lib/scraper/analytics/bands'
import { coverageRecordSchema } from '@/lib/scraper/analytics/coverage'

/**
 * Zod for every Phase 31 table, at the repository boundary.
 *
 * ROWS ARE VALIDATED ON THE WAY OUT AS WELL AS ON THE WAY IN. A snapshot payload is jsonb the CLI
 * wrote, and a Studio panel that rendered whatever came back would render a shape it has no name
 * for the day a later CLI version changes the payload. `analyticsPayloadSchema` is loose on purpose
 * — the families' result shapes are typed in `lib/scraper/analytics/` — but the coverage records
 * inside every payload are checked to the letter, because they are the honesty contract.
 */

export const SCOPE_TYPES = ['CORPUS', 'SOURCE', 'SET', 'CATEGORY'] as const
export type ScopeType = (typeof SCOPE_TYPES)[number]

export const METRIC_FAMILIES = ['ASSORTMENT', 'PRICE_ARCHITECTURE', 'DIMENSIONS'] as const
export type MetricFamily = (typeof METRIC_FAMILIES)[number]

export const MEMBER_TYPES = ['SOURCE', 'RESEARCH_PRODUCT'] as const
export type MemberType = (typeof MEMBER_TYPES)[number]

export const comparisonSetRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable(),
  scope_note: z.string().nullable(),
  band_rule: z.enum(BAND_RULES),
  band_edges: z.array(z.number().int()).nullable(),
  last_computed_at: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
  created_by: z.string().uuid(),
  updated_at: z.string(),
  updated_by: z.string().uuid().nullable(),
})
export type ComparisonSetRow = z.infer<typeof comparisonSetRowSchema>

export const comparisonMemberRowSchema = z.object({
  id: z.string().uuid(),
  set_id: z.string().uuid(),
  member_type: z.enum(MEMBER_TYPES),
  source_id: z.string().uuid().nullable(),
  research_product_id: z.string().uuid().nullable(),
  position: z.number().int().nonnegative(),
  note: z.string().nullable(),
  created_at: z.string(),
  created_by: z.string().uuid().nullable(),
})
export type ComparisonMemberRow = z.infer<typeof comparisonMemberRowSchema>

export const analyticsPayloadSchema = z
  .object({
    family: z.enum(METRIC_FAMILIES),
    version: z.number().int().positive(),
    result: z.record(z.string(), z.unknown()),
    coverage: z.array(coverageRecordSchema).min(1),
  })
  .passthrough()
export type AnalyticsPayload = z.infer<typeof analyticsPayloadSchema>

export const analyticsSnapshotRowSchema = z.object({
  id: z.string().uuid(),
  scope_type: z.enum(SCOPE_TYPES),
  scope_id: z.string().uuid().nullable(),
  metric_family: z.enum(METRIC_FAMILIES),
  currency: z.string().length(3).nullable(),
  payload: analyticsPayloadSchema,
  row_count: z.number().int().nonnegative(),
  computed_at: z.string(),
  computed_by: z.string().uuid().nullable(),
  input_run_max_id: z.string().uuid().nullable(),
})
export type AnalyticsSnapshotRow = z.infer<typeof analyticsSnapshotRowSchema>

export const metricCoverageRowSchema = z.object({
  id: z.string().uuid(),
  snapshot_id: z.string().uuid(),
  metric_key: z.string().min(1),
  n: z.number().int().nonnegative(),
  denominator: z.number().int().nonnegative(),
  coverage_pct: z.coerce.number().min(0).max(100),
  excluded_reasons: z.record(z.string(), z.number().int().nonnegative()),
  as_of: z.string(),
})
export type MetricCoverageRow = z.infer<typeof metricCoverageRowSchema>

/** The payload version this code writes. Bumped when a family's result shape changes. */
export const ANALYTICS_PAYLOAD_VERSION = 1
