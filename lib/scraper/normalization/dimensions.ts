import {
  MAX_DIMENSION_MM,
  MIN_DIMENSION_MM,
  type DimensionMmKey,
  type DimensionsMm,
  type ParseState,
} from './schema'
import { UNIT_SPELLINGS, parseFeetInches, parseMeasurementNumber, toMillimetres } from './units'

/**
 * The measurement parser, and the two ways it is allowed to fail.
 *
 * IT FAILS LOUDLY OR IT FAILS AMBIGUOUSLY, AND NEVER QUIETLY. `UNPARSED` says the string was not a
 * measurement Rivya could read — prose, or a number outside any range furniture occupies.
 * `AMBIGUOUS` says the number was read but its UNIT was not, which is the failure that matters:
 * `120` is a plausible measurement in millimetres, centimetres and inches, and the three differ by a
 * factor of thirty. Nothing here infers a unit from magnitude.
 *
 * **`AMBIGUOUS` STORES NOTHING.** `dimensions_mm` is null unless the state is `PARSED`, which makes
 * the invariant checkable in one line and means no chart, no scale band and no comparison ever
 * reads a millimetre figure that was arrived at by supposing. The source string survives in the
 * version's `raw` and in `sourceTexts.dimensions`, so an operator sees exactly what the page said
 * beside the word "ambiguous", and can correct the row by hand — which freezes the key against
 * re-normalisation.
 *
 * POSITIONAL ORDER, AND WHAT IT IS AND IS NOT CLAIMING. With no labels, `120 x 60 x 45 cm` is read
 * as length, width, height. That is a NAMING convention over three magnitudes rather than a
 * measurement claim: in every convention Rivya has seen — L×W×H, W×D×H — the last number is the
 * vertical extent and the first two are the two horizontal ones, so what differs between conventions
 * is which horizontal extent is called "length". Phase 30 bands by the largest extent and Phase 31
 * compares like with like, and neither depends on that naming. A source that states its own order,
 * or a page that labels its numbers, overrides this — labels always win.
 *
 * OUT OF RANGE IS AN ERROR AND THE ROW SURVIVES IT. Anything under 10 mm or over 10 000 mm is a
 * misread unit almost every time — `1 200 x 60 x 45 cm` is twelve metres — so the reading is
 * discarded, `impossible` is raised for `validation/rules.ts` to turn into an ERROR, and the row
 * stays at `VALIDATED` with the issue attached. `research_dimensions_sane` would have refused the
 * write; catching it here is what lets the row be kept AND flagged rather than one or the other.
 */

export interface DimensionReading {
  /** Null unless `state` is `PARSED`. See the header — this is the invariant, not an accident. */
  readonly dimensions: DimensionsMm | null
  readonly state: ParseState
  /** A magnitude outside 10–10 000 mm. Raises `impossible_dimension` at ERROR. */
  readonly impossible: boolean
  /** A number whose unit could not be read. Raises `dimension_ambiguous` at WARNING. */
  readonly ambiguous: boolean
}

const ABSENT: DimensionReading = {
  dimensions: null,
  state: 'ABSENT',
  impossible: false,
  ambiguous: false,
}

const UNPARSED: DimensionReading = {
  dimensions: null,
  state: 'UNPARSED',
  impossible: false,
  ambiguous: false,
}

/**
 * The labels a furniture page prints, and the axis each names.
 *
 * `d` IS DEPTH AND NOT DIAMETER, which is why `dia` and `Ø` are listed separately and longest-first
 * matching is not optional: a sideboard's `D 45cm` is its depth, and reading it as a diameter would
 * turn a rectangular cabinet into a round one in every downstream shape comparison.
 */
const LABELS: ReadonlyArray<readonly [string, DimensionMmKey]> = [
  ['diameter', 'diameter_mm'],
  ['diam', 'diameter_mm'],
  ['dia', 'diameter_mm'],
  ['ø', 'diameter_mm'],
  ['⌀', 'diameter_mm'],
  ['length', 'length_mm'],
  ['len', 'length_mm'],
  ['width', 'width_mm'],
  ['depth', 'depth_mm'],
  ['height', 'height_mm'],
  ['ht', 'height_mm'],
  ['l', 'length_mm'],
  ['w', 'width_mm'],
  ['d', 'depth_mm'],
  ['h', 'height_mm'],
]

const LABELS_BY_LENGTH = [...LABELS].sort((a, b) => b[0].length - a[0].length)

/** The order an unlabelled chain is read in. See the header for what this does and does not claim. */
export const POSITIONAL_ORDER: readonly DimensionMmKey[] = ['length_mm', 'width_mm', 'height_mm']

function escapeForClass(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

/**
 * Longest spelling first so `cm` never wins over `centimetres` and `m` never wins over `mm`. Built
 * from `UNIT_SPELLINGS` rather than retyped, so one list governs both modules.
 */
const UNIT_PATTERN = UNIT_SPELLINGS.map(escapeForClass).join('|')

/**
 * One number, optionally a range, optionally followed by a unit.
 *
 * THE UNIT IS OPTIONAL IN THE PATTERN AND MANDATORY IN THE RESULT. `120 x 60 x 45 cm` writes the
 * unit once at the end, so the scan has to admit unitless atoms and then decide what unit governs
 * them — which is a decision about the whole string and cannot be made one atom at a time.
 */
/**
 * `(?![a-z])` RATHER THAN `\b` AFTER A UNIT, and the difference is not cosmetic: half the unit
 * spellings are punctuation (`"`, `’`, `″`), and `\b` after a non-word character asserts the
 * opposite of what it asserts after `mm`. A negative look-ahead on the letter class says the one
 * thing that is true of every spelling — `120 in` is a measurement, `120 into` is prose.
 */
const UNIT_SUFFIX = String.raw`(?![a-z])`

/**
 * A number, INCLUDING ONE GROUPED WITH SPACES.
 *
 * `1 200 x 60 x 45 cm` IS THE PHASE DOCUMENT'S OWN OUT-OF-RANGE CASE and it only is one if `1 200`
 * reads as one thousand two hundred. A pattern that stopped at the space would find `1` and `200`,
 * assign them to two axes, and report a perfectly sane 10 mm × 2 000 mm object — the exact silent
 * misread the range check exists to catch. Groups of EXACTLY three digits are required, so the
 * spaces around `x` in `120 x 60` are still separators and not part of a number.
 */
const NUM = String.raw`\d{1,3}(?:[   ]\d{3})+|\d+(?:[.,]\d+)?`

const ATOM = new RegExp(
  String.raw`(${NUM})\s*(?:(${UNIT_PATTERN})${UNIT_SUFFIX})?\s*(?:[-–—~]|\bto\b)\s*(${NUM})\s*(?:(${UNIT_PATTERN})${UNIT_SUFFIX})?` +
    '|' +
    String.raw`(${NUM})\s*(?:(${UNIT_PATTERN})${UNIT_SUFFIX})?`,
  'giu',
)

interface Atom {
  readonly index: number
  readonly min: number
  readonly max: number | null
  readonly unit: string | null
}

/**
 * `4' 6"`, `4 ft 6 in`.
 *
 * TRIED FIRST, ALONE, BECAUSE IT IS THE ONE MEASUREMENT WRITTEN AS TWO NUMBERS THAT MEAN ONE
 * LENGTH. The general scan would read it as two atoms — 1 219 mm and 152 mm — which is two wrong
 * answers where there is one right one.
 *
 * IMPERIAL ONLY. The metric equivalent — `1 m 20` for 1 200 mm — is NOT read here, and the header
 * claimed otherwise until a review checked it against `parseFeetInches`. It is rare in the sources
 * this pipeline reads, and reading it wrongly would be worse than leaving it `AMBIGUOUS`, which is
 * where the general scan puts it: two atoms in one segment with incompatible units.
 */
function readCompositeImperial(segment: string): number | null {
  return parseFeetInches(segment)
}

function scanAtoms(text: string): Atom[] {
  const atoms: Atom[] = []
  ATOM.lastIndex = 0

  for (const match of text.matchAll(ATOM)) {
    const isRange = match[1] !== undefined
    const rawMin = isRange ? match[1] : match[5]
    const rawMax = isRange ? match[3] : undefined
    const unit = (isRange ? (match[4] ?? match[2]) : match[6]) ?? null

    if (rawMin === undefined) continue
    const min = parseMeasurementNumber(rawMin)
    if (min === null) continue
    const max = rawMax === undefined ? null : parseMeasurementNumber(rawMax)

    atoms.push({ index: match.index, min, max, unit: unit === null ? null : unit.toLowerCase() })
  }
  return atoms
}

/**
 * The label immediately before an atom, if there is one.
 *
 * A BOUNDED LOOK-BACK RATHER THAN A SPLIT, because separators are not consistent — `W 120cm · D
 * 60cm`, `Width: 120 cm, Depth: 60 cm` and `W120xD60` are all real. Sixteen characters is far
 * enough to reach `Diameter:` and short enough that the label from the previous measurement cannot
 * be picked up as this one's.
 */
const LOOK_BACK = 16

function labelBefore(text: string, index: number): DimensionMmKey | null {
  const window = text.slice(Math.max(0, index - LOOK_BACK), index).toLowerCase()
  let best: { key: DimensionMmKey; at: number } | null = null

  for (const [spelling, key] of LABELS_BY_LENGTH) {
    // Anchored to the END of the window so the nearest label wins, and preceded by a non-letter so
    // the `h` in `finish` is not a height.
    const pattern = new RegExp(
      String.raw`(?:^|[^a-z])${escapeForClass(spelling)}\s*[:=.]?\s*$`,
      'u',
    )
    if (pattern.test(window)) {
      const at = window.length - spelling.length
      if (best === null || at > best.at) best = { key, at }
    }
  }
  return best?.key ?? null
}

/**
 * The axis an unlabelled number takes, given what the string has already named.
 *
 * A LABELLED MEASUREMENT MUST MOVE THE CURSOR PAST ITS OWN AXIS, and not doing so was a defect.
 * The cursor only advanced for UNLABELLED atoms, so the first unlabelled number after a labelled
 * one always took `POSITIONAL_ORDER[0]` — `Ø 120 x 45 cm` came out as a diameter of 1 200 mm AND a
 * length of 450 mm, giving a round table a length no page ever claimed and making it look
 * rectangular to every later shape comparison.
 *
 * A DIAMETER CHANGES WHAT THE REMAINING NUMBER CAN BE. `length` and `width` are alternatives to a
 * diameter rather than companions to it (see `DIMENSION_MM_KEYS`), so once a diameter is named the
 * only axis an unlabelled number can honestly take is the height — which is what `Ø 120 x 45` says
 * to a person reading it.
 */
function nextPositionalKey(assigned: Readonly<Record<string, number>>): DimensionMmKey | undefined {
  const order: readonly DimensionMmKey[] =
    assigned['diameter_mm'] === undefined ? POSITIONAL_ORDER : ['height_mm']
  // THE FIRST AXIS NOT YET NAMED — no separate cursor. Filtering by what is already assigned walks
  // the order on its own, and keeping a second counter beside it is how the first attempt at this
  // fix skipped `width_mm` on a plain `120 x 60 x 45 cm`.
  return order.find((key) => assigned[key] === undefined)
}

function withinRange(value: number): boolean {
  return value >= MIN_DIMENSION_MM && value <= MAX_DIMENSION_MM
}

const MAX_ATOMS = 4

/**
 * Read one or more measurement strings into millimetres.
 *
 * THE STRINGS ARE JOINED RATHER THAN PARSED SEPARATELY. A page that puts width, depth and height in
 * three list items is describing one object, and reading each in isolation loses the fact that the
 * unit was written once — on the third one.
 */
export function parseDimensions(texts: readonly string[]): DimensionReading {
  const joined = texts
    .map((text) => text.trim())
    .filter((text) => text !== '')
    .join(' · ')

  if (joined === '') return ABSENT

  const text = joined.replace(/×/gu, 'x').replace(/[–—‒]/gu, '-')

  const composite = readCompositeImperial(text)
  if (composite !== null) {
    if (!withinRange(composite)) {
      return { dimensions: null, state: 'UNPARSED', impossible: true, ambiguous: false }
    }
    return {
      dimensions: { length_mm: composite },
      state: 'PARSED',
      impossible: false,
      ambiguous: false,
    }
  }

  const atoms = scanAtoms(text).slice(0, MAX_ATOMS)
  if (atoms.length === 0) {
    // Prose. `seats six comfortably` has no digits at all, and a page whose measurement field says
    // that has told Rivya nothing about size — which is what UNPARSED means.
    return UNPARSED
  }

  /*
   * WHICH UNIT GOVERNS A UNITLESS ATOM.
   *
   * Exactly one distinct unit anywhere in the string means that unit applies to all of it —
   * `120 x 60 x 45 cm` — which is how nearly every catalogue writes a triple. Two or more distinct
   * units mean each atom carries its own and a unitless one is genuinely unanchored. None at all is
   * the ambiguous case the header is about.
   */
  const units = new Set(
    atoms.map((atom) => atom.unit).filter((unit): unit is string => unit !== null),
  )
  const governing = units.size === 1 ? ([...units][0] ?? null) : null

  if (units.size === 0) {
    return { dimensions: null, state: 'AMBIGUOUS', impossible: false, ambiguous: true }
  }

  const dimensions: Record<string, number> = {}
  let impossible = false
  let ambiguous = false

  for (const atom of atoms) {
    const unit = atom.unit ?? governing
    if (unit === null) {
      ambiguous = true
      continue
    }

    const min = toMillimetres(atom.min, unit)
    const max = atom.max === null ? null : toMillimetres(atom.max, unit)
    if (min === null) {
      ambiguous = true
      continue
    }
    if (!withinRange(min) || (max !== null && !withinRange(max))) {
      impossible = true
      continue
    }

    const labelled = labelBefore(text, atom.index)
    const key = labelled ?? nextPositionalKey(dimensions)
    // Past the third unlabelled number there is no axis left to assign. A fourth measurement is a
    // seat height, a leg width or a packed depth, and guessing which would put it on an axis.
    if (key === undefined) continue

    // First write wins: `W 120cm x 120cm` names the first one and the second is a repeat of a
    // measurement already recorded, not a second width.
    if (dimensions[key] === undefined) {
      dimensions[key] = min
      if (max !== null && max > min) dimensions[`${key}_max`] = max
    }
  }

  if (impossible) {
    // ANY out-of-range axis discards the WHOLE reading. A triple whose first number is twelve metres
    // was read in the wrong unit, and the other two were read in the same wrong unit — keeping them
    // would store two figures that are wrong by the same factor and look fine.
    return { dimensions: null, state: 'UNPARSED', impossible: true, ambiguous: false }
  }
  if (Object.keys(dimensions).length === 0) {
    return {
      dimensions: null,
      state: ambiguous ? 'AMBIGUOUS' : 'UNPARSED',
      impossible: false,
      ambiguous,
    }
  }
  if (ambiguous) {
    // A partial reading is not stored. See the header: AMBIGUOUS stores nothing, so nothing
    // downstream has to know which half of an object's measurements was guessed at.
    return { dimensions: null, state: 'AMBIGUOUS', impossible: false, ambiguous: true }
  }

  return {
    dimensions: dimensions as DimensionsMm,
    state: 'PARSED',
    impossible: false,
    ambiguous: false,
  }
}

/**
 * The largest extent, for Phase 30's scale bands and Phase 31's like-for-like comparison.
 *
 * `*_max` KEYS ARE INCLUDED because a table that extends to 2 400 mm occupies 2 400 mm of a room,
 * and a scale band that read only the closed length would put an extending table in the wrong one.
 */
export function largestExtentMm(dimensions: DimensionsMm | null): number | null {
  if (dimensions === null) return null
  const values = Object.values(dimensions).filter(
    (value): value is number => typeof value === 'number',
  )
  return values.length === 0 ? null : Math.max(...values)
}
