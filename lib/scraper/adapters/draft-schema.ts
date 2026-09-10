import { z } from 'zod'

/**
 * What one page said about one product, in the page's own words, and nothing whatever besides.
 *
 * A NUMERIC FIELD FAILS VALIDATION HERE, AND THAT REFUSAL IS THE POINT OF THE MODULE. `priceText`
 * is `z.string().nullable()`, so a draft carrying `1299` is rejected outright rather than quietly
 * accepted. An adapter never parses a number, converts a unit, resolves a currency or maps a
 * category — Phase 28 does all four, once, over stored evidence. The failure this shape exists to
 * prevent is the ordinary one: a price is right there in the markup, converting it is two lines,
 * and the moment those two lines ship there are two parsers in the system. The second one is always
 * the one nobody re-runs when a rule is corrected — so a decimal-separator fix lands in
 * `lib/scraper/normalization/**`, gets re-run over every stored version, and silently misses every
 * value an adapter had already turned into a number years earlier. Keeping the draft raw is what
 * makes `research_product_versions.raw` re-normalisable for as long as it is kept.
 *
 * IT IS ALSO THE TRUST BOUNDARY, AND THE MOST HOSTILE ONE IN THIS SYSTEM (D1, and the Phases 25–30
 * conventions say so outright). Every value in a draft came from markup a third party controls and
 * is on its way into a jsonb column. So every string is trimmed and length-capped and every array
 * is capped: a page that could write an unbounded value into `raw` could make one row cost as much
 * as a catalogue, and `.strict()` refuses an unrecognised key for the reason `core/raw.ts` gives
 * about its own schema — without it, a page contributes keys nobody designed for into a column
 * later phases read.
 *
 * `descriptionHtml` IS STORED MARKUP AND IS NEVER RENDERED AS MARKUP. It is kept because a
 * description is where a lead time or a dimension often hides and Phase 28 needs the original to
 * read it from. Nothing in Studio may put it through `dangerouslySetInnerHTML`: that would be a
 * competitor's page executing in a staff session that holds `research.write`, which is a stored
 * cross-site scripting hole with an unusually motivated author.
 *
 * NOTHING DOWNLOADS AN IMAGE, IN THIS PHASE OR ANY OTHER. `imageUrls` holds http(s) strings, they
 * are validated as strings, and no code path anywhere in `lib/scraper/**` turns one into bytes. D5
 * and the phase document are both absolute about it: competitor imagery is never fetched, cached,
 * re-hosted, thumbnailed or measured, and the only place Studio renders one is the authenticated,
 * non-caching proxy.
 *
 * `DRAFT_FIELDS` IS THE FIELD LIST ONCE. The schema's own shape, the keys `confidence` and
 * `provenance` are allowed to carry, and the set `core/content-hash.ts` hashes all have to be the
 * same list; three hand-maintained copies would be two chances to drift, and the drift would show
 * up as a field that hashes but is not confidence-tracked, or the reverse.
 */

/**
 * The fifteen fields FEAT §27 names, in the order it names them.
 *
 * ORDER IS PRESENTATION ONLY AND NOTHING DEPENDS ON IT — `stableStringify` sorts before hashing,
 * and the schema is an object. It matches the requirement's own listing so that the two can be read
 * side by side, which is the only way a missing field is ever noticed.
 */
export const DRAFT_FIELDS = [
  'title',
  'priceText',
  'currencyText',
  'skuText',
  'availabilityText',
  'leadTimeText',
  'descriptionHtml',
  'dimensionTexts',
  'materialTexts',
  'variantTexts',
  'customizationTexts',
  'imageUrls',
  'categoryLabels',
  'externalId',
  'canonicalUrl',
] as const

export type DraftField = (typeof DRAFT_FIELDS)[number]

/**
 * The six fields that hold a list rather than a single string.
 *
 * A SEPARATE LIST RATHER THAN A LOOKUP INTO THE SCHEMA, because `emptyDraft` and `withField` need
 * the answer before there is a parsed value to inspect. It is held to the schema by
 * `tests/unit/draft-schema.test.ts`, which walks both.
 */
const LIST_FIELDS: ReadonlySet<string> = new Set([
  'dimensionTexts',
  'materialTexts',
  'variantTexts',
  'customizationTexts',
  'imageUrls',
  'categoryLabels',
])

/**
 * How a value was found. The generic adapter's strategy order, FEAT §27's first-hit-wins list.
 *
 * A CLOSED SET RATHER THAN A FREE STRING, and the difference is whether provenance can be trusted.
 * The whole purpose of recording it is that a wrong value in a comparison table can be traced to
 * the RULE that produced it rather than guessed at; a typo — `'jsonId'`, `'og'` — would be recorded
 * just as happily as the truth and would send whoever traced it looking for a strategy that does
 * not exist. Adding a strategy is a change to this list, which is a change reviewers see.
 */
export const PROVENANCE_STRATEGIES = [
  'jsonld',
  'microdata',
  'rdfa',
  'opengraph',
  'selector',
  'title',
  'h1',
] as const

export type ProvenanceStrategy = (typeof PROVENANCE_STRATEGIES)[number]

/** Roughly a paragraph, and `core/raw.ts`'s number for the same field. */
export const MAX_TITLE_LENGTH = 500

/**
 * Two hundred thousand characters of description.
 *
 * GENEROUS BECAUSE A DESCRIPTION IS WHERE THE SPECIFICATION USUALLY LIVES, and truncating one would
 * throw away the dimension table Phase 28 is going to read. Bounded because a jsonb column filled
 * from a page somebody else controls needs a number that is not "whatever they sent".
 */
export const MAX_DESCRIPTION_HTML_LENGTH = 200_000

/** Every other string: a price, a SKU, a dimension line, a URL. None of those is a document. */
export const MAX_TEXT_LENGTH = 2_000

/**
 * Forty image references, sixty of anything else.
 *
 * THE IMAGE CAP IS THE TIGHTER ONE ON PURPOSE. A product gallery is a dozen photographs; a page
 * offering four hundred is a listing page, a lazy-loading sprite sheet or a tracking pixel farm,
 * and recording all of them would put a page's worth of noise in front of a merchandiser who is
 * trying to look at one product.
 */
export const MAX_IMAGE_URLS = 40
export const MAX_LIST_ENTRIES = 60

/** Trimmed first, then measured — the check order `core/source-schema.ts` relies on throughout. */
function cappedText(max: number): z.ZodString {
  return z.string().trim().max(max)
}

/**
 * An image reference: http(s), and a string for ever.
 *
 * A `refine` RATHER THAN `z.url()`, matching `core/raw.ts`. What is being recorded is the page's own
 * claim about where its picture is; a full URL parse would accept things this pipeline has no use
 * for (`ftp:`, a `data:` payload, a `javascript:` href on a lazy-loading gallery) or reject a
 * perfectly readable reference on a technicality, and neither outcome is worth the difference here.
 */
const imageReference = cappedText(MAX_TEXT_LENGTH).refine((value) => isHttpReference(value), {
  message: 'Only http and https image references are recorded, and nothing ever fetches one.',
})

/** Whether a reference is one of the two schemes this subsystem will admit into a draft. */
export function isHttpReference(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

const textList = (max: number): z.ZodReadonly<z.ZodArray<z.ZodString>> =>
  z.array(cappedText(MAX_TEXT_LENGTH)).max(max).readonly()

/**
 * The draft an adapter returns and `research_product_versions.raw` stores.
 *
 * `confidence` IS EXHAUSTIVE AND `provenance` IS NOT, WHICH IS NOT AN INCONSISTENCY. Confidence
 * answers "was this field found, or is the null a default" and it has to answer for every field:
 * a missing key there would be ambiguous between "not found" and "the adapter forgot to say", and
 * the run detail drawer would have no way to tell a merchandiser which. Provenance answers "which
 * rule produced this value", and for a field that was never found there IS no rule — inventing a
 * `'none'` strategy to fill the gap would put a value in the closed list above that names no
 * strategy at all. So a provenance key exists exactly when the field was found, which makes the two
 * maps mutually checkable: `confidence[f] === 1` if and only if `provenance[f]` is set. `withField`
 * is what maintains that, and the tests assert it.
 *
 * THE SCHEMA DOES NOT REFINE THAT INVARIANT, DELIBERATELY. This schema is also what a stored row is
 * read back through by `scripts/research/reextract.ts` and by Phase 29's diff, and a boundary that
 * refused to parse its own history would lose the evidence rather than repair it. The invariant is
 * enforced where drafts are BUILT; the schema stays a shape check.
 *
 * BOTH MAPS ARE KEYED TO `DRAFT_FIELDS`, so a page cannot contribute a key of its own to either.
 * Without that they would be the one unbounded corner of an otherwise bounded object — a
 * `Record<string, …>` filled from markup is a jsonb column somebody else is writing.
 */
export const rawProductDraftSchema = z
  .object({
    title: cappedText(MAX_TITLE_LENGTH).nullable(),
    priceText: cappedText(MAX_TEXT_LENGTH).nullable(),
    currencyText: cappedText(MAX_TEXT_LENGTH).nullable(),
    skuText: cappedText(MAX_TEXT_LENGTH).nullable(),
    availabilityText: cappedText(MAX_TEXT_LENGTH).nullable(),
    leadTimeText: cappedText(MAX_TEXT_LENGTH).nullable(),
    descriptionHtml: cappedText(MAX_DESCRIPTION_HTML_LENGTH).nullable(),
    dimensionTexts: textList(MAX_LIST_ENTRIES),
    materialTexts: textList(MAX_LIST_ENTRIES),
    variantTexts: textList(MAX_LIST_ENTRIES),
    customizationTexts: textList(MAX_LIST_ENTRIES),
    imageUrls: z.array(imageReference).max(MAX_IMAGE_URLS).readonly(),
    categoryLabels: textList(MAX_LIST_ENTRIES),
    /**
     * The source's own product identifier, as printed. Not Rivya's, not a slug, not derived — a
     * value read off the page, which is the only kind of identifier this subsystem has.
     */
    externalId: cappedText(MAX_TEXT_LENGTH).nullable(),
    /**
     * The canonical URL THE PAGE CLAIMS, unresolved. `FetchedPage.url` is where the bytes actually
     * came from and the core keeps that separately; reconciling the two is a decision about
     * identity, and identity decisions belong to Phase 28's deduplication rather than to whichever
     * adapter happened to read the tag.
     */
    canonicalUrl: cappedText(MAX_TEXT_LENGTH).nullable(),
    confidence: z.record(z.enum(DRAFT_FIELDS), z.literal([0, 1])),
    provenance: z.partialRecord(z.enum(DRAFT_FIELDS), z.enum(PROVENANCE_STRATEGIES)),
  })
  // STRICT, DELIBERATELY, and for `core/raw.ts`'s reason: an extra key here is normalisation
  // arriving early, wearing a name nobody reviewed.
  .strict()

export type RawProductDraft = z.infer<typeof rawProductDraftSchema>

/**
 * A draft that found nothing: every field defaulted, every confidence `0`, no provenance at all.
 *
 * THIS IS WHAT A PAGE OF BROKEN MARKUP PRODUCES, AND PRODUCING IT IS NOT A FAILURE. FEAT §27 asks
 * that `extract()` never throw on malformed input and return a draft with low confidence instead,
 * because the two outcomes mean different things to whoever reads the run: an empty draft says the
 * adapter's rules did not fit this page, and a thrown error says the adapter is broken. Collapsing
 * them would make a redesigned catalogue look identical to a bug.
 *
 * IT IS BUILT FROM `DRAFT_FIELDS` AND THEN PARSED, so a field added to the list cannot be forgotten
 * here and a list field left out of `LIST_FIELDS` fails loudly at the first call rather than
 * silently defaulting to `null` where an array belongs.
 */
export function emptyDraft(): RawProductDraft {
  const draft: Record<string, unknown> = { confidence: {}, provenance: {} }
  const confidence: Record<string, 0> = {}

  for (const field of DRAFT_FIELDS) {
    draft[field] = LIST_FIELDS.has(field) ? [] : null
    confidence[field] = 0
  }
  draft.confidence = confidence

  return rawProductDraftSchema.parse(draft)
}

/**
 * Record one found value, its strategy and its confidence. FIRST HIT WINS.
 *
 * THE FIRST-HIT RULE IS THE STRATEGY ORDER, ENFORCED HERE RATHER THAN REMEMBERED AT EACH CALL SITE.
 * The generic adapter tries JSON-LD, then microdata, then RDFa, then OpenGraph, then the source's
 * configured selectors, then `<title>` and `<h1>`; each of those is a weaker claim than the one
 * before it. An adapter written as a sequence of `withField` calls in that order is correct by
 * construction, and one that reordered them would be visibly reordering them. The alternative —
 * every strategy checking whether the field is already set — is the same rule written seven times,
 * and the seventh copy is where a fallback quietly overwrites structured data.
 *
 * AN EMPTY VALUE IS NOT A HIT. `null`, a string that is only whitespace, an array of nothing, and
 * an `imageUrls` array whose every entry was a `data:` placeholder all leave the draft exactly as
 * it was — no confidence, no provenance, and the next strategy still gets its turn. Recording a
 * strategy that produced nothing would attribute an absent value to a rule that "found" it, which
 * is precisely the trail provenance exists to keep honest.
 *
 * IT TRUNCATES WHERE THE SCHEMA REFUSES, WHICH IS `core/raw.ts`'s DIVISION OF LABOUR. The cap in
 * the schema is the guarantee about what may reach jsonb, and it refuses rather than repairs,
 * because a boundary that silently fixed its input would be a boundary nobody could reason about.
 * The cap here is what lets an honest adapter satisfy that guarantee without thinking about it: a
 * page with a 4 kB `<title>` yields a truncated title rather than an item marked `FAILED` for a
 * reason no operator could act on.
 */
export function withField<F extends DraftField>(
  draft: RawProductDraft,
  field: F,
  value: RawProductDraft[F],
  strategy: ProvenanceStrategy,
): RawProductDraft {
  if (draft.confidence[field] === 1) return draft

  const cleaned = cleanValue(field, value)
  if (cleaned === null) return draft

  const next: RawProductDraft = {
    ...draft,
    confidence: { ...draft.confidence, [field]: 1 },
    provenance: { ...draft.provenance, [field]: strategy },
  }
  // THE ONE ASSERTION IN THIS MODULE, AND IT RESTATES A NARROWING RATHER THAN CLAIMING ANYTHING.
  // `cleanValue` is handed `RawProductDraft[F]` and returns a value of that same field's type, but
  // it reaches the answer through a branch on `Array.isArray`, which TypeScript cannot follow back
  // to a generic `F`. The alternative — re-parsing the whole draft on every field set — would
  // re-validate a 200 kB `descriptionHtml` fifteen times per page, which is a megabyte of copying
  // per product bought for one `as`.
  next[field] = cleaned as RawProductDraft[F]
  return next
}

/**
 * Trim, cap, drop what is empty, and refuse an image reference this subsystem will not store.
 *
 * `null` MEANS "NOTHING WAS FOUND", not "the value is null" — see `withField`, which is the only
 * caller and treats the two the same way on purpose.
 *
 * THE `imageUrls` FILTER IS THE ONE FIELD-AWARE STEP, and it earns its place. A lazy-loading
 * gallery serves a `data:` spacer in `src` and the real reference in a data attribute; an adapter
 * that swept up both would hand over an array containing one inadmissible entry, and — because the
 * schema refuses the whole draft rather than the entry — a spacer pixel would cost the product.
 * Dropping it here is the same choice `core/raw.ts` makes when it resolves and filters hrefs.
 */
function cleanValue(
  field: DraftField,
  value: string | readonly string[] | null,
): string | readonly string[] | null {
  if (value === null) return null

  if (typeof value === 'string') {
    const text = value.trim().slice(0, textCap(field))
    return text === '' ? null : text
  }

  const cap = field === 'imageUrls' ? MAX_IMAGE_URLS : MAX_LIST_ENTRIES
  const entries: string[] = []
  for (const entry of value) {
    if (entries.length >= cap) break
    const text = entry.trim().slice(0, MAX_TEXT_LENGTH)
    if (text === '') continue
    if (field === 'imageUrls' && !isHttpReference(text)) continue
    // NOT DE-DUPLICATED, AND NOT SORTED. A gallery that repeats a photograph and a specification
    // list that repeats a line are both saying something about the page; deciding they meant it
    // once is a normalisation judgement, and Phase 28 makes those over stored evidence.
    entries.push(text)
  }
  return entries.length === 0 ? null : entries
}

function textCap(field: DraftField): number {
  if (field === 'title') return MAX_TITLE_LENGTH
  if (field === 'descriptionHtml') return MAX_DESCRIPTION_HTML_LENGTH
  return MAX_TEXT_LENGTH
}
