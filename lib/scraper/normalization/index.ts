import type { RawProductDraft } from '@/lib/scraper/adapters/draft-schema'
import type { PriceExtraction } from '@/lib/scraper/core/source-schema'

import { readAvailability, countVariants, readLeadTime } from './availability'
import { readCurrency, readPrice } from './currency'
import { parseDimensions } from './dimensions'
import type { Lexicon } from './lexicon'
import { matchMaterials } from './materials'
import {
  NORMALIZER_VERSION,
  normalizedProductSchema,
  type NormalizedField,
  type NormalizedProduct,
  type ParseState,
} from './schema'

/**
 * The normalizer. Strings in, comparable data out, **no I/O of any kind**.
 *
 * PURE, AND THE PURITY IS THE TESTABILITY. Every rule in this subsystem is a judgement about what
 * somebody else's page meant, and a judgement is only reviewable if it can be put beside its input.
 * This function takes a draft, a source's configuration and a lexicon, and returns a value — so a
 * fixture table of two hundred real malformed strings is a unit test rather than a database
 * fixture, and `scripts/research/renormalize.ts` can re-run every rule over stored evidence with
 * zero network traffic.
 *
 * IT WRITES NOTHING AND DECIDES NO STAGE. `workflows/promote.ts` owns the transition and
 * `validation/rules.ts` owns whether the row may take it. Keeping those apart is what stops the
 * normalizer quietly becoming the thing that both reads a page and decides it is good enough.
 *
 * EVERY FIELD CARRIES A PARSE STATE and none of them is optional. A caller reading a normalised
 * price has to be able to ask whether Rivya actually read it, and a field whose state is absent
 * would be read as parsed by whoever wrote the query in a hurry.
 *
 * THE OVERRIDES ARE APPLIED BY THE CALLER, NOT HERE. `renormalize.ts` re-derives everything and
 * then puts a person's corrections back over the top, because the normalizer's job is to say what
 * the rules make of the evidence — including for a field a person has since corrected, which is how
 * the explorer can show "the rules now read this as X, you set it to Y".
 */

export interface NormalizationContext {
  /** `research_sources.currency`. The default, overridable only by an unambiguous sign on the page. */
  readonly declaredCurrency: string | null
  /** `research_sources.price_extraction`. Its separators are the only way to read a number. */
  readonly priceExtraction: PriceExtraction
  /** `research_material_lexicon`, already read. This module does no database access. */
  readonly lexicon: Lexicon
}

/** Whitespace collapsed, ends trimmed, case preserved. Case is information about the source. */
export function normalizeTitle(raw: string | null): string | null {
  if (raw === null) return null
  const collapsed = raw.replace(/\s+/gu, ' ').trim()
  return collapsed === '' ? null : collapsed.slice(0, 500)
}

/*
 * WHY `brandText` IS ALWAYS ABSENT HERE, SAID PLAINLY RATHER THAN LEFT TO BE DISCOVERED.
 *
 * `RawProductDraft` has no brand field — Phase 27's adapters read fifteen fields off a page and a
 * brand is not one of them — so there is no evidence in this function from which a brand could be
 * derived. The two derivations that suggest themselves are both fabrications about somebody else's
 * business: the first word of a title ("Halden Oak Dining Table" is not a piece by Halden), and the
 * source's own name (a retailer sells other people's brands). So the column is filled by a person,
 * through the explorer's override, and reads ABSENT until one does. A later phase that adds a brand
 * to the draft schema fills it from evidence; nothing fills it from a guess.
 */
const BRAND_ABSENT = { value: null, state: 'ABSENT' } as const satisfies {
  value: string | null
  state: ParseState
}

/**
 * What the parse noticed on the way, for `validation/rules.ts` to turn into issues.
 *
 * SIGNALS RATHER THAN RE-DERIVATION, and the reason is that some of them are UNRECOVERABLE from the
 * result. A row with `dimensionsMm = null` and `dimension_parse_state = 'UNPARSED'` could be prose
 * ("seats six") or a twelve-metre misread, and those are a silent nothing and an ERROR respectively.
 * A validator that re-inspected the output would have to guess which, or the normalizer would have
 * to store the bad value it just refused. Returning what it saw costs one interface and no lies.
 */
export interface NormalizationSignals {
  /** An axis outside 10–10 000 mm. `impossible_dimension`, ERROR. */
  readonly dimensionImpossible: boolean
  /** A number whose unit could not be read. `dimension_ambiguous`, WARNING. */
  readonly dimensionAmbiguous: boolean
  /** A shared sign — `$` — that Rivya declined to attribute to a country. `currency_ambiguous`. */
  readonly currencyAmbiguous: boolean
  /** A quote-only posture printed beside a number. `price_quote_with_amount`, ERROR. */
  readonly priceQuoteCarriedAmount: boolean
  /** A price of nought or less. `price_zero_or_negative`, ERROR. */
  readonly priceZeroOrNegative: boolean
  /** How many draft fields the adapter actually found. Under three is `low_confidence_extraction`. */
  readonly confidentFieldCount: number
}

export interface NormalizationOutcome {
  readonly product: NormalizedProduct
  readonly signals: NormalizationSignals
}

export function normalizeDraft(
  draft: RawProductDraft,
  context: NormalizationContext,
): NormalizationOutcome {
  const title = normalizeTitle(draft.title)
  const brand = BRAND_ABSENT

  const currency = readCurrency(draft.priceText, draft.currencyText, context.declaredCurrency)
  const price = readPrice(draft.priceText, context.priceExtraction, currency.currency)
  const dimensions = parseDimensions(draft.dimensionTexts)
  const materials = matchMaterials(
    [...draft.materialTexts, ...draft.categoryLabels],
    context.lexicon,
  )
  const availability = readAvailability(draft.availabilityText)
  const leadTime = readLeadTime(draft.leadTimeText)
  const variantCount = countVariants(draft.variantTexts)

  const parseStates: Record<NormalizedField, ParseState> = {
    title: title === null ? 'ABSENT' : 'PARSED',
    brand: brand.state,
    currency: currency.state,
    price: price.parseState,
    dimensions: dimensions.state,
    materials: materials.state,
    availability: availability.state,
    leadTime: leadTime.state,
    variants: variantCount === null ? 'ABSENT' : 'PARSED',
    categories: draft.categoryLabels.length === 0 ? 'ABSENT' : 'PARSED',
  }

  /*
   * THE CURRENCY IS DROPPED WHEN NO AMOUNT SURVIVED, and that is `research_price_state_coherent`
   * read the other way round. A quote-only row carrying `EUR` and no number would say Rivya knows
   * what currency a price it does not have would be in — which is true and useless, and reads on a
   * screen as though a figure went missing.
   */
  const priced = price.state === 'FIXED' || price.state === 'STARTING_FROM'

  const product = normalizedProductSchema.parse({
    titleNormalized: title,
    brandText: brand.value,

    currency: priced ? currency.currency : null,
    priceState: price.state,
    priceMinMinor: priced ? price.minMinor : null,
    priceMaxMinor: priced ? price.maxMinor : null,

    dimensionsMm: dimensions.dimensions,
    dimensionParseState: dimensions.state,

    materialTokens: materials.tokens,
    availability: availability.value,
    leadTimeDaysMin: leadTime.minDays,
    leadTimeDaysMax: leadTime.maxDays,
    variantCount,

    imageUrls: [...draft.imageUrls],
    categoryLabels: [...draft.categoryLabels],

    sourceTexts: {
      price: draft.priceText,
      dimensions: [...draft.dimensionTexts],
      materials: [...draft.materialTexts],
      availability: draft.availabilityText,
      leadTime: draft.leadTimeText,
    },

    parseStates,
    normalizerVersion: NORMALIZER_VERSION,
  } satisfies NormalizedProduct)

  return {
    product,
    signals: {
      dimensionImpossible: dimensions.impossible,
      dimensionAmbiguous: dimensions.ambiguous,
      currencyAmbiguous: currency.ambiguousSymbol,
      priceQuoteCarriedAmount: price.quoteCarriedAmount,
      priceZeroOrNegative: price.zeroOrNegative,
      confidentFieldCount: Object.values(draft.confidence).filter((value) => value === 1).length,
    },
  }
}

/**
 * A normalised product with a person's corrections put back over the top.
 *
 * THE FROZEN KEYS WIN, ALWAYS, AND THE SHAPE IS CHECKED BEFORE THEY DO. `normalized_overrides` is a
 * jsonb column a `research.write` holder edits, so its contents are input rather than data — a key
 * that is not a column, or a value of the wrong type, is refused here rather than written. What
 * cannot be refused is the person's judgement: where the key and the type are right, the correction
 * stands and the rules do not get a second go at it.
 */
export function applyOverrides(
  normalized: NormalizedProduct,
  overrides: Record<string, unknown>,
): { readonly product: NormalizedProduct; readonly frozen: readonly string[] } {
  const keys = Object.keys(overrides)
  if (keys.length === 0) return { product: normalized, frozen: [] }

  const merged: Record<string, unknown> = { ...normalized, ...overrides }
  // `parseStates`, `sourceTexts` and `normalizerVersion` are the rules' own record of what they did
  // and are never a person's to set — an override of them would make the audit trail describe an
  // edit rather than the parse it is supposed to describe.
  merged.parseStates = normalized.parseStates
  merged.sourceTexts = normalized.sourceTexts
  merged.normalizerVersion = normalized.normalizerVersion

  const parsed = normalizedProductSchema.safeParse(merged)
  if (!parsed.success) {
    // A malformed override does not corrupt the row and does not throw away the parse. The rules'
    // own answer stands and the explorer shows the override as rejected, which is a state a person
    // can act on.
    return { product: normalized, frozen: [] }
  }

  return {
    product: parsed.data,
    frozen: keys.filter(
      (key) => key !== 'parseStates' && key !== 'sourceTexts' && key !== 'normalizerVersion',
    ),
  }
}

export * from './schema'
export { parseDimensions, largestExtentMm } from './dimensions'
export { readCurrency, readPrice, minorUnitExponent, toMinorUnits } from './currency'
export { matchMaterials, MAX_MATERIAL_TOKENS } from './materials'
export { readAvailability, readLeadTime, countVariants } from './availability'
export {
  lexiconSchema,
  lexiconEntrySchema,
  prepareLexicon,
  type Lexicon,
  type LexiconEntry,
} from './lexicon'
