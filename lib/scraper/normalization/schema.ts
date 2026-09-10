import { z } from 'zod'

/**
 * What a normalised research row IS, stated once, in the one place both the database write and the
 * version snapshot read from.
 *
 * THE PARSE STATE IS PER FIELD AND IT IS THE POINT OF THE WHOLE PHASE. A comparison table built
 * from this data will be read by somebody deciding what Rivya should make; every figure in it
 * inherits the judgement made here about whether the source actually said that. So a value Rivya
 * could not read is `UNPARSED` and a value Rivya could read two ways is `AMBIGUOUS`, and neither is
 * ever collapsed into a plausible-looking number. `ABSENT` is the fourth and is not a failure: the
 * page did not mention it.
 *
 * THE SHAPE IS THE COLUMN SHAPE, NOT A CONVENIENCE SHAPE. `dimensionsMm` is a jsonb object keyed by
 * measurement because `research_products.dimensions_mm` is, `priceMinMinor` is an integer count of
 * minor units because the column is a bigint, and `materialTokens` is a string array because the
 * column is `text[]`. A normalizer whose output needed translating before it could be written is a
 * normalizer with a second, undocumented format in the translation step.
 *
 * IT IS ALSO WHAT GOES IN `research_product_versions.normalized`, unchanged, beside
 * `normalizer_version`. Phase 29 diffs two of these to decide what materially changed, and a diff
 * is only meaningful between two snapshots produced by rules that are the same or are labelled
 * differently — which is what the version string is for.
 */

/** FEAT §23's four, and no fifth. */
export const PARSE_STATES = ['PARSED', 'AMBIGUOUS', 'UNPARSED', 'ABSENT'] as const
export type ParseState = (typeof PARSE_STATES)[number]

/**
 * The price vocabulary, mirroring `products.price_state` exactly for the first four.
 *
 * `UNKNOWN` is this table's alone. A first-party product always has a decided posture — somebody
 * chose it — and a page Rivya could not read has not decided anything.
 */
export const RESEARCH_PRICE_STATES = [
  'FIXED',
  'STARTING_FROM',
  'REQUEST_QUOTE',
  'PRICE_ON_REQUEST',
  'UNKNOWN',
] as const
export type ResearchPriceState = (typeof RESEARCH_PRICE_STATES)[number]

export const RESEARCH_AVAILABILITIES = [
  'IN_STOCK',
  'MADE_TO_ORDER',
  'PREORDER',
  'SOLD_OUT',
  'UNKNOWN',
] as const
export type ResearchAvailability = (typeof RESEARCH_AVAILABILITIES)[number]

/**
 * The keys `dimensions_mm` may hold, and the migration's `is_sane_research_dimensions` allowlist
 * character for character.
 *
 * A `*_max` KEY IS HOW A RANGE IS STORED. "120–140 cm" is a real thing a furniture page publishes
 * and it is not two products; it is one product whose length is a range. Storing only the lower
 * bound would silently narrow it, and storing only the mean would invent a figure the page never
 * printed.
 *
 * `length` AND `diameter` ARE ALTERNATIVES, NOT SIBLINGS. A round table has a diameter and no
 * length, which is why this is an object with meaningful keys rather than five nullable columns
 * where the reader cannot tell "not measured" from "does not apply".
 */
export const DIMENSION_MM_KEYS = [
  'length_mm',
  'length_mm_max',
  'width_mm',
  'width_mm_max',
  'height_mm',
  'height_mm_max',
  'depth_mm',
  'depth_mm_max',
  'diameter_mm',
  'diameter_mm_max',
] as const
export type DimensionMmKey = (typeof DIMENSION_MM_KEYS)[number]

/** The floor and ceiling `research_dimensions_sane` enforces, and `impossible_dimension` raises on. */
export const MIN_DIMENSION_MM = 10
export const MAX_DIMENSION_MM = 10_000

/**
 * The fields that carry a parse state.
 *
 * NOT EVERY COLUMN — only the ones where reading the page could go wrong. `imageUrls` is a list of
 * strings copied across; nothing is parsed, so nothing can be ambiguous about it.
 */
export const NORMALIZED_FIELDS = [
  'title',
  'brand',
  'currency',
  'price',
  'dimensions',
  'materials',
  'availability',
  'leadTime',
  'variants',
  'categories',
] as const
export type NormalizedField = (typeof NORMALIZED_FIELDS)[number]

const parseStateSchema = z.enum(PARSE_STATES)

const dimensionsSchema = z
  // PARTIAL, and that is the point of the shape: a round table has a diameter and no length, so a
  // record demanding every key would make the honest value unrepresentable.
  .partialRecord(z.enum(DIMENSION_MM_KEYS), z.number().int().positive())
  .refine((value) => Object.keys(value).length > 0, {
    message: 'An empty dimensions object is written as null, so the row reads as unmeasured.',
  })

/**
 * The version string of the RULES, not of the package.
 *
 * IT MOVES WHEN A PARSE RESULT COULD CHANGE, and that is the only thing it is for. Phase 29 asks
 * "did this page change, or did we start reading it differently", and it can only answer by
 * comparing the version stamped on two snapshots. A constant nobody remembers to bump makes every
 * rule change look like a competitor's price move.
 */
export const NORMALIZER_VERSION = '1.0.0'

export const normalizedProductSchema = z
  .object({
    titleNormalized: z.string().min(1).max(500).nullable(),
    brandText: z.string().min(1).max(200).nullable(),

    /** ISO 4217, upper case. NEVER converted — see `currency.ts`. */
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/, 'A currency is a three-letter ISO 4217 code.')
      .nullable(),
    priceState: z.enum(RESEARCH_PRICE_STATES).nullable(),
    priceMinMinor: z.number().int().nullable(),
    priceMaxMinor: z.number().int().nullable(),

    dimensionsMm: dimensionsSchema.nullable(),
    dimensionParseState: parseStateSchema,

    materialTokens: z.array(z.string().min(1)).max(40).readonly(),
    availability: z.enum(RESEARCH_AVAILABILITIES).nullable(),
    leadTimeDaysMin: z.number().int().min(0).max(3_650).nullable(),
    leadTimeDaysMax: z.number().int().min(0).max(3_650).nullable(),
    variantCount: z.number().int().min(0).max(10_000).nullable(),

    imageUrls: z.array(z.string().min(1)).max(40).readonly(),
    categoryLabels: z.array(z.string().min(1)).max(60).readonly(),

    /**
     * WHAT THE PAGE ACTUALLY SAID, kept beside what was made of it.
     *
     * The version's `raw` holds it too and always will, but a screen showing raw beside normalised
     * would otherwise need a join and a lookup by field name to render one row. Carrying the
     * handful of strings a person compares makes the explorer drawer a single read.
     */
    sourceTexts: z
      .object({
        price: z.string().nullable(),
        dimensions: z.array(z.string()).readonly(),
        materials: z.array(z.string()).readonly(),
        availability: z.string().nullable(),
        leadTime: z.string().nullable(),
      })
      .strict(),

    parseStates: z.record(z.enum(NORMALIZED_FIELDS), parseStateSchema),
    normalizerVersion: z.string().min(1).max(40),
  })
  // STRICT for `draft-schema.ts`'s reason: an extra key here is a rule somebody added without
  // adding a column, which then exists in the snapshot and nowhere the explorer can show it.
  .strict()
  .superRefine((value, ctx) => {
    // The database's `research_price_state_coherent`, restated so the normalizer fails its own
    // test rather than PostgreSQL's — a constraint violation names a constraint, and this names
    // the rule that should have caught it before the write.
    const quoted =
      value.priceState === 'REQUEST_QUOTE' ||
      value.priceState === 'PRICE_ON_REQUEST' ||
      value.priceState === 'UNKNOWN'
    if (quoted && (value.priceMinMinor !== null || value.priceMaxMinor !== null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['priceMinMinor'],
        message:
          'A quote-only price may not carry an amount. price_quote_with_amount should have ' +
          'cleared it before this point.',
      })
    }
    if (
      (value.priceState === 'FIXED' || value.priceState === 'STARTING_FROM') &&
      (value.priceMinMinor === null || value.priceMinMinor <= 0 || value.currency === null)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['priceState'],
        message: 'A priced row needs a positive amount and a currency.',
      })
    }
    if (
      value.priceMinMinor !== null &&
      value.priceMaxMinor !== null &&
      value.priceMaxMinor < value.priceMinMinor
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['priceMaxMinor'],
        message: 'A price range ends at or after it starts.',
      })
    }
    if (
      value.leadTimeDaysMin !== null &&
      value.leadTimeDaysMax !== null &&
      value.leadTimeDaysMax < value.leadTimeDaysMin
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['leadTimeDaysMax'],
        message: 'A lead time ends at or after it starts.',
      })
    }
  })

export type NormalizedProduct = z.infer<typeof normalizedProductSchema>
export type DimensionsMm = Partial<Record<DimensionMmKey, number>>
