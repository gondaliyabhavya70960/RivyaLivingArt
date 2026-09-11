import { bandValues, percentile, type BandResult, type BandRule } from './bands'
import { coverageRecord, ExclusionTally, SAMPLE_FLOOR, type CoverageRecord } from './coverage'
import { DEFAULT_STALE_AFTER_DAYS, isStale, type AnalyticsRow } from './rows'

/**
 * Price architecture: where a set's prices sit and how they are spaced — WITHIN ONE CURRENCY.
 *
 * THE ONE RULE THAT SHAPES EVERYTHING HERE: CURRENCIES ARE NEVER MIXED. Phase 28 keeps no
 * conversion anywhere under lib/scraper/ because a rate is a fact about a day and inventing one
 * would fabricate every figure computed from it. So this function THROWS on mixed input rather than
 * quietly producing a meaningless band, and the caller splits by currency first
 * (`splitByCurrency`) and renders one panel per currency with no combined total. The snapshot
 * table's unique key includes the currency for the same reason from the other side.
 *
 * WHICH ROWS ARE PRICED. `FIXED` and `STARTING_FROM` with a `priceMinMinor`. `REQUEST_QUOTE` and
 * `PRICE_ON_REQUEST` are counted under `quote_only_price` and never imputed as zero — a competitor
 * withdrawing public prices is telling us something, and excluding those rows silently would make
 * an expensive-looking source look cheap by dropping exactly its expensive half. `UNKNOWN`, a null
 * state, and a null amount are `no_price`. A priced row with no currency (Phase 28: `$` alone is
 * AMBIGUOUS) is `ambiguous_currency`.
 *
 * THE COMPARABLE POINT OF A RANGE IS ITS LOWER BOUND, stated on the panel. `priceMaxMinor` is used
 * only for the range-width figure beside the histogram.
 *
 * BELOW THE SAMPLE FLOOR THE PERCENTILES ARE WITHHELD, and `insufficientSample` is true. The
 * histogram and bands still render — a reader can see four bars — but no median is printed for a
 * reader to carry away as a market fact.
 */

export class MixedCurrencyError extends Error {
  readonly currencies: readonly string[]
  constructor(currencies: readonly string[]) {
    super(`price architecture refuses mixed currencies: ${currencies.join(', ')}`)
    this.name = 'MixedCurrencyError'
    this.currencies = currencies
  }
}

export const PRICED_STATES = new Set(['FIXED', 'STARTING_FROM'])
export const QUOTE_STATES = new Set(['REQUEST_QUOTE', 'PRICE_ON_REQUEST'])

export interface Percentiles {
  readonly p10: number
  readonly p25: number
  readonly median: number
  readonly p75: number
  readonly p90: number
}

export interface HistogramBin {
  readonly fromMinor: number
  /** Exclusive, except on the last bin which is inclusive so the maximum lands somewhere. */
  readonly toMinor: number
  readonly count: number
}

export interface PriceArchitectureResult {
  readonly currency: string | null
  readonly n: number
  readonly insufficientSample: boolean
  readonly sampleFloor: number
  readonly minMinor: number | null
  readonly maxMinor: number | null
  readonly percentiles: Percentiles | null
  readonly histogram: readonly HistogramBin[]
  readonly bands: BandResult
  /** Rows carrying a max as well as a min, and the median width between them. */
  readonly ranges: { readonly count: number; readonly medianWidthMinor: number | null }
  readonly coverage: CoverageRecord
}

export interface PriceArchitectureOptions {
  readonly asOf: Date
  readonly bandRule?: BandRule
  readonly bandEdges?: readonly number[]
  readonly sampleFloor?: number
  readonly histogramBins?: number
  readonly staleAfterDays?: number
}

export const METRIC_KEY = 'price_architecture'

/** Group rows by currency; rows with no currency go under `null` and are `ambiguous_currency`. */
export function splitByCurrency(
  rows: readonly AnalyticsRow[],
): ReadonlyMap<string | null, readonly AnalyticsRow[]> {
  const groups = new Map<string | null, AnalyticsRow[]>()
  for (const row of rows) {
    const key = row.currency === null ? null : row.currency.toUpperCase()
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }
  return groups
}

export function computePriceArchitecture(
  rows: readonly AnalyticsRow[],
  options: PriceArchitectureOptions,
): PriceArchitectureResult {
  const currencies = [
    ...new Set(rows.map((row) => row.currency).filter((c): c is string => c !== null)),
  ]
  if (currencies.length > 1) throw new MixedCurrencyError(currencies)

  const sampleFloor = options.sampleFloor ?? SAMPLE_FLOOR
  const staleAfterDays = options.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS
  const excluded = new ExclusionTally()
  const amounts: number[] = []
  const widths: number[] = []

  for (const row of rows) {
    if (isStale(row, options.asOf, staleAfterDays)) {
      excluded.add('stale')
      continue
    }
    if (row.priceState !== null && QUOTE_STATES.has(row.priceState)) {
      excluded.add('quote_only_price')
      continue
    }
    if (
      row.priceState === null ||
      !PRICED_STATES.has(row.priceState) ||
      row.priceMinMinor === null
    ) {
      excluded.add('no_price')
      continue
    }
    if (row.currency === null) {
      excluded.add('ambiguous_currency')
      continue
    }
    amounts.push(row.priceMinMinor)
    if (row.priceMaxMinor !== null && row.priceMaxMinor > row.priceMinMinor) {
      widths.push(row.priceMaxMinor - row.priceMinMinor)
    }
  }

  const coverage = coverageRecord(
    METRIC_KEY,
    rows.length,
    excluded.counts,
    options.asOf.toISOString(),
  )
  const n = amounts.length
  const insufficientSample = n < sampleFloor
  const bands = bandValues(amounts, options.bandRule ?? 'QUANTILE', options.bandEdges)

  return {
    currency: currencies[0] ?? null,
    n,
    insufficientSample,
    sampleFloor,
    minMinor: n === 0 ? null : Math.min(...amounts),
    maxMinor: n === 0 ? null : Math.max(...amounts),
    percentiles:
      n === 0 || insufficientSample
        ? null
        : {
            p10: percentile(amounts, 10),
            p25: percentile(amounts, 25),
            median: percentile(amounts, 50),
            p75: percentile(amounts, 75),
            p90: percentile(amounts, 90),
          },
    histogram: histogram(amounts, options.histogramBins ?? 10),
    bands,
    ranges: {
      count: widths.length,
      medianWidthMinor: widths.length === 0 ? null : percentile(widths, 50),
    },
    coverage,
  }
}

/** Equal-width bins over [min, max]. One bin when every amount is the same. */
export function histogram(amounts: readonly number[], bins: number): readonly HistogramBin[] {
  if (amounts.length === 0) return []
  const min = Math.min(...amounts)
  const max = Math.max(...amounts)
  if (max === min) return [{ fromMinor: min, toMinor: max, count: amounts.length }]
  const width = (max - min) / bins
  const out: HistogramBin[] = []
  for (let i = 0; i < bins; i += 1) {
    const from = min + i * width
    const to = i === bins - 1 ? max : min + (i + 1) * width
    const count = amounts.filter(
      (value) => value >= from && (i === bins - 1 ? value <= to : value < to),
    ).length
    out.push({ fromMinor: Math.round(from), toMinor: Math.round(to), count })
  }
  return out
}
