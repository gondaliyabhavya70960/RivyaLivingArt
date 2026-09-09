import type { CatalogFacets } from '@/lib/supabase/repositories/catalog-listing'
import { siteString, type SiteStrings } from '@/lib/cms/strings'

import {
  CATALOG_UI_KEYS,
  availabilityLabel,
  customizableLabel,
  editionLabel,
  largeFormatLabel,
  priceStateLabel,
} from './labels'
import {
  SCALE_LARGE_FORMAT,
  type CatalogParam,
  type CatalogQuery,
} from './query'

/**
 * Turning facet counts into the rail's groups — the decision layer, kept out of the component.
 *
 * WHAT DECIDES WHETHER AN OPTION EXISTS. It renders when it would return something, or when it is
 * already applied. The first half is the phase's rule: a facet with a zero count is HIDDEN, never
 * offered as a dead option a visitor clicks to reach an empty page. The second half is what makes
 * the first survivable — an applied filter must always be visible so it can be unapplied, and a
 * filter that matched nothing would otherwise disappear along with its results, leaving no way
 * back but the browser's history.
 *
 * COUNTS COME FROM THE SAME PREDICATE AS THE ROWS, so the rail narrows as filters are applied.
 * `lib/supabase/repositories/catalog-listing.ts` argues that choice; here it just means every
 * number beside a checkbox is true of the listing currently on screen.
 *
 * AN OPTION WITH NO LABEL DOES NOT RENDER. Every label is a `global_content` row and there is no
 * fallback, so a missing row costs one checkbox rather than putting an internal enum value on the
 * public site. `lib/cms/strings.ts` argues that at length.
 */

export interface FacetOption {
  /** The value that goes in the URL. */
  readonly value: string
  readonly label: string
  readonly count: number
  readonly checked: boolean
}

export interface FilterGroup {
  /** The query parameter these options belong to — also the checkbox `name`. */
  readonly param: CatalogParam
  readonly legend: string
  readonly options: readonly FacetOption[]
}

/** A material or collection as the rail needs it: an id to count by, a slug to filter by. */
export interface RailEntity {
  readonly id: string
  readonly slug: string
  readonly name: string
}

export interface RailInput {
  readonly query: CatalogQuery
  readonly facets: CatalogFacets
  readonly materials: readonly RailEntity[]
  readonly collections: readonly RailEntity[]
  readonly strings: SiteStrings
}

/** Keep an option when something matches it, or when it is already applied. */
function keep(count: number, checked: boolean): boolean {
  return count > 0 || checked
}

function entityGroup(
  param: CatalogParam,
  legendKey: string,
  entities: readonly RailEntity[],
  counts: ReadonlyMap<string, number>,
  applied: readonly string[],
  strings: SiteStrings,
): FilterGroup | null {
  const legend = siteString(strings, legendKey)
  if (legend === null) return null

  const options = entities
    .map((entity) => ({
      value: entity.slug,
      label: entity.name,
      count: counts.get(entity.id) ?? 0,
      checked: applied.includes(entity.slug),
    }))
    .filter((option) => keep(option.count, option.checked))

  return options.length === 0 ? null : { param, legend, options }
}

function enumGroup<T extends string>(
  param: CatalogParam,
  legendKey: string,
  values: readonly T[],
  label: (value: T, strings: SiteStrings) => string | null,
  counts: ReadonlyMap<string, number>,
  applied: readonly string[],
  strings: SiteStrings,
): FilterGroup | null {
  const legend = siteString(strings, legendKey)
  if (legend === null) return null

  const options: FacetOption[] = []
  for (const value of values) {
    const text = label(value, strings)
    if (text === null) continue
    const count = counts.get(value) ?? 0
    const checked = applied.includes(value)
    if (keep(count, checked)) options.push({ value, label: text, count, checked })
  }

  return options.length === 0 ? null : { param, legend, options }
}

/** A dimension with exactly one option — Scale and Customization are both on/off. */
function toggleGroup(
  param: CatalogParam,
  legendKey: string,
  value: string,
  label: string | null,
  count: number,
  checked: boolean,
  strings: SiteStrings,
): FilterGroup | null {
  const legend = siteString(strings, legendKey)
  if (legend === null || label === null || !keep(count, checked)) return null
  return { param, legend, options: [{ value, label, count, checked }] }
}

/**
 * The groups, in the order the rail renders them.
 *
 * MATERIAL FIRST because this is a material-led studio and it is the dimension a visitor is most
 * likely to have in mind. Price second because it is the one everyone checks. The rest follow in
 * decreasing likelihood of being used, which is also increasing specificity.
 */
export function buildFilterGroups({
  query,
  facets,
  materials,
  collections,
  strings,
}: RailInput): readonly FilterGroup[] {
  const groups: (FilterGroup | null)[] = [
    entityGroup(
      'material',
      CATALOG_UI_KEYS.facetMaterial,
      materials,
      facets.material,
      query.material,
      strings,
    ),
    enumGroup(
      'price',
      CATALOG_UI_KEYS.facetPrice,
      ['FIXED', 'STARTING_FROM', 'REQUEST_QUOTE', 'PRICE_ON_REQUEST'] as const,
      priceStateLabel,
      facets.price,
      query.price,
      strings,
    ),
    enumGroup(
      'availability',
      CATALOG_UI_KEYS.facetAvailability,
      ['READY_STOCK', 'MADE_TO_ORDER'] as const,
      availabilityLabel,
      facets.availability,
      query.availability,
      strings,
    ),
    enumGroup(
      'edition',
      CATALOG_UI_KEYS.facetEdition,
      ['ONE_OF_ONE', 'LIMITED_EDITION', 'OPEN_EDITION'] as const,
      editionLabel,
      facets.edition,
      query.edition,
      strings,
    ),
    toggleGroup(
      'scale',
      CATALOG_UI_KEYS.facetScale,
      SCALE_LARGE_FORMAT,
      largeFormatLabel(strings),
      facets.largeFormat,
      query.largeFormat,
      strings,
    ),
    toggleGroup(
      'customizable',
      CATALOG_UI_KEYS.facetCustomization,
      '1',
      customizableLabel(strings),
      facets.customizable,
      query.customizable,
      strings,
    ),
    entityGroup(
      'collection',
      CATALOG_UI_KEYS.facetCollection,
      collections,
      facets.collection,
      query.collection,
      strings,
    ),
  ]

  return groups.filter((group): group is FilterGroup => group !== null)
}
