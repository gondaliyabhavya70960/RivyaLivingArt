import type { RawProductDraft } from '../adapters/draft-schema'
import type { NormalizedProduct } from '../normalization/schema'

import {
  CHANGE_FIELDS,
  applyEnabled,
  classifyAvailability,
  classifyDimensions,
  classifyExact,
  classifyImages,
  classifyLeadTime,
  classifyPrice,
  classifyText,
  classifyTokenSet,
  resolveThresholds,
  type ChangeField,
  type ChangeKind,
  type ChangeRule,
  type Classification,
  type DimensionsSnapshot,
  type LeadTimeSnapshot,
  type PriceSnapshot,
} from './materiality'

/**
 * Two versions in, a list of field movements out. No database, no clock, no network.
 *
 * THE WHOLE PHASE TURNS ON THIS BEING PURE. A change record is an assertion about somebody else's
 * business — "this competitor raised its prices 12 % on the 14th" — and an assertion like that has
 * to be reproducible from the evidence years later, when the rule that produced it has been edited
 * twice and the page it read no longer exists. Version-to-version diffing gives that; a function
 * with no inputs but its two arguments and the rules makes it testable.
 *
 * IT DIFFS `normalized` FOR EIGHT FIELDS AND `raw` FOR THREE. `description`, `customization` and
 * `sku` are read by the adapter and stored, but the normalizer has no opinion about them — there
 * is nothing to parse in a description — so there is no normalised value to compare and the
 * source's own strings are what move. A29 records the reconciliation of the vocabularies.
 *
 * A FIELD WITH NOTHING ON EITHER SIDE PRODUCES NO ROW. Two nulls are not a change, and emitting
 * one would fill the queue with the fields a source never publishes.
 */

export interface VersionSide {
  readonly versionId: string
  readonly normalized: NormalizedProduct | null
  readonly raw: RawProductDraft
  readonly storageKey: string | null
}

export interface FieldChange {
  readonly field: ChangeField
  readonly changeKind: ChangeKind
  readonly materiality: Classification['materiality']
  readonly reason: string
  readonly measure: number | null
  readonly before: unknown
  readonly after: unknown
}

/**
 * Is this side of the comparison present at all?
 *
 * `null` AND AN EMPTY LIST ARE THE SAME ABSENCE for a field like `material_tokens`, and treating
 * them differently would make "the adapter found no materials" and "the adapter did not look" into
 * two different changes. They are one: the page says nothing about materials.
 */
function absent(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'string') return value.trim() === ''
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

function kindFor(before: unknown, after: unknown): ChangeKind | null {
  const wasAbsent = absent(before)
  const isAbsent = absent(after)
  if (wasAbsent && isAbsent) return null
  if (wasAbsent) return 'ADDED'
  if (isAbsent) return 'REMOVED'
  return 'MODIFIED'
}

const priceOf = (side: NormalizedProduct | null): PriceSnapshot => ({
  state: side?.priceState ?? null,
  currency: side?.currency ?? null,
  minMinor: side?.priceMinMinor ?? null,
  maxMinor: side?.priceMaxMinor ?? null,
})

const dimensionsOf = (side: NormalizedProduct | null): DimensionsSnapshot =>
  (side?.dimensionsMm ?? {}) as DimensionsSnapshot

const leadTimeOf = (side: NormalizedProduct | null): LeadTimeSnapshot => ({
  minDays: side?.leadTimeDaysMin ?? null,
  maxDays: side?.leadTimeDaysMax ?? null,
})

/**
 * The value stored in `before` / `after` for each field.
 *
 * IT IS THE COMPARED VALUE, NOT A RENDERING OF IT. The drawer decides how to show a dimensions
 * object or a URL list; storing a formatted string here would freeze a presentation decision into
 * evidence, and would make "which axis moved" unanswerable without re-parsing prose the detector
 * had already parsed.
 */
function valueFor(field: ChangeField, side: VersionSide): unknown {
  switch (field) {
    case 'price': {
      const price = priceOf(side.normalized)
      return price.state === null && price.minMinor === null ? null : price
    }
    case 'title':
      return side.normalized?.titleNormalized ?? side.raw.title ?? null
    case 'availability':
      return side.normalized?.availability ?? null
    case 'dimensions_mm':
      return side.normalized?.dimensionsMm ?? null
    case 'variant_count':
      return side.normalized?.variantCount ?? null
    case 'material_tokens':
      return side.normalized?.materialTokens ?? []
    case 'image_urls':
      return side.normalized?.imageUrls ?? side.raw.imageUrls ?? []
    case 'lead_time_days': {
      const lead = leadTimeOf(side.normalized)
      return lead.minDays === null && lead.maxDays === null ? null : lead
    }
    case 'description':
      return side.raw.descriptionHtml ?? null
    case 'customization':
      return side.raw.customizationTexts ?? []
    case 'sku':
      return side.raw.skuText ?? null
  }
}

/**
 * The rule for one field, applied to the two sides.
 *
 * A FIELD THAT APPEARED OR DISAPPEARED SKIPS ITS RULE, and every rule below may therefore assume
 * both sides are present. This is not a shortcut: a proportional rule has no denominator when the
 * before is missing, and a similarity has no second string. `ADDED` and `REMOVED` are MATERIAL for
 * every field this phase diffs — a price that vanishes, a description that appears, a SKU that is
 * withdrawn are each worth a person's attention — with one exception, `image_urls`, whose rule is
 * about set membership and handles an empty set on either side correctly by itself.
 */
function classify(
  field: ChangeField,
  kind: ChangeKind,
  before: VersionSide,
  after: VersionSide,
  rules: readonly ChangeRule[],
  sourceId: string,
): Classification {
  const thresholds = resolveThresholds(field, sourceId, rules)

  if (kind !== 'MODIFIED' && field !== 'image_urls' && field !== 'material_tokens') {
    return applyEnabled(
      { materiality: 'MATERIAL', reason: `${field}.${kind.toLowerCase()}` },
      thresholds,
    )
  }

  const classified = ((): Classification => {
    switch (field) {
      case 'price':
        return classifyPrice(priceOf(before.normalized), priceOf(after.normalized), thresholds)
      case 'title':
        return classifyText(
          'title',
          String(valueFor('title', before) ?? ''),
          String(valueFor('title', after) ?? ''),
          thresholds,
        )
      case 'description':
        return classifyText(
          'description',
          String(valueFor('description', before) ?? ''),
          String(valueFor('description', after) ?? ''),
          thresholds,
        )
      case 'availability':
        return classifyAvailability(
          before.normalized?.availability ?? null,
          after.normalized?.availability ?? null,
        )
      case 'dimensions_mm':
        return classifyDimensions(
          dimensionsOf(before.normalized),
          dimensionsOf(after.normalized),
          thresholds,
        )
      case 'material_tokens':
        return classifyTokenSet(
          'material_tokens',
          before.normalized?.materialTokens ?? [],
          after.normalized?.materialTokens ?? [],
        )
      case 'customization':
        return classifyTokenSet(
          'customization',
          before.raw.customizationTexts ?? [],
          after.raw.customizationTexts ?? [],
        )
      case 'image_urls':
        return classifyImages(
          (valueFor('image_urls', before) ?? []) as readonly string[],
          (valueFor('image_urls', after) ?? []) as readonly string[],
        )
      case 'lead_time_days':
        return classifyLeadTime(leadTimeOf(before.normalized), leadTimeOf(after.normalized))
      case 'variant_count':
        return classifyExact(
          'variant_count',
          before.normalized?.variantCount !== after.normalized?.variantCount,
        )
      case 'sku':
        return classifyExact('sku', (before.raw.skuText ?? null) !== (after.raw.skuText ?? null))
    }
  })()

  return applyEnabled(classified, thresholds)
}

/**
 * Are the two stored values the same, for the purpose of "did anything move at all"?
 *
 * A CHEAP STRUCTURAL TEST BEFORE THE EXPENSIVE RULE, and deliberately a conservative one: it says
 * "definitely equal" or "possibly different", and a possibly-different pair goes to the rule,
 * which is the thing qualified to say the difference is noise. `JSON.stringify` on two objects
 * built by the same code path in the same order is a sound equality test for that question; it is
 * not a general deep-equal, and it is not asked to be.
 */
function structurallyEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null || a === undefined || b === undefined) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

export function diffVersions(
  before: VersionSide,
  after: VersionSide,
  rules: readonly ChangeRule[],
  sourceId: string,
): readonly FieldChange[] {
  const changes: FieldChange[] = []

  for (const field of CHANGE_FIELDS) {
    const previous = valueFor(field, before)
    const current = valueFor(field, after)

    const kind = kindFor(previous, current)
    if (kind === null) continue
    if (kind === 'MODIFIED' && structurallyEqual(previous, current)) continue

    const classification = classify(field, kind, before, after, rules, sourceId)
    changes.push({
      field,
      changeKind: kind,
      materiality: classification.materiality,
      reason: classification.reason,
      measure: classification.measure ?? null,
      before: kind === 'ADDED' ? null : previous,
      after: kind === 'REMOVED' ? null : current,
    })
  }

  return changes
}
