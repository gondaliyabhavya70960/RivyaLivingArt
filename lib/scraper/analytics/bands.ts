/**
 * Price bands, by a declared rule.
 *
 * TWO RULES AND NO THIRD. `QUANTILE` derives the edges from the priced rows themselves, so the
 * bands describe where THIS set's prices sit; `FIXED` uses edges a researcher typed, so two sets can
 * be read against the same ladder. Which rule produced a result is stored with the result, because
 * two band charts are comparable only when their rule agrees, and a reader has to be able to see
 * when it does not.
 *
 * PERCENTILES USE LINEAR INTERPOLATION BETWEEN CLOSEST RANKS (Hyndman & Fan type 7, the default
 * in R, NumPy and every spreadsheet). Stated because a percentile has several definitions and a
 * hand-checked expectation in a test is only a check if the definition is the one the reader
 * assumed. For n = 1 every percentile is the single value.
 *
 * PURE. No I/O, no clock, no database — the reason every rule here is a fixture table.
 */

export const BAND_RULES = ['QUANTILE', 'FIXED'] as const
export type BandRule = (typeof BAND_RULES)[number]

/** How many bands a QUANTILE cut produces, and therefore how many interior edges: one fewer. */
export const QUANTILE_BAND_COUNT = 4

export interface Band {
  /** Inclusive lower edge, in minor units. Null on the first band only when the rule is FIXED. */
  readonly fromMinor: number | null
  /** Exclusive upper edge. Null on the last band: it is open-ended. */
  readonly toMinor: number | null
  readonly count: number
}

export interface BandResult {
  readonly rule: BandRule
  /** The interior edges actually used, ascending. Empty when nothing could be banded. */
  readonly edges: readonly number[]
  readonly bands: readonly Band[]
}

/** Sorted ascending copy. Every function below takes unsorted input and sorts once. */
function sorted(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b)
}

/**
 * The p-th percentile (0–100) of a non-empty list, type-7 interpolation. Throws on an empty list
 * rather than returning NaN: an absent figure is a coverage fact, not a number.
 */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) throw new RangeError('percentile of an empty list')
  if (!Number.isFinite(p) || p < 0 || p > 100) throw new RangeError(`percentile ${String(p)}`)
  const xs = sorted(values)
  const h = ((xs.length - 1) * p) / 100
  const lo = Math.floor(h)
  const hi = Math.min(lo + 1, xs.length - 1)
  const fraction = h - lo
  return xs[lo]! + fraction * (xs[hi]! - xs[lo]!)
}

/**
 * Interior edges for a QUANTILE cut into `bandCount` bands.
 *
 * DEDUPLICATED AND ASCENDING, because a set whose prices cluster produces repeated quantiles, and
 * two equal edges would define an empty band that reads as a gap in the market. Fewer bands than
 * asked for is the honest output there.
 */
export function quantileEdges(
  values: readonly number[],
  bandCount = QUANTILE_BAND_COUNT,
): readonly number[] {
  if (values.length === 0) return []
  const min = Math.min(...values)
  const edges: number[] = []
  for (let k = 1; k < bandCount; k += 1) {
    const edge = Math.round(percentile(values, (100 * k) / bandCount))
    // An edge at or below the minimum would define an empty band beneath it; a repeated edge
    // would define an empty band between two equal rungs. Both are skipped.
    if (edge > min && (edges.length === 0 || edge > edges[edges.length - 1]!)) edges.push(edge)
  }
  return edges
}

/**
 * Validate a FIXED ladder: integers, strictly ascending, at least one edge. Returns the cleaned
 * list or throws — a typed edge that is not a number is a form error, never a silent zero.
 */
export function fixedEdges(edges: readonly number[]): readonly number[] {
  if (edges.length === 0) throw new RangeError('a FIXED band rule needs at least one edge')
  const cleaned = edges.map((edge) => {
    if (!Number.isInteger(edge) || edge < 0) throw new RangeError(`band edge ${String(edge)}`)
    return edge
  })
  for (let i = 1; i < cleaned.length; i += 1) {
    if (cleaned[i]! <= cleaned[i - 1]!)
      throw new RangeError('band edges must be strictly ascending')
  }
  return cleaned
}

/**
 * Count values into the bands the edges define. `edges = [a, b]` gives three bands:
 * `[min, a)`, `[a, b)`, `[b, ∞)`. The first band's lower edge is the smallest value under a
 * QUANTILE rule (so the chart starts where the data starts) and null under FIXED (so it reads as
 * "everything below the first rung").
 */
export function assignBands(
  values: readonly number[],
  edges: readonly number[],
  rule: BandRule,
): readonly Band[] {
  const xs = sorted(values)
  const lower = rule === 'QUANTILE' && xs.length > 0 ? xs[0]! : null
  const bounds: (number | null)[] = [lower, ...edges, null]
  const bands: Band[] = []
  for (let i = 0; i < bounds.length - 1; i += 1) {
    const from = bounds[i] ?? null
    const to = bounds[i + 1] ?? null
    const count = xs.filter(
      (value) => (from === null || value >= from) && (to === null || value < to),
    ).length
    bands.push({ fromMinor: from, toMinor: to, count })
  }
  return bands
}

export function bandValues(
  values: readonly number[],
  rule: BandRule,
  fixed?: readonly number[],
): BandResult {
  const edges = rule === 'FIXED' ? fixedEdges(fixed ?? []) : quantileEdges(values)
  if (values.length === 0) return { rule, edges, bands: [] }
  return { rule, edges, bands: assignBands(values, edges, rule) }
}

/** Which band (index into `edges`+1 bands) a single value falls in. Used by Phase 32's gap signal. */
export function bandIndex(value: number, edges: readonly number[]): number {
  let index = 0
  for (const edge of edges) {
    if (value >= edge) index += 1
    else break
  }
  return index
}
