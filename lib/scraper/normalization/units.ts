/**
 * Numbers and units, and the one rule that governs both: **nothing is inferred from magnitude**.
 *
 * `120` IS NOT 120 CM BECAUSE 120 MM WOULD BE A SMALL TABLE. That reasoning is how a comparison
 * table ends up with a sideboard measured in the wrong unit, and it is wrong for a reason worth
 * stating: a site that lists in inches, a site that lists in centimetres and a site that lists in
 * millimetres all publish three-digit numbers, so magnitude distinguishes nothing. A unitless
 * measurement is AMBIGUOUS. It stays ambiguous until somebody configures the source or corrects the
 * row, and the explorer shows it as ambiguous the whole time.
 *
 * MILLIMETRES ARE CANONICAL, AS INTEGERS. Furniture is not measured to a tenth of a millimetre by
 * anybody, and a float in a jsonb column is a value that compares unequal to itself after a round
 * trip through two JSON encoders. Rounding happens once, here, at the end of a conversion.
 */

/** The exact definition, not an approximation: one inch IS 25.4 mm by international agreement. */
export const MM_PER_INCH = 25.4
export const MM_PER_FOOT = MM_PER_INCH * 12
export const MM_PER_CM = 10
export const MM_PER_M = 1_000

/**
 * The units a furniture page actually writes, and what each is worth in millimetres.
 *
 * SPELLINGS ARE LISTED RATHER THAN PATTERN-MATCHED. `m` and `mm` differ by one character and by
 * three orders of magnitude, and a regex that reads `mm` as `m` followed by a stray letter is a
 * thousand-fold error that looks like a typo in the source. An explicit table cannot make that
 * mistake, and a spelling nobody listed reads as no unit at all — which is AMBIGUOUS, the safe
 * answer.
 */
const UNIT_TABLE: ReadonlyArray<readonly [string, number]> = [
  ['millimetres', 1],
  ['millimeters', 1],
  ['millimetre', 1],
  ['millimeter', 1],
  ['centimetres', MM_PER_CM],
  ['centimeters', MM_PER_CM],
  ['centimetre', MM_PER_CM],
  ['centimeter', MM_PER_CM],
  ['inches', MM_PER_INCH],
  ['inch', MM_PER_INCH],
  ['metres', MM_PER_M],
  ['meters', MM_PER_M],
  ['metre', MM_PER_M],
  ['meter', MM_PER_M],
  ['feet', MM_PER_FOOT],
  ['foot', MM_PER_FOOT],
  ['mm', 1],
  ['cm', MM_PER_CM],
  ['in', MM_PER_INCH],
  ['ft', MM_PER_FOOT],
  ['m', MM_PER_M],
  ['"', MM_PER_INCH],
  ['”', MM_PER_INCH],
  ['″', MM_PER_INCH],
  ["'", MM_PER_FOOT],
  ['’', MM_PER_FOOT],
  ['′', MM_PER_FOOT],
]

export type LengthUnit = (typeof UNIT_TABLE)[number][0]

/**
 * Longest spelling first, so `centimetres` is never read as `cm` with a suffix and `mm` is never
 * read as `m`. The sort is done once at module load rather than trusted to the literal's order,
 * because the literal is a list somebody will add a line to.
 */
const UNITS_BY_LENGTH: ReadonlyArray<readonly [string, number]> = [...UNIT_TABLE].sort(
  (a, b) => b[0].length - a[0].length,
)

/** Every unit spelling, longest first. Exported so the dimension patterns are built from one list. */
export const UNIT_SPELLINGS: readonly string[] = UNITS_BY_LENGTH.map(([spelling]) => spelling)

const UNIT_FACTORS = new Map<string, number>(UNITS_BY_LENGTH)

/** How many millimetres one of `unit` is, or null when the spelling is not one this module knows. */
export function unitFactor(unit: string): number | null {
  return UNIT_FACTORS.get(unit.trim().toLowerCase()) ?? null
}

/**
 * A decimal number as written in a measurement, to a float.
 *
 * MEASUREMENTS USE A DOT, PRICES DO NOT. A price's decimal separator is per-source configuration
 * because `1.234` is genuinely two different numbers in two conventions (see `currency.ts`); a
 * measurement is not, because a furniture page writing `1.234 cm` means one and a bit centimetres
 * and no page writes a thousand two hundred and thirty-four centimetres for a table. So this reads
 * a comma as a decimal point when it is the only separator and there are one or two digits after it
 * — `45,5 cm` — and refuses anything else rather than guessing.
 */
export function parseMeasurementNumber(raw: string): number | null {
  const text = raw.trim().replace(/\s+/gu, '')
  if (text === '') return null

  const commaDecimal = /^(\d+),(\d{1,2})$/u.exec(text)
  const normalised = commaDecimal ? `${commaDecimal[1]}.${commaDecimal[2]}` : text
  if (!/^\d+(?:\.\d+)?$/u.test(normalised)) return null

  const value = Number(normalised)
  return Number.isFinite(value) ? value : null
}

/**
 * A value plus a unit, in millimetres, rounded to the nearest whole one.
 *
 * Returns null for an unknown unit rather than passing the number through unconverted — a number
 * whose unit was not understood is not a measurement in millimetres, and treating it as one is
 * exactly the silent error the module header refuses.
 */
export function toMillimetres(value: number, unit: string): number | null {
  const factor = unitFactor(unit)
  if (factor === null) return null
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value * factor)
}

/**
 * Feet and inches together: `4' 6"`, `4 ft 6 in`, `4'6`.
 *
 * A SHAPE OF ITS OWN because it is the one measurement written as two numbers with two units that
 * mean ONE length. Read as a pair of independent measurements it becomes a 1 219 mm object that is
 * also 152 mm, which is two wrong answers rather than one right one.
 */
const FEET_INCHES =
  /^(\d+(?:\.\d+)?)\s*(?:'|’|′|ft\b|feet\b|foot\b)\s*(\d+(?:\.\d+)?)\s*(?:"|”|″|in\b|inch(?:es)?\b)?$/iu

export function parseFeetInches(raw: string): number | null {
  const match = FEET_INCHES.exec(raw.trim())
  if (!match) return null
  const feet = Number(match[1])
  const inches = Number(match[2])
  if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null
  // Twelve inches is a foot; `4' 13"` is not a measurement anybody writes, and reading it would
  // mean deciding whether they meant 5'1" or made a mistake. Neither is this module's to decide.
  if (inches >= 12) return null
  return Math.round(feet * MM_PER_FOOT + inches * MM_PER_INCH)
}
