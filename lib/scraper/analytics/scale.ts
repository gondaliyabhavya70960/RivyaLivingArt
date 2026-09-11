import type { DimensionsMm, ParseState } from '../normalization/schema'

/**
 * Is this large, and what kind of thing is it?
 *
 * THE ONE DECISION EVERYTHING ELSE FOLLOWS FROM: `isLargeFormat` IS THREE-VALUED. True, false, and
 * null meaning "we could not tell". A boolean would force a row whose dimensions could not be
 * parsed to `false`, and every distribution built on the column would then under-report large work
 * in proportion to how badly a source writes its pages — a failure that looks exactly like a
 * finding. So rule 10 sends an unparsed row to `UNKNOWN` before any threshold is applied, and every
 * panel in the workspace renders the unknown bucket beside the other two.
 *
 * AND THE NULL VERDICT IS ABOUT THE MEASUREMENT, NOT THE BAND. Those are different questions, and
 * the first version of this file conflated them: a well-measured 1 150 mm piece whose proportions
 * match no band signature is banded `UNKNOWN`, and its SIZE is perfectly well known. Calling that
 * one "could not tell" would hide a confident answer among the unanswerable ones.
 *
 * THE RULES ARE ORDERED AND THE FIRST MATCH WINS. Not scored: a scoring system needs somebody to
 * explain why a row came out where it did, and an ordered list is readable top to bottom by the
 * person editing it. "Rule 30 caught it" is an answer a merchandiser can act on, which is why the
 * matching rule's id is stored on the row.
 *
 * THE PREDICATE VOCABULARY IS CLOSED. `research_large_format_rules.predicate` is jsonb a Studio
 * form writes into, and a rule engine that evaluated arbitrary expressions from it would be the
 * shape of an injection as well as impossible to typecheck. Three keys are read and everything
 * else is ignored, so a predicate somebody invents is inert rather than dangerous.
 *
 * IT IS PURE, for `normalization/`'s reason: no I/O, no clock, no database. That is what makes
 * every rule a fixture table and `reclassify-scale.ts` a loop over stored rows with zero network
 * traffic.
 *
 * NOTHING HERE IS A DISPOSITION. A scale band says what KIND of object a page describes; it carries
 * no judgement about whether Rivya should care. `research.write`, the operating half of the Phase
 * 04 split — this phase writes no `disposition`, no `duplicate_of_id` and no `stage`.
 */

/**
 * Rivya's own `largeformat-*` vocabulary, deliberately.
 *
 * A merchandiser who has spent a year calling something a console table should not have to learn a
 * second word for it because the research subsystem invented one. The band names match the
 * Higgsfield manifest families so one set of words reads across the whole system — the NAMES are
 * borrowed, none of the assets are, and no band token may appear on a public surface.
 */
export const SCALE_BANDS = [
  'DINING',
  'CONSOLE',
  'COFFEE',
  'SEATING',
  'SIDE',
  'MONUMENTAL',
  'WALL',
  'UNKNOWN',
] as const
export type ScaleBand = (typeof SCALE_BANDS)[number]

export const LARGE_FORMAT_SOURCES = ['RULE', 'EDITOR', 'UNKNOWN'] as const
export type LargeFormatSource = (typeof LARGE_FORMAT_SOURCES)[number]

/** The three keys a rule predicate may carry. Anything else is ignored rather than evaluated. */
export interface ScalePredicate {
  /** `'NOT_PARSED'` matches a row whose dimensions are anything but `PARSED`. */
  readonly parseState?: 'NOT_PARSED' | ParseState
  readonly minLongestAxisMm?: number
  readonly categoryInLargeFormatSet?: boolean
}

export interface ScaleRule {
  readonly id: string
  readonly priority: number
  readonly predicate: ScalePredicate
  readonly resultBand: ScaleBand | null
  readonly resultIsLarge: boolean | null
  readonly isEnabled: boolean
}

/** What the classifier is given about one row. */
export interface ScaleInput {
  readonly dimensionsMm: DimensionsMm | null
  readonly dimensionParseState: ParseState
  /** True when the row's matched category is one Rivya has mapped as large-format. */
  readonly categoryIsLargeFormat: boolean
}

export interface Classification {
  readonly band: ScaleBand
  readonly isLargeFormat: boolean | null
  readonly longestAxisMm: number | null
  readonly source: LargeFormatSource
  /** Which rule decided it, so the workspace can say so per row. */
  readonly ruleId: string | null
}

/**
 * The longest measured extent, in millimetres.
 *
 * EVERY AXIS COUNTS, INCLUDING DIAMETER. A round table two metres across is large-format by any
 * reading, and a rule looking only at `length_mm` would miss every circular piece in the corpus —
 * which is a systematic blind spot rather than a rounding error, because round tables are exactly
 * the large dining pieces this workspace exists to find.
 *
 * NULL WHEN THE DIMENSIONS ARE NOT `PARSED`. Phase 28's invariant is that `dimensions_mm` is null
 * unless the parse succeeded, and this respects the same line: no length is derived from an
 * ambiguous string here, because doing it one layer down would launder a guess into a number.
 */
export function longestAxis(
  dimensionsMm: DimensionsMm | null,
  parseState: ParseState,
): number | null {
  if (parseState !== 'PARSED' || dimensionsMm === null) return null
  const values = Object.values(dimensionsMm).filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0,
  )
  return values.length === 0 ? null : Math.max(...values)
}

/** Does this predicate match? An empty predicate matches everything, which is what a fallthrough is. */
export function matches(
  predicate: ScalePredicate,
  input: ScaleInput,
  longest: number | null,
): boolean {
  if (predicate.parseState === 'NOT_PARSED') {
    if (input.dimensionParseState === 'PARSED') return false
  } else if (predicate.parseState !== undefined) {
    if (input.dimensionParseState !== predicate.parseState) return false
  }

  if (predicate.minLongestAxisMm !== undefined) {
    // A ROW WITH NO MEASUREMENT NEVER MATCHES A MEASUREMENT RULE. Rule 10 has already caught it in
    // the default set; this is the guard for a rule set somebody has reordered.
    if (longest === null || longest < predicate.minLongestAxisMm) return false
  }

  if (predicate.categoryInLargeFormatSet !== undefined) {
    if (input.categoryIsLargeFormat !== predicate.categoryInLargeFormatSet) return false
  }

  return true
}

/**
 * The band, from the matched category's shape plus a height and length signature.
 *
 * THE SIGNATURE IS A LAST RESORT, NOT THE FIRST ANSWER. Where a row has a matched category, that
 * category is what Rivya's own taxonomy says the thing is, and it beats any inference from
 * numbers. The signature exists for the rows that have measurements and no category — which on a
 * corpus of other people's pages is a great many of them.
 *
 * IT RETURNS `UNKNOWN` RATHER THAN A GUESS. A row 900 mm long and 400 mm high could be a bench, a
 * coffee table or a low console, and picking one would put it in a distribution somebody reads as
 * evidence.
 */
export function bandFor(
  input: ScaleInput,
  longest: number | null,
  categoryBand: ScaleBand | null,
): ScaleBand {
  if (categoryBand !== null) return categoryBand
  if (longest === null) return 'UNKNOWN'

  const height = input.dimensionsMm?.height_mm ?? null

  // TALL BEFORE LONG. A two-metre-high piece is monumental whatever its footprint, and asking
  // about length first would band a tall narrow cabinet by its base.
  if (height !== null && height >= 2_000) return 'MONUMENTAL'
  if (height !== null && height >= 1_400) return 'WALL'

  // Dining height is a narrow, well-observed band: 700-800 mm is where tables people eat at sit,
  // and it is the one signature on this list that is genuinely diagnostic.
  if (longest >= 1_600 && height !== null && height >= 700 && height <= 800) return 'DINING'

  // A console is long, shallow and roughly dining height; without a depth to check, it is not
  // separable from a dining table, so this only fires where the depth is known.
  const depth = input.dimensionsMm?.depth_mm ?? input.dimensionsMm?.width_mm ?? null
  if (longest >= 1_200 && depth !== null && depth <= 450 && height !== null && height >= 700) {
    return 'CONSOLE'
  }

  if (height !== null && height <= 500 && longest >= 900) return 'COFFEE'
  if (height !== null && height <= 500) return 'SIDE'

  return 'UNKNOWN'
}

/**
 * Run the rules over one row.
 *
 * DISABLED RULES ARE SKIPPED, NOT TREATED AS FAILING. A rule somebody switched off should behave as
 * though it were not in the list at all — the next rule gets its turn — rather than as a rule that
 * matches nothing, which would leave rows falling through to the fallthrough with no explanation.
 *
 * A ROW MATCHING NOTHING IS `UNKNOWN`, NEVER SMALL. It is the same argument as the three-valued
 * column: "no rule placed this" and "this is small" are different facts, and a rule set somebody
 * has edited into a state where nothing matches should be visible as a wall of `UNKNOWN` rather
 * than as a sudden collapse in the large-format count.
 */
export function classifyScale(
  input: ScaleInput,
  rules: readonly ScaleRule[],
  categoryBand: ScaleBand | null = null,
): Classification {
  const longest = longestAxis(input.dimensionsMm, input.dimensionParseState)
  const ordered = [...rules]
    .filter((rule) => rule.isEnabled)
    .sort((a, b) => a.priority - b.priority)

  for (const rule of ordered) {
    if (!matches(rule.predicate, input, longest)) continue

    const band = rule.resultBand ?? bandFor(input, longest, categoryBand)
    /*
     * A ROW WITH NO MEASUREMENT HAS NO VERDICT — AND THAT IS ABOUT THE MEASUREMENT, NOT THE BAND.
     *
     * The two are different questions and conflating them was a real defect in the first version of
     * this file: it returned a null verdict whenever the BAND came out `UNKNOWN`, which caught a
     * perfectly well-measured 1 150 mm piece whose proportions match no band signature. That row's
     * size is known — it is not large — and reporting "could not tell" about it would move it into
     * the very bucket the three-valued column exists to keep honest, hiding a confident answer
     * among the unanswerable ones. Caught by `tests/unit/scale-rules.test.ts` asserting the phase
     * document's own four rows.
     *
     * So: no `longestAxisMm` means no verdict. `research_products_unmeasured_has_no_verdict` says
     * the same thing at the row.
     */
    const isLarge = longest === null ? null : rule.resultIsLarge

    return {
      band,
      isLargeFormat: isLarge,
      longestAxisMm: longest,
      source: 'RULE',
      ruleId: rule.id,
    }
  }

  return {
    band: 'UNKNOWN',
    isLargeFormat: null,
    longestAxisMm: longest,
    source: 'UNKNOWN',
    ruleId: null,
  }
}

/**
 * Should the reclassification pass touch this row?
 *
 * `EDITOR` FREEZES IT, PERMANENTLY, AND THE PASS REPORTS THE SKIP RATHER THAN PASSING OVER IT
 * QUIETLY. A researcher who corrected a misclassification by hand has made a judgement from
 * evidence the rules do not have — a photograph, the source's own copy, knowledge of the piece —
 * and a threshold edit two months later must not silently undo it. Reporting the skip is the other
 * half: somebody editing the rules needs to know how many rows their edit did NOT reach.
 */
export function isFrozen(source: LargeFormatSource | null): boolean {
  return source === 'EDITOR'
}
