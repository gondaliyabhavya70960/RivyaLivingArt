import { z } from 'zod'

/**
 * `analytics_snapshots` — Phase 37.
 *
 * The row is the tile: what the Analytics tab shows for one metric on one day. `value` carries the
 * figure and any series; `n` and `denominator` are the coverage; `availability` with its reason is
 * the phase's invariant, CHECKed in `0350` and parsed again here so a row that somehow violated it
 * would fail to read rather than render.
 */

export const METRIC_DIMENSIONS = ['FIRST_PARTY', 'COMPETITIVE'] as const
export type MetricDimension = (typeof METRIC_DIMENSIONS)[number]

export const AVAILABILITIES = ['AVAILABLE', 'UNAVAILABLE'] as const
export type Availability = (typeof AVAILABILITIES)[number]

/** How a figure is shown. `percent` is a whole number 0–100; `minor` is a currency minor unit. */
export const METRIC_UNITS = ['count', 'percent', 'minor', 'days', 'mm', 'score'] as const
export type MetricUnit = (typeof METRIC_UNITS)[number]

export const chartDatumSchema = z.object({ label: z.string().min(1), value: z.number().finite() })
export type ChartDatumRow = z.infer<typeof chartDatumSchema>

/**
 * The stored payload. `figure` is null only when the metric is UNAVAILABLE — an available metric
 * with nothing to count stores a true zero. `series` is what a bar chart draws; `groups` are named
 * sub-figures (published 12 · draft 4); `notes` are fixed sentences the tile prints under the
 * figure (a sample floor, a stale snapshot); `detail` is whatever else the tile may show.
 */
export const metricValueSchema = z
  .object({
    figure: z.number().finite().nullable(),
    unit: z.enum(METRIC_UNITS),
    currency: z.string().length(3).nullable().optional(),
    series: z.array(chartDatumSchema).optional(),
    groups: z.array(chartDatumSchema).optional(),
    notes: z.array(z.string()).optional(),
    detail: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
export type MetricValue = z.infer<typeof metricValueSchema>

export const analyticsSnapshotRowSchema = z.object({
  id: z.uuid(),
  metric_id: z.string().min(1),
  dimension: z.enum(METRIC_DIMENSIONS),
  as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  value: metricValueSchema,
  n: z.number().int().nonnegative().nullable(),
  denominator: z.number().int().nonnegative().nullable(),
  availability: z.enum(AVAILABILITIES),
  unavailable_reason: z.string().min(1).nullable(),
  computed_at: z.string(),
  computed_by: z.uuid().nullable(),
})
export type AnalyticsSnapshotRow = z.infer<typeof analyticsSnapshotRowSchema>

/** What the writer stores: the row minus what the database fills in. */
export const analyticsSnapshotInputSchema = z
  .object({
    metricId: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/u),
    dimension: z.enum(METRIC_DIMENSIONS),
    asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    value: metricValueSchema,
    n: z.number().int().nonnegative().nullable(),
    denominator: z.number().int().nonnegative().nullable(),
    availability: z.enum(AVAILABILITIES),
    unavailableReason: z.string().min(1).nullable(),
    computedAt: z.string(),
    computedBy: z.uuid().nullable(),
  })
  .strict()
  .refine((row) => (row.availability === 'UNAVAILABLE') === (row.unavailableReason !== null), {
    message: 'an UNAVAILABLE snapshot carries a reason and an AVAILABLE one carries none',
  })
export type AnalyticsSnapshotInput = z.infer<typeof analyticsSnapshotInputSchema>
