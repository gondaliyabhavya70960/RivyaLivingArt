import { percentile } from './bands'
import { coverageRecord, ExclusionTally, SAMPLE_FLOOR, type CoverageRecord } from './coverage'
import { DEFAULT_STALE_AFTER_DAYS, isStale, type AnalyticsRow } from './rows'

/**
 * Dimension analysis, over the rows whose dimensions actually parsed.
 *
 * ONLY `dimensionParseState = 'PARSED'` ROWS ARE MEASURED. `AMBIGUOUS` and `UNPARSED` are counted
 * under `dimensions_unparsed`, `ABSENT` under `no_dimensions`, and neither is ever guessed at. There
 * is no numeric confidence to threshold on, deliberately: Phase 28 records a parse STATE rather
 * than a score because it refuses to infer a unit from a magnitude, so a row either parsed or it did
 * not.
 *
 * THE TABLE-SCALE CUT IS THE SAME 1 800 mm PHASE 30's WORKSPACE USES, read from `longestAxisMm`,
 * so the two surfaces agree row for row. A scatter of width against height is emitted for rows
 * carrying both; the caller draws it, this module never does.
 *
 * PURE, like every module in this directory.
 */

export const AXES = ['width_mm', 'depth_mm', 'height_mm', 'diameter_mm'] as const
export type Axis = (typeof AXES)[number]

export const TABLE_SCALE_MM = 1800

/** Longest-axis buckets, in millimetres. Closed vocabulary so the chart's shape is stable. */
export const LONGEST_AXIS_BUCKETS: readonly {
  readonly label: string
  readonly fromMm: number
  readonly toMm: number | null
}[] = [
  { label: '< 600', fromMm: 0, toMm: 600 },
  { label: '600–1199', fromMm: 600, toMm: 1200 },
  { label: '1200–1799', fromMm: 1200, toMm: 1800 },
  { label: '1800–2399', fromMm: 1800, toMm: 2400 },
  { label: '≥ 2400', fromMm: 2400, toMm: null },
]

export interface AxisSummary {
  readonly axis: Axis
  readonly n: number
  readonly insufficientSample: boolean
  readonly p10: number | null
  readonly p50: number | null
  readonly p90: number | null
}

export interface ScatterPoint {
  readonly id: string
  readonly widthMm: number
  readonly heightMm: number
}

export interface DimensionsResult {
  readonly n: number
  readonly sampleFloor: number
  readonly axes: readonly AxisSummary[]
  readonly longestAxis: readonly { readonly label: string; readonly count: number }[]
  readonly scatter: readonly ScatterPoint[]
  readonly tableScale: {
    readonly thresholdMm: number
    readonly count: number
    readonly share: number
  }
  readonly coverage: CoverageRecord
}

export interface DimensionsOptions {
  readonly asOf: Date
  readonly sampleFloor?: number
  readonly staleAfterDays?: number
}

export const METRIC_KEY = 'dimensions'

export function computeDimensions(
  rows: readonly AnalyticsRow[],
  options: DimensionsOptions,
): DimensionsResult {
  const sampleFloor = options.sampleFloor ?? SAMPLE_FLOOR
  const staleAfterDays = options.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS
  const excluded = new ExclusionTally()
  const measured: AnalyticsRow[] = []

  for (const row of rows) {
    if (isStale(row, options.asOf, staleAfterDays)) {
      excluded.add('stale')
      continue
    }
    if (row.dimensionParseState === 'ABSENT') {
      excluded.add('no_dimensions')
      continue
    }
    if (row.dimensionParseState !== 'PARSED' || row.dimensionsMm === null) {
      excluded.add('dimensions_unparsed')
      continue
    }
    measured.push(row)
  }

  const axes = AXES.map((axis): AxisSummary => {
    const values = measured
      .map((row) => row.dimensionsMm?.[axis])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    const insufficient = values.length < sampleFloor
    return {
      axis,
      n: values.length,
      insufficientSample: insufficient,
      p10: values.length === 0 || insufficient ? null : percentile(values, 10),
      p50: values.length === 0 || insufficient ? null : percentile(values, 50),
      p90: values.length === 0 || insufficient ? null : percentile(values, 90),
    }
  })

  const longest = measured
    .map((row) => row.longestAxisMm)
    .filter((value): value is number => value !== null)
  const longestAxis = LONGEST_AXIS_BUCKETS.map((bucket) => ({
    label: bucket.label,
    count: longest.filter(
      (value) => value >= bucket.fromMm && (bucket.toMm === null || value < bucket.toMm),
    ).length,
  }))

  const scatter = measured.flatMap((row): ScatterPoint[] => {
    const width = row.dimensionsMm?.width_mm
    const height = row.dimensionsMm?.height_mm
    if (typeof width !== 'number' || typeof height !== 'number') return []
    return [{ id: row.id, widthMm: width, heightMm: height }]
  })

  const tableScaleCount = longest.filter((value) => value >= TABLE_SCALE_MM).length

  return {
    n: measured.length,
    sampleFloor,
    axes,
    longestAxis,
    scatter,
    tableScale: {
      thresholdMm: TABLE_SCALE_MM,
      count: tableScaleCount,
      share:
        measured.length === 0 ? 0 : Math.round((tableScaleCount / measured.length) * 1000) / 10,
    },
    coverage: coverageRecord(METRIC_KEY, rows.length, excluded.counts, options.asOf.toISOString()),
  }
}
