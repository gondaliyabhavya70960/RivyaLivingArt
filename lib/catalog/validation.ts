import type { Enums } from '@/lib/supabase/database.types'

import { DIMENSION_KEYS, MAX_DIMENSION } from './dimensions'

/**
 * FEAT §21 (data quality) and FEAT §22 (publication readiness), as one pure module.
 *
 * PURE ON PURPOSE. Nothing here touches the network or the database: every fact it needs about the
 * rest of the world — which slugs are taken, which media ids exist, which of them are concept
 * renders — is passed in. That is what lets the Studio form, the server action behind it and the
 * unit tests all run the SAME rules, and it is what stops the form and the action drifting into
 * two different definitions of a valid product.
 *
 * TWO KINDS OF ANSWER, DELIBERATELY SEPARATE:
 *
 *   `validateProduct` answers "is this row coherent?" — the FEAT §21 list. A failure here is an
 *   ERROR: the row is wrong and must not be saved at all, published or not.
 *
 *   `readinessChecklist` answers "is this row finished?" — the FEAT §22 list. An unmet item is not
 *   an error; a half-typed draft is a normal thing for a product to be. It blocks PUBLISHING only,
 *   and only for the items marked required.
 *
 * THE CHECKLIST IS A LIST OF NAMED ITEMS, NEVER A SCORE. FEAT §22 says so in as many words, and
 * the reason is that "readiness 60%" tells an editor to guess. Each item carries the label the
 * Studio renders verbatim, so the refusal to publish can name exactly what is missing.
 */

export type PriceState = Enums<'price_state'>
export type AvailabilityState = Enums<'availability_state'>
export type EditionState = Enums<'edition_state'>

/** The fields the catalogue editor writes. A superset is fine; extra keys are ignored. */
export interface ProductDraft {
  readonly slug: string
  readonly sku: string | null
  readonly title: string | null
  readonly subtitle?: string | null
  readonly summary?: string | null
  readonly description: string | null
  readonly category_id: string | null
  readonly price_state: PriceState
  readonly price_minor: number | null
  readonly price_from_minor: number | null
  readonly currency: string | null
  readonly availability_state: AvailabilityState | null
  readonly edition_state: EditionState | null
  readonly edition_size: number | null
  readonly is_customizable: boolean
  readonly is_large_format: boolean
  readonly sort_order?: number | null
  readonly dimensions: unknown
  readonly hero_media_id: string | null
  readonly seo_title: string | null
  readonly seo_description: string | null
}

/** Everything the rules need to know that is not in the draft itself. */
export interface ProductContext {
  /** Slugs already used by OTHER products. The caller excludes the row being edited. */
  readonly takenSlugs?: ReadonlySet<string>
  /** SKUs already used by other products. */
  readonly takenSkus?: ReadonlySet<string>
  /** Media ids this database actually has. An id outside it is a broken reference. */
  readonly knownMediaIds?: ReadonlySet<string>
  /** Of those, the ones flagged `is_concept`. Attaching one is refused here and by the trigger. */
  readonly conceptMediaIds?: ReadonlySet<string>
  /** Material ids linked to this product, for the readiness item and nothing else. */
  readonly materialIds?: readonly string[]
  /** Non-hero media attached to this product, for the Gallery readiness item. */
  readonly galleryMediaIds?: readonly string[]
}

export interface ValidationIssue {
  /** The form field to attach the message to. */
  readonly field: string
  /** Stable identifier, for tests and for the audit record. Never shown to a person. */
  readonly code: string
  /** What is wrong, in words an editor can act on. */
  readonly message: string
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SKU = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const CURRENCY = /^[A-Z]{3}$/

/**
 * The dimension keys a product may carry, and the only ones.
 *
 * Matches the shape DATA_MODEL §8.5 gives the Phase 15 database constraint, so the application
 * rejects the same blobs the database will once `0130` lands. Until then this is the only guard,
 * which is why it is exhaustive rather than advisory.
 */
/**
 * Re-exported, not redeclared. `lib/catalog/dimensions.ts` owns the list because the database
 * constraint in 0130 mirrors it and the renderer reads it; a second copy here would be a third
 * place for the seven measurements to disagree.
 */
export { DIMENSION_KEYS } from './dimensions'

const MAX_DIMENSION_MM = MAX_DIMENSION

export function hasDimensions(dimensions: unknown): boolean {
  return (
    typeof dimensions === 'object' &&
    dimensions !== null &&
    !Array.isArray(dimensions) &&
    Object.keys(dimensions as Record<string, unknown>).length > 0
  )
}

/** FEAT §21 "impossible dimensions": unknown key, non-number, zero, negative, or absurd. */
function dimensionIssues(dimensions: unknown): ValidationIssue[] {
  if (dimensions === null || dimensions === undefined) return []
  if (typeof dimensions !== 'object' || Array.isArray(dimensions)) {
    return [
      {
        field: 'dimensions',
        code: 'dimensions_shape',
        message: 'Dimensions must be a set of named measurements.',
      },
    ]
  }

  const issues: ValidationIssue[] = []
  for (const [key, value] of Object.entries(dimensions as Record<string, unknown>)) {
    if (!(DIMENSION_KEYS as readonly string[]).includes(key)) {
      issues.push({
        field: 'dimensions',
        code: 'dimensions_unknown_key',
        message: `“${key}” is not a measurement this catalogue records. Use one of: ${DIMENSION_KEYS.join(', ')}.`,
      })
      continue
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      issues.push({
        field: 'dimensions',
        code: 'dimensions_not_a_number',
        message: `${key} must be a number.`,
      })
      continue
    }
    if (value <= 0) {
      issues.push({
        field: 'dimensions',
        code: 'dimensions_not_positive',
        message: `${key} must be greater than zero.`,
      })
      continue
    }
    if (key !== 'seats' && value > MAX_DIMENSION_MM) {
      issues.push({
        field: 'dimensions',
        code: 'dimensions_out_of_range',
        message: `${key} is larger than any piece this catalogue describes. Check the unit.`,
      })
    }
  }
  return issues
}

/**
 * FEAT §21 "malformed URLs".
 *
 * Exported and used by the Studio form for any address an editor types. Products carry no
 * free-text URL column in Phase 14 — the one address a product has is derived from its slug, which
 * is validated as a slug — so this guards the section CTA fields and whatever Phase 15 adds. It
 * refuses anything that is not http(s): `javascript:` in an href is a script injection, and a
 * bare `www.example.com` silently resolves relative to the current page.
 */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * The price rules, alone.
 *
 * SEPARATE BECAUSE THE READINESS CHECKLIST ASKS THE SAME QUESTION. "Price state" is met when the
 * state and the columns beside it agree, which is exactly what these rules test — so the checklist
 * calls this rather than pattern-matching on error codes from the full validator.
 *
 * They mirror `products_price_state_coherent` exactly. The database is the guarantee; this exists
 * so an editor gets a sentence naming the field instead of a constraint violation.
 */
export function priceIssues(
  draft: Pick<ProductDraft, 'price_state' | 'price_minor' | 'price_from_minor' | 'currency'>,
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const quoteOnly =
    draft.price_state === 'REQUEST_QUOTE' || draft.price_state === 'PRICE_ON_REQUEST'

  if (quoteOnly) {
    if (draft.price_minor !== null || draft.price_from_minor !== null) {
      issues.push({
        field: 'price_minor',
        code: 'quote_state_with_price',
        message:
          'A quote-only piece cannot carry a price — not even zero. Clear the amount or change the price state.',
      })
    }
    if (draft.currency !== null) {
      issues.push({
        field: 'currency',
        code: 'quote_state_with_currency',
        message: 'A quote-only piece carries no currency, because it carries no amount.',
      })
    }
  }

  if (draft.price_state === 'FIXED') {
    if (draft.price_minor === null || draft.price_minor <= 0) {
      issues.push({
        field: 'price_minor',
        code: 'fixed_price_missing',
        message: 'A fixed price needs an amount greater than zero.',
      })
    }
    if (draft.price_from_minor !== null) {
      issues.push({
        field: 'price_from_minor',
        code: 'fixed_price_with_from',
        message: 'A fixed price cannot also carry a “from” amount.',
      })
    }
  }

  if (draft.price_state === 'STARTING_FROM') {
    if (draft.price_from_minor === null || draft.price_from_minor <= 0) {
      issues.push({
        field: 'price_from_minor',
        code: 'starting_from_missing',
        message: 'A “from” price needs an amount greater than zero.',
      })
    }
    if (draft.price_minor !== null) {
      issues.push({
        field: 'price_minor',
        code: 'starting_from_with_fixed',
        message: 'A “from” price cannot also carry an exact amount.',
      })
    }
  }

  if (!quoteOnly && draft.currency === null) {
    issues.push({
      field: 'currency',
      code: 'currency_required',
      message: 'A priced piece needs a currency.',
    })
  }

  if (draft.currency !== null && !CURRENCY.test(draft.currency)) {
    issues.push({
      field: 'currency',
      code: 'currency_shape',
      message: 'A currency is a three-letter ISO code, such as INR.',
    })
  }

  return issues
}

/** Every FEAT §21 rule, in the order an editor reads the form. */
export function validateProduct(
  draft: ProductDraft,
  context: ProductContext = {},
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // --- identity -------------------------------------------------------------------------------
  if (draft.slug.trim() === '') {
    issues.push({ field: 'slug', code: 'slug_required', message: 'A slug is required.' })
  } else if (!SLUG.test(draft.slug)) {
    issues.push({
      field: 'slug',
      code: 'slug_shape',
      message: 'A slug may contain lowercase letters, numbers and single hyphens only.',
    })
  } else if (context.takenSlugs?.has(draft.slug)) {
    issues.push({
      field: 'slug',
      code: 'slug_duplicate',
      message: 'Another product already uses this slug. Two products cannot share an address.',
    })
  }

  if (draft.sku !== null && draft.sku.trim() !== '') {
    if (!SKU.test(draft.sku)) {
      issues.push({
        field: 'sku',
        code: 'sku_shape',
        message: 'A SKU may contain letters, numbers, dots, hyphens and underscores.',
      })
    } else if (context.takenSkus?.has(draft.sku.toLowerCase())) {
      issues.push({
        field: 'sku',
        code: 'sku_duplicate',
        message: 'Another product already uses this SKU.',
      })
    }
  }

  issues.push(...priceIssues(draft))

  // --- edition --------------------------------------------------------------------------------
  if (draft.edition_state === 'LIMITED_EDITION') {
    if (draft.edition_size === null || draft.edition_size <= 0) {
      issues.push({
        field: 'edition_size',
        code: 'edition_size_required',
        message: 'A limited edition must state how many exist.',
      })
    }
  } else if (draft.edition_size !== null) {
    issues.push({
      field: 'edition_size',
      code: 'edition_size_not_allowed',
      message: 'Only a limited edition carries an edition size.',
    })
  }

  // --- dimensions -----------------------------------------------------------------------------
  issues.push(...dimensionIssues(draft.dimensions))

  // --- media references -----------------------------------------------------------------------
  if (draft.hero_media_id !== null) {
    if (context.knownMediaIds && !context.knownMediaIds.has(draft.hero_media_id)) {
      issues.push({
        field: 'hero_media_id',
        code: 'media_missing',
        message: 'The hero image no longer exists in the media library.',
      })
    } else if (context.conceptMediaIds?.has(draft.hero_media_id)) {
      issues.push({
        field: 'hero_media_id',
        code: 'media_concept',
        message:
          'Concept imagery may illustrate a material or a process, never a product. Use real Rivya media.',
      })
    }
  }

  return issues
}

// --- FEAT §22: the publication readiness checklist ---------------------------------------------

/** The ten items, in the order FEAT §22 lists them. The label is what Studio renders. */
export const READINESS_ITEMS = [
  'Title',
  'Description',
  'Category',
  'Price state',
  'Dimensions',
  'Materials',
  'Hero image',
  'Gallery',
  'SEO',
  'Customization',
] as const

export type ReadinessItem = (typeof READINESS_ITEMS)[number]

/**
 * Which items BLOCK publishing.
 *
 * The rule for the split: an item is required when its absence would put something dishonest or
 * empty in front of a visitor. A product with no category has no page to live on; with no hero
 * image its card is a grey box; with no price state the card cannot say anything true about cost;
 * with no materials it makes a material-led studio look like a dropshipper.
 *
 * Gallery and Customization are ADVISORY. A single strong photograph is a legitimate presentation,
 * and customisation is Phase 19's surface — blocking on either would stop a complete product from
 * publishing for the sake of a checklist.
 */
const REQUIRED_ITEMS: ReadonlySet<ReadinessItem> = new Set<ReadinessItem>([
  'Title',
  'Description',
  'Category',
  'Price state',
  'Dimensions',
  'Materials',
  'Hero image',
  'SEO',
])

export interface ReadinessEntry {
  readonly item: ReadinessItem
  readonly met: boolean
  readonly required: boolean
}

function filled(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim() !== ''
}

export function readinessChecklist(
  draft: ProductDraft,
  context: ProductContext = {},
): readonly ReadinessEntry[] {
  const met: Record<ReadinessItem, boolean> = {
    Title: filled(draft.title),
    Description: filled(draft.description),
    Category: draft.category_id !== null,
    // Every row has a price state — the column is not nullable — so this item asks the question
    // that matters: does the state agree with the numbers beside it?
    'Price state': priceIssues(draft).length === 0,
    Dimensions: hasDimensions(draft.dimensions),
    Materials: (context.materialIds?.length ?? 0) > 0,
    'Hero image': draft.hero_media_id !== null,
    Gallery: (context.galleryMediaIds?.length ?? 0) > 0,
    SEO: filled(draft.seo_title) && filled(draft.seo_description),
    // Answered by construction — the column is a non-null boolean — so this item is a prompt to
    // decide rather than a gate, and it is advisory for exactly that reason.
    Customization: true,
  }

  return READINESS_ITEMS.map((item) => ({
    item,
    met: met[item],
    required: REQUIRED_ITEMS.has(item),
  }))
}

/** The required items that are not met. Empty means publishing is allowed. */
export function unmetForPublish(checklist: readonly ReadinessEntry[]): readonly ReadinessItem[] {
  return checklist.filter((entry) => entry.required && !entry.met).map((entry) => entry.item)
}

/** The shape stored in `products.publication_readiness`, so Studio's list need not recompute it. */
export function readinessSnapshot(checklist: readonly ReadinessEntry[]): Record<string, unknown> {
  return {
    items: checklist.map((entry) => ({
      item: entry.item,
      met: entry.met,
      required: entry.required,
    })),
    unmet_required: unmetForPublish(checklist),
    computed_at: new Date().toISOString(),
  }
}
