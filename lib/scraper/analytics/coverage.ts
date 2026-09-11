/**
 * How much of this is actually known?
 *
 * FEAT §28: **do not manufacture unavailable analytics data; clearly state coverage.** Every panel
 * in the large-format workspace is conditional on how many rows had parsable dimensions, and a
 * chart that draws the answerable rows and says nothing about the rest is not neutral — it reports
 * a distribution over a sample it does not disclose, which is the most persuasive way to be wrong.
 *
 * SO COVERAGE IS A PROP EVERY PANEL TAKES, and the banner sits ABOVE the charts rather than in a
 * footnote. A person should have read "412 rows, 190 with measurements, 46 %" before they read
 * anything drawn from those 190.
 *
 * IT IS PURE ARITHMETIC OVER COUNTS, deliberately. A helper that ran its own query would give each
 * panel a slightly different denominator depending on when it ran, and two panels on one screen
 * disagreeing about the sample size is worse than either being wrong on its own.
 */

export interface Coverage {
  /** Rows the panel's filter selected, before anything was excluded for being unmeasurable. */
  readonly inScope: number
  /** Of those, how many the panel could actually use. */
  readonly parsed: number
  /** `inScope - parsed`. Carried explicitly so a panel cannot forget to render it. */
  readonly unknown: number
  /** `parsed / inScope`, 0 when nothing is in scope. Rounded to whole percent for display. */
  readonly pct: number
}

/**
 * ZERO IN SCOPE IS 0 %, NOT 100 %.
 *
 * The tempting arithmetic — no rows, nothing missing, therefore complete coverage — produces a
 * banner reading "100 % coverage" above an empty chart, which is the single most misleading thing
 * this module could output. An empty workspace should say it is empty.
 */
export function coverage(inScope: number, parsed: number): Coverage {
  const scope = Math.max(0, Math.trunc(inScope))
  const known = Math.min(Math.max(0, Math.trunc(parsed)), scope)
  return {
    inScope: scope,
    parsed: known,
    unknown: scope - known,
    pct: scope === 0 ? 0 : Math.round((known / scope) * 100),
  }
}

/**
 * The three-valued tally every count in this workspace reports.
 *
 * `unknown` IS NOT AN ERROR BUCKET, it is one of the three answers. A tally that reported only true
 * and false would let a reader infer the third by subtraction from a total it did not print — and
 * in practice nobody subtracts; they read the two numbers as the whole picture.
 */
export interface Tally {
  readonly yes: number
  readonly no: number
  readonly unknown: number
}

export function tallyThreeValued(values: readonly (boolean | null | undefined)[]): Tally {
  let yes = 0
  let no = 0
  let unknown = 0
  for (const value of values) {
    if (value === true) yes += 1
    else if (value === false) no += 1
    else unknown += 1
  }
  return { yes, no, unknown }
}

/**
 * Counts by band, with every band present even at zero.
 *
 * **THE `UNKNOWN` BUCKET IS NEVER DROPPED TO MAKE A CHART TIDY**, and neither is any other empty
 * band. A distribution that renders only the bands with rows changes shape as it fills, and the
 * shape is what a person is reading; an empty `SIDE` column is information, and its absence is
 * indistinguishable from the band not existing.
 */
export function tallyByBand<T extends string>(
  bands: readonly T[],
  values: readonly (T | null | undefined)[],
): Readonly<Record<T, number>> {
  const counts = Object.fromEntries(bands.map((band) => [band, 0])) as Record<T, number>
  for (const value of values) {
    if (value === null || value === undefined) continue
    if (value in counts) counts[value] += 1
  }
  return counts
}

/**
 * Prices grouped by currency, and quote-only rows counted rather than dropped.
 *
 * **CURRENCIES ARE NEVER MIXED.** Phase 28's rule: no conversion exists anywhere under
 * `lib/scraper/`, because a rate is a fact about a day and inventing one would fabricate every
 * figure computed from it. So a price panel renders one group per currency and no combined total —
 * there is no honest total to render.
 *
 * QUOTE-ONLY ROWS ARE THEIR OWN COLUMN. A competitor who withdraws public prices is telling us
 * something, and excluding those rows silently would make an expensive-looking source look cheap
 * by dropping exactly its expensive half.
 */
export interface PriceGroup {
  readonly currency: string
  readonly count: number
  readonly minMinor: number
  readonly maxMinor: number
  /** The arithmetic mean, in minor units. Integer, because a fraction of a penny is noise. */
  readonly meanMinor: number
}

export interface PriceSummary {
  readonly groups: readonly PriceGroup[]
  /** Rows whose price posture is a quote rather than an amount. Counted, never dropped. */
  readonly quoteOnly: number
  /** Rows with no price information at all. */
  readonly unpriced: number
}

export function summarisePrices(
  rows: readonly {
    readonly currency: string | null
    readonly priceState: string | null
    readonly priceMinMinor: number | null
  }[],
): PriceSummary {
  const QUOTE = new Set(['REQUEST_QUOTE', 'PRICE_ON_REQUEST'])
  const byCurrency = new Map<string, number[]>()
  let quoteOnly = 0
  let unpriced = 0

  for (const row of rows) {
    if (row.priceState !== null && QUOTE.has(row.priceState)) {
      quoteOnly += 1
      continue
    }
    if (row.currency === null || row.priceMinMinor === null) {
      unpriced += 1
      continue
    }
    const list = byCurrency.get(row.currency) ?? []
    list.push(row.priceMinMinor)
    byCurrency.set(row.currency, list)
  }

  const groups = [...byCurrency.entries()]
    .map(([currency, amounts]) => ({
      currency,
      count: amounts.length,
      minMinor: Math.min(...amounts),
      maxMinor: Math.max(...amounts),
      meanMinor: Math.round(amounts.reduce((total, value) => total + value, 0) / amounts.length),
    }))
    // Largest group first: with no total to render, the order is the only ranking a reader gets.
    .sort((a, b) => b.count - a.count)

  return { groups, quoteOnly, unpriced }
}
