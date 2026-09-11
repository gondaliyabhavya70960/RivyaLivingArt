import { z } from 'zod'

import { coverageRecordSchema } from '@/lib/scraper/analytics/coverage'

/**
 * Evidence capture — Phase 34.
 *
 * What a brief keeps of each attached item, BY VALUE where the item is volatile. A score changes
 * when a model is re-run; a snapshot is superseded nightly; a brief read a year later must show
 * what its author saw. So `captured` holds the figures as they stood at attachment time, and the
 * rail shows drift against the current value when the two differ.
 *
 * NOTHING HERE IS PROSE. A capture is numbers, ids, names and dates copied from research rows.
 * The nine brief sections are written by a person and never touched by this module.
 *
 * NOTHING HERE IS A RIVYA FACT. Every figure is an observation about competitor research, and the
 * panel that renders it says "observed in competitor research" beside the coverage badge. The
 * schema has no field for a Rivya price, dimension, material or lead time.
 */

export const EVIDENCE_TYPES = [
  'COMPARISON_SET',
  'ANALYTICS_SNAPSHOT',
  'OPPORTUNITY_SCORE',
  'SIMILARITY_PAIR',
  'RESEARCH_PRODUCT',
  'RESEARCH_NOTE',
  'MEDIA_ASSET',
] as const
export type EvidenceType = (typeof EVIDENCE_TYPES)[number]

/** The kinds whose value moves under the brief; a capture of `{}` is refused at the table. */
export const VOLATILE_EVIDENCE: readonly EvidenceType[] = [
  'OPPORTUNITY_SCORE',
  'ANALYTICS_SNAPSHOT',
]

// --- per-type captured payloads --------------------------------------------------------------------

export const comparisonSetCaptureSchema = z.object({
  name: z.string(),
  slug: z.string(),
  memberCount: z.number().int().nonnegative(),
  lastComputedAt: z.string().nullable(),
})

/** The observed figures, each with the coverage record it rests on. Never a Rivya figure. */
export const observedFigureSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number().nullable(),
  unit: z.enum(['minor', 'mm', 'count', 'pct']),
  currency: z.string().nullable(),
  coverage: coverageRecordSchema,
})
export type ObservedFigure = z.infer<typeof observedFigureSchema>

export const analyticsSnapshotCaptureSchema = z.object({
  metricFamily: z.enum(['ASSORTMENT', 'PRICE_ARCHITECTURE', 'DIMENSIONS']),
  scopeType: z.string(),
  currency: z.string().nullable(),
  computedAt: z.string(),
  rowCount: z.number().int().nonnegative(),
  figures: z.array(observedFigureSchema),
})

export const opportunityScoreCaptureSchema = z.object({
  researchProductId: z.string().uuid(),
  score: z.number().int().nullable(),
  confidence: z.number(),
  completeness: z.number(),
  state: z.enum(['SCORED', 'INSUFFICIENT_DATA']),
  modelVersion: z.string(),
  computedAt: z.string(),
})

export const similarityPairCaptureSchema = z.object({
  band: z.string(),
  distance: z.number().int().nullable(),
  method: z.string(),
})

export const researchProductCaptureSchema = z.object({
  title: z.string().nullable(),
  sourceSlug: z.string(),
  stage: z.string(),
  priceState: z.string().nullable(),
  scaleBand: z.string().nullable(),
})

export const researchNoteCaptureSchema = z.object({
  excerpt: z.string(),
  createdAt: z.string(),
})

export const mediaAssetCaptureSchema = z.object({
  rivyaAssetId: z.string().nullable(),
  publicId: z.string(),
  isConcept: z.literal(true),
  isAiGenerated: z.literal(true),
})

export const CAPTURE_SCHEMAS = {
  COMPARISON_SET: comparisonSetCaptureSchema,
  ANALYTICS_SNAPSHOT: analyticsSnapshotCaptureSchema,
  OPPORTUNITY_SCORE: opportunityScoreCaptureSchema,
  SIMILARITY_PAIR: similarityPairCaptureSchema,
  RESEARCH_PRODUCT: researchProductCaptureSchema,
  RESEARCH_NOTE: researchNoteCaptureSchema,
  MEDIA_ASSET: mediaAssetCaptureSchema,
} as const

export type CapturedFor<T extends EvidenceType> = z.infer<(typeof CAPTURE_SCHEMAS)[T]>

export function parseCaptured<T extends EvidenceType>(type: T, value: unknown): CapturedFor<T> {
  return CAPTURE_SCHEMAS[type].parse(value) as CapturedFor<T>
}

// --- builders: research rows in, capture out ----------------------------------------------------------

/** The observed figures a PRICE_ARCHITECTURE or DIMENSIONS payload yields; ASSORTMENT yields none. */
export function figuresFromSnapshotPayload(payload: {
  readonly family: string
  readonly result: Record<string, unknown>
  readonly coverage: readonly z.infer<typeof coverageRecordSchema>[]
}): ObservedFigure[] {
  const coverage = payload.coverage[0]
  if (coverage === undefined) return []
  const result = payload.result
  if (payload.family === 'PRICE_ARCHITECTURE') {
    const currency = typeof result.currency === 'string' ? result.currency : null
    const percentiles = result.percentiles as Record<string, unknown> | null | undefined
    const number = (value: unknown): number | null => (typeof value === 'number' ? value : null)
    return [
      {
        key: 'price_min',
        label: 'Lowest observed price',
        value: number(result.minMinor),
        unit: 'minor',
        currency,
        coverage,
      },
      {
        key: 'price_median',
        label: 'Median observed price',
        value: number(percentiles?.median),
        unit: 'minor',
        currency,
        coverage,
      },
      {
        key: 'price_max',
        label: 'Highest observed price',
        value: number(result.maxMinor),
        unit: 'minor',
        currency,
        coverage,
      },
    ]
  }
  if (payload.family === 'DIMENSIONS') {
    const axes = Array.isArray(result.axes) ? (result.axes as Record<string, unknown>[]) : []
    const figures: ObservedFigure[] = []
    for (const axis of axes) {
      if (typeof axis.axis !== 'string') continue
      figures.push({
        key: `axis_${axis.axis}_p50`,
        label: `Median observed ${axis.axis}`,
        value: typeof axis.p50 === 'number' ? axis.p50 : null,
        unit: 'mm',
        currency: null,
        coverage,
      })
    }
    const tableScale = result.tableScale as Record<string, unknown> | undefined
    if (tableScale !== undefined && typeof tableScale.count === 'number') {
      figures.push({
        key: 'table_scale_count',
        label: 'Rows at table scale (longest axis ≥ 1 800 mm)',
        value: tableScale.count,
        unit: 'count',
        currency: null,
        coverage,
      })
    }
    return figures
  }
  return []
}

export interface ScoreDrift {
  readonly changed: boolean
  readonly captured: CapturedFor<'OPPORTUNITY_SCORE'>
  readonly current: CapturedFor<'OPPORTUNITY_SCORE'> | null
}

/** Has the score moved since it was attached? A missing current score is drift too. */
export function scoreDrift(
  captured: CapturedFor<'OPPORTUNITY_SCORE'>,
  current: CapturedFor<'OPPORTUNITY_SCORE'> | null,
): ScoreDrift {
  if (current === null) return { changed: true, captured, current }
  const changed =
    captured.score !== current.score ||
    captured.state !== current.state ||
    captured.modelVersion !== current.modelVersion
  return { changed, captured, current }
}

/** Has a snapshot been superseded since it was attached? Compared by computed_at. */
export function snapshotDrift(
  captured: CapturedFor<'ANALYTICS_SNAPSHOT'>,
  currentComputedAt: string | null,
): boolean {
  return currentComputedAt === null || currentComputedAt !== captured.computedAt
}
