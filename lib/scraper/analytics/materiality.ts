import { trigramSimilarity } from '../core/similarity'

/**
 * How loud is this change?
 *
 * THE PROBLEM THIS MODULE EXISTS FOR IS NOT DETECTION, IT IS ATTENTION. A competitor's page moves
 * constantly: a CDN rewrites an image URL, a template adds a trailing space to a title, a
 * "was £1,200" line appears beside an unchanged price. Every one of those is a real difference
 * between two stored versions and not one of them is worth a merchandiser's morning. A queue that
 * reports them alongside a 12 % price rise is a queue people stop reading, and a queue people stop
 * reading is worse than no queue, because the organisation believes it is being watched.
 *
 * SO EVERY FIELD HAS A STATED RULE AND THE RESULT IS ONE OF THREE WORDS. `MATERIAL` is worth
 * somebody's attention. `MINOR` is real and small. `NOISE` is recorded — never discarded, because
 * "the page changed and we decided it did not matter" is itself evidence — but hidden by default
 * and excluded from every count the dashboard shows.
 *
 * THE RULES ARE DATA, NOT CODE, AND THAT IS THE POINT OF `research_change_rules`. A source with
 * noisy prices is tuned by the person reading the queue, in Studio, without a deploy. This module
 * holds the SHAPE of each rule — what "5 %" means for a price and what it means for a dimension —
 * and takes the numbers from the row. `resolveThresholds` picks the per-source override when one
 * exists and the global default otherwise, which is the only place that precedence is expressed.
 *
 * IT IS PURE, for `normalization/`'s reason: no I/O, no clock, no database. That is what makes
 * every rule below a fixture table in `tests/unit/materiality-rules.test.ts`, and it is what makes
 * re-classification after a threshold edit a loop over stored rows rather than a re-fetch of
 * anybody's website.
 */

/**
 * The eleven fields FEAT §24 names, and the vocabulary `research_change_rules.field` is
 * constrained to.
 *
 * IT IS NOT `NORMALIZED_FIELDS` AND IT IS NOT `DRAFT_FIELDS`, and the three lists exist for three
 * different purposes: what may change, what carries a parse state, what an adapter reads. Three of
 * these eleven — `description`, `customization`, `sku` — are read and stored but never normalised,
 * so they are diffed from the version's `raw` rather than from its `normalized`. Amendment A29
 * records the reconciliation.
 */
export const CHANGE_FIELDS = [
  'price',
  'title',
  'availability',
  'dimensions_mm',
  'variant_count',
  'material_tokens',
  'image_urls',
  'lead_time_days',
  'description',
  'customization',
  'sku',
] as const
export type ChangeField = (typeof CHANGE_FIELDS)[number]

export const MATERIALITIES = ['MATERIAL', 'MINOR', 'NOISE'] as const
export type Materiality = (typeof MATERIALITIES)[number]

export const CHANGE_KINDS = ['ADDED', 'REMOVED', 'MODIFIED'] as const
export type ChangeKind = (typeof CHANGE_KINDS)[number]

/** One row of `research_change_rules`, as the resolver needs it. */
export interface ChangeRule {
  readonly sourceId: string | null
  readonly field: ChangeField
  readonly materialThreshold: number | null
  readonly minorThreshold: number | null
  readonly isEnabled: boolean
}

/**
 * The phase document's table, as the numbers `0270` seeds.
 *
 * DUPLICATED IN TWO PLACES ON PURPOSE, and `tests/unit/materiality-rules.test.ts` asserts they
 * agree. The migration's copy is what a fresh database gets; this one is what the classifier falls
 * back to when a rule row is missing entirely — a database whose rules were deleted should still
 * classify by the documented defaults rather than silently calling everything MATERIAL or
 * everything NOISE. Two copies that a test holds together beats one copy that requires a database
 * to read.
 */
export const DEFAULT_THRESHOLDS: Readonly<
  Record<ChangeField, { readonly material: number | null; readonly minor: number | null }>
> = {
  price: { material: 0.05, minor: null },
  title: { material: 0.9, minor: 0.99 },
  availability: { material: null, minor: null },
  dimensions_mm: { material: 0.02, minor: null },
  variant_count: { material: null, minor: null },
  material_tokens: { material: null, minor: null },
  image_urls: { material: null, minor: null },
  lead_time_days: { material: null, minor: null },
  description: { material: 0.8, minor: 0.95 },
  customization: { material: null, minor: null },
  sku: { material: null, minor: null },
}

export interface ResolvedThresholds {
  readonly material: number | null
  readonly minor: number | null
  readonly isEnabled: boolean
  /** Where the numbers came from, so the drawer can say "tuned for this source". */
  readonly origin: 'SOURCE' | 'GLOBAL' | 'BUILT_IN'
}

/**
 * Which numbers apply to this source and field.
 *
 * PRECEDENCE IS PER-SOURCE, THEN GLOBAL, THEN BUILT-IN, and it is expressed once, here. A rule
 * disabled at the source level disables detection for that field on that source — which is a
 * stronger statement than a high threshold and is why `is_enabled` exists separately.
 *
 * A DISABLED RULE IS NOT A SILENT ONE. The caller records the change as `NOISE` rather than
 * dropping it, so turning a field off hides it from the queue without throwing away the evidence
 * that it moved — and turning the field back on re-classifies the stored rows.
 */
export function resolveThresholds(
  field: ChangeField,
  sourceId: string,
  rules: readonly ChangeRule[],
): ResolvedThresholds {
  const forField = rules.filter((rule) => rule.field === field)
  const perSource = forField.find((rule) => rule.sourceId === sourceId)
  if (perSource !== undefined) {
    return {
      material: perSource.materialThreshold,
      minor: perSource.minorThreshold,
      isEnabled: perSource.isEnabled,
      origin: 'SOURCE',
    }
  }

  const global = forField.find((rule) => rule.sourceId === null)
  if (global !== undefined) {
    return {
      material: global.materialThreshold,
      minor: global.minorThreshold,
      isEnabled: global.isEnabled,
      origin: 'GLOBAL',
    }
  }

  const builtIn = DEFAULT_THRESHOLDS[field]
  return { material: builtIn.material, minor: builtIn.minor, isEnabled: true, origin: 'BUILT_IN' }
}

/** The price side of a version, as the rule reads it. */
export interface PriceSnapshot {
  readonly state: string | null
  readonly currency: string | null
  readonly minMinor: number | null
  readonly maxMinor: number | null
}

export type DimensionsSnapshot = Readonly<Record<string, number>>

export interface LeadTimeSnapshot {
  readonly minDays: number | null
  readonly maxDays: number | null
}

/**
 * The classifier's answer: the word, and why.
 *
 * `reason` IS A KEY, NOT A SENTENCE. It is rendered from `global_content` in Studio (SEED §40,
 * CLAUDE.md's no-marketing-copy-in-code rule applies to Studio strings too) and it is what the
 * drawer shows beside the before and after, so a person can see that a 3 % move was called minor
 * because this source's threshold is 5 % — rather than wondering whether the classifier is broken.
 */
export interface Classification {
  readonly materiality: Materiality
  readonly reason: string
  /** The measured quantity the rule compared, when there was one. Rendered as a percentage. */
  readonly measure?: number
}

const MATERIAL = (reason: string, measure?: number): Classification =>
  measure === undefined
    ? { materiality: 'MATERIAL', reason }
    : { materiality: 'MATERIAL', reason, measure }
const MINOR = (reason: string, measure?: number): Classification =>
  measure === undefined
    ? { materiality: 'MINOR', reason }
    : { materiality: 'MINOR', reason, measure }
const NOISE = (reason: string, measure?: number): Classification =>
  measure === undefined
    ? { materiality: 'NOISE', reason }
    : { materiality: 'NOISE', reason, measure }

/**
 * `price` — a proportional move, or ANY change of state.
 *
 * THE STATE RULE OVERRIDES THE PERCENTAGE ONE AND IS NOT A SPECIAL CASE. `FIXED £1,200` becoming
 * `REQUEST_QUOTE` is not a 0 % change; it is a competitor withdrawing a public price, which is one
 * of the most informative things this pipeline can observe. Comparing amounts would call it
 * nothing at all, because there is no longer an amount to compare.
 *
 * A PRICE THAT APPEARS OR DISAPPEARS IS MATERIAL for the same reason, and the proportional rule is
 * undefined there anyway: the denominator is missing.
 */
export function classifyPrice(
  before: PriceSnapshot,
  after: PriceSnapshot,
  thresholds: ResolvedThresholds,
): Classification {
  if (before.state !== after.state) return MATERIAL('price.state_changed')
  if (before.currency !== after.currency) return MATERIAL('price.currency_changed')

  const from = before.minMinor
  const to = after.minMinor
  if (from === null || to === null) {
    return from === to ? NOISE('price.no_amount_either_side') : MATERIAL('price.amount_appeared')
  }
  if (from === to) {
    // EQUAL MINOR UNITS AND SOMETHING STILL DIFFERED — a max that moved, or formatting the
    // normalizer discarded. A max-only move is real; formatting is not.
    return before.maxMinor === after.maxMinor
      ? NOISE('price.formatting_only')
      : MINOR('price.range_end_moved')
  }

  // FROM ZERO, EVERY MOVE IS INFINITE. A row priced at zero is a parse failure or a giveaway, and
  // dividing by it would produce Infinity and classify by an arithmetic accident.
  if (from === 0) return MATERIAL('price.from_zero')

  const move = Math.abs(to - from) / Math.abs(from)
  const material = thresholds.material ?? DEFAULT_THRESHOLDS.price.material ?? 0.05
  return move >= material
    ? MATERIAL('price.moved_materially', move)
    : MINOR('price.moved_slightly', move)
}

/**
 * Whitespace and case, removed, so that "  Oak Table " and "Oak table" are the same string.
 *
 * THIS IS THE `NOISE` TEST FOR EVERY PROSE FIELD, and it is applied BEFORE similarity rather than
 * as a low-similarity band, because the two say different things. A title whose only difference is
 * a trailing space has not changed; a title with a similarity of 0.995 has changed by one
 * character somewhere, and which of those it is matters to the person reading the queue.
 */
function collapse(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').toLowerCase()
}

/**
 * `title` and `description` — trigram similarity, two thresholds, three bands.
 *
 * SIMILARITY RUNS THE OTHER WAY FROM A PRICE MOVE and the comparison operators reflect it: BELOW
 * `material` is material, because low similarity means a large change. Getting that backwards
 * would classify a rewritten product name as noise and a corrected typo as urgent, and it would
 * look plausible in both directions — which is exactly why the fixture table in the test names the
 * expected word for each band rather than only checking the arithmetic.
 */
export function classifyText(
  field: 'title' | 'description',
  before: string,
  after: string,
  thresholds: ResolvedThresholds,
): Classification {
  if (collapse(before) === collapse(after)) return NOISE(`${field}.whitespace_or_case_only`)

  const similarity = trigramSimilarity(before, after)
  const defaults = DEFAULT_THRESHOLDS[field]
  const material = thresholds.material ?? defaults.material ?? 0.9
  const minor = thresholds.minor ?? defaults.minor ?? 0.99

  if (similarity < material) return MATERIAL(`${field}.rewritten`, similarity)
  if (similarity < minor) return MINOR(`${field}.edited`, similarity)
  return NOISE(`${field}.trivially_edited`, similarity)
}

/**
 * `availability` — any transition between the five tokens.
 *
 * THE TOKEN IS THE WHOLE COMPARISON AND THE SOURCE TEXT IS NOT COMPARED AT ALL. "In stock",
 * "Available now" and "Ready to ship" all normalise to `IN_STOCK`; a page rotating between those
 * three phrases has not told us anything, and a diff on the prose would report a change every week
 * from a shop that never changed its stock position.
 */
export function classifyAvailability(before: string | null, after: string | null): Classification {
  if (before === after) return NOISE('availability.same_token')
  return MATERIAL('availability.transition')
}

/**
 * `dimensions_mm` — any axis moving by the threshold, or an axis appearing or disappearing.
 *
 * AN AXIS APPEARING IS MATERIAL AND IS NOT A PROPORTIONAL QUESTION. A table that gains a stated
 * height is a table we can now band by scale (Phase 30) and compare (Phase 31); a table that loses
 * one drops out of both. Neither has a percentage.
 *
 * THE LARGEST PROPORTIONAL MOVE DECIDES, not the average and not the first. A depth that moved
 * 40 % while the other two held is a different product, and averaging it against two zeroes would
 * report 13 % and call it minor.
 */
export function classifyDimensions(
  before: DimensionsSnapshot,
  after: DimensionsSnapshot,
  thresholds: ResolvedThresholds,
): Classification {
  const axes = new Set([...Object.keys(before), ...Object.keys(after)])
  let largest = 0

  for (const axis of axes) {
    const from = before[axis]
    const to = after[axis]
    if (from === undefined || to === undefined) return MATERIAL('dimensions.axis_appeared_or_left')
    if (from === 0) {
      if (to !== 0) return MATERIAL('dimensions.from_zero')
      continue
    }
    largest = Math.max(largest, Math.abs(to - from) / Math.abs(from))
  }

  if (largest === 0) return NOISE('dimensions.equal_values')
  const material = thresholds.material ?? DEFAULT_THRESHOLDS.dimensions_mm.material ?? 0.02
  return largest >= material
    ? MATERIAL('dimensions.axis_moved_materially', largest)
    : MINOR('dimensions.axis_moved_slightly', largest)
}

/**
 * `material_tokens` and `customization` — SET membership, and reordering is nothing.
 *
 * A LIST FROM A WEB PAGE HAS NO MEANINGFUL ORDER. Two adapters, or one adapter after a template
 * change, will emit the same materials in a different sequence; comparing the arrays positionally
 * would report a change every time a page's markup was rearranged.
 */
export function classifyTokenSet(
  field: 'material_tokens' | 'customization',
  before: readonly string[],
  after: readonly string[],
): Classification {
  const left = new Set(before.map((token) => token.trim().toLowerCase()))
  const right = new Set(after.map((token) => token.trim().toLowerCase()))
  if (left.size === right.size && [...left].every((token) => right.has(token))) {
    return NOISE(`${field}.reordered`)
  }
  return MATERIAL(`${field}.membership_changed`)
}

/**
 * The part of an image URL that identifies the PICTURE rather than the delivery of it.
 *
 * A CDN REWRITES QUERY STRINGS AND SWAPS HOSTS CONSTANTLY — a cache buster, a resize parameter, a
 * migration from `img.example.com` to `cdn.example.com`. None of that is a new photograph, and a
 * change queue that reports it would fill with rows nobody can act on. What identifies the picture
 * is its PATH, so that is what is compared.
 *
 * THE PATH'S FILE EXTENSION IS KEPT. A `.jpg` becoming a `.webp` at the same path is a delivery
 * change, but it is one the path already encodes, and stripping extensions to be clever here would
 * make two genuinely different files at `/a.jpg` and `/a.png` compare equal.
 */
export function imageIdentity(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.pathname.replace(/\/+$/u, '').toLowerCase()
  } catch {
    // A relative URL, or something that is not a URL at all. Compared whole rather than discarded:
    // the adapter stored it, so the detector is not the place to decide it was worthless.
    return url.trim().toLowerCase()
  }
}

export function classifyImages(
  before: readonly string[],
  after: readonly string[],
): Classification {
  const left = new Set(before.map(imageIdentity))
  const right = new Set(after.map(imageIdentity))
  const same = left.size === right.size && [...left].every((path) => right.has(path))
  if (!same) return MATERIAL('image_urls.set_changed')

  // Same pictures, different strings: a CDN host or a query string moved.
  const identical =
    before.length === after.length && before.every((url, index) => url === after[index])
  return identical ? NOISE('image_urls.reordered') : NOISE('image_urls.delivery_only')
}

/**
 * `variant_count`, `sku` — any change at all, with no threshold to consult.
 *
 * A THRESHOLD WOULD BE A NUMBER THAT MEANS NOTHING HERE. A SKU is an identity: it is the same
 * string or it is a different product. A variant count moving from 3 to 4 is a competitor adding a
 * finish, which is exactly the kind of thing this pipeline exists to notice, and calling it minor
 * because one is 33 % of three would be arithmetic standing in for judgement.
 */
export function classifyExact(
  field: 'variant_count' | 'sku' | 'lead_time_days',
  changed: boolean,
): Classification {
  return changed ? MATERIAL(`${field}.changed`) : NOISE(`${field}.unchanged`)
}

/**
 * `lead_time_days` — the PARSED RANGE, never the prose.
 *
 * "Ships in 4–6 weeks" and "Lead time: 4 to 6 weeks" are the same fact written twice. The
 * normalizer already resolved both to `{minDays: 28, maxDays: 42}`, and comparing what it resolved
 * is the difference between a queue that reports supply-chain movement and one that reports
 * copywriting.
 */
export function classifyLeadTime(
  before: LeadTimeSnapshot,
  after: LeadTimeSnapshot,
): Classification {
  const changed = before.minDays !== after.minDays || before.maxDays !== after.maxDays
  return changed ? MATERIAL('lead_time_days.range_changed') : NOISE('lead_time_days.text_only')
}

/**
 * A rule that is switched off records `NOISE`, never nothing.
 *
 * TURNING A FIELD OFF IS "STOP SHOWING ME THIS", NOT "STOP LOOKING". The evidence is still stored,
 * so turning it back on re-classifies rows already detected rather than starting from the next
 * fetch — and a source somebody muted six months ago can still be asked what it did in between.
 */
export function applyEnabled(
  classification: Classification,
  thresholds: ResolvedThresholds,
): Classification {
  if (thresholds.isEnabled) return classification
  return NOISE(`${classification.reason}.rule_disabled`, classification.measure)
}
