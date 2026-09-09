import { siteString, type SiteStrings } from '@/lib/cms/strings'

import { BADGE_LABEL_KEYS, PRICE_LABEL_KEYS } from './price'
import { CATALOG_SORTS, type AvailabilityState, type CatalogSort, type EditionState, type PriceState } from './query'

/**
 * The words the LISTING CONTROLS use, as opposed to the words a card uses.
 *
 * WHY THIS IS NOT IN `price.ts`. That module answers "what does this product's price say?", which
 * needs a product. The filter rail asks a different question — "what is this option called?" —
 * about a value with no product behind it, and it asks it for dimensions a card never shows
 * (Scale, Collection). Sharing the label rows is not a reason to share a module.
 *
 * MOST FACET VALUES REUSE THE SEED §30 COMMERCE LABELS, deliberately. `Ready Stock` in the rail
 * and `Ready Stock` on a card must be the same words, or an owner rewording one is left wondering
 * why the other did not change. The two gaps — `OPEN_EDITION` and the `large-format` scale value —
 * are `UI_LABEL` rows seeded by `content/seed/catalog-ui.ts`, with the reason recorded there.
 *
 * A MISSING ROW MEANS THE OPTION DOES NOT RENDER, following `lib/cms/strings.ts`: an unlabelled
 * checkbox is worse than an absent one, because a visitor can tick it and cannot tell what they
 * ticked. Every lookup here returns `string | null` and every caller drops the null.
 */

const UI = 'UI_LABEL'
const ACTION = 'ACTION_LABEL'
const EMPTY = 'EMPTY_STATE'

/** Group headings, region names and the sort options. */
export const CATALOG_UI_KEYS = {
  filters: `${UI}.catalog.filters`,
  results: `${UI}.catalog.results`,
  pagination: `${UI}.catalog.pagination`,
  paginationPosition: `${UI}.catalog.pagination.position`,
  sort: `${UI}.catalog.sort`,
  facetMaterial: `${UI}.catalog.facet.material`,
  facetPrice: `${UI}.catalog.facet.price`,
  facetAvailability: `${UI}.catalog.facet.availability`,
  facetEdition: `${UI}.catalog.facet.edition`,
  facetScale: `${UI}.catalog.facet.scale`,
  facetCustomization: `${UI}.catalog.facet.customization`,
  facetCollection: `${UI}.catalog.facet.collection`,
  valueLargeFormat: `${UI}.catalog.value.large_format`,
  valueOpenEdition: `${UI}.catalog.value.open_edition`,
} as const

export const CATALOG_ACTION_KEYS = {
  apply: `${ACTION}.catalog.apply`,
  clear: `${ACTION}.catalog.clear`,
  previous: `${ACTION}.catalog.previous`,
  next: `${ACTION}.catalog.next`,
} as const

/** SEED §27's "being prepared", and the Phase 14 row for "these filters matched nothing". */
export const CATALOG_EMPTY_KEYS = {
  collection: `${EMPTY}.collection`,
  noResults: `${EMPTY}.collection.no_results`,
} as const

const SORT_KEYS: Record<CatalogSort, string> = {
  curated: `${UI}.catalog.sort.curated`,
  newest: `${UI}.catalog.sort.newest`,
  title: `${UI}.catalog.sort.title`,
}

export function sortLabel(sort: CatalogSort, strings: SiteStrings): string | null {
  return siteString(strings, SORT_KEYS[sort])
}

/** The sort options that have a label, in the order they are offered. */
export function sortOptions(strings: SiteStrings): readonly { value: CatalogSort; label: string }[] {
  return CATALOG_SORTS.map((value) => ({ value, label: sortLabel(value, strings) })).filter(
    (option): option is { value: CatalogSort; label: string } => option.label !== null,
  )
}

const PRICE_STATE_KEYS: Record<PriceState, string> = {
  FIXED: PRICE_LABEL_KEYS.fixed,
  STARTING_FROM: PRICE_LABEL_KEYS.from,
  REQUEST_QUOTE: PRICE_LABEL_KEYS.requestQuote,
  PRICE_ON_REQUEST: PRICE_LABEL_KEYS.priceOnRequest,
}

export function priceStateLabel(state: PriceState, strings: SiteStrings): string | null {
  if (state === 'STARTING_FROM') {
    // The same two-spellings rule `presentPrice` follows, so the rail and the card agree.
    return (
      siteString(strings, PRICE_LABEL_KEYS.from) ?? siteString(strings, PRICE_LABEL_KEYS.startingFrom)
    )
  }
  return siteString(strings, PRICE_STATE_KEYS[state])
}

export function availabilityLabel(state: AvailabilityState, strings: SiteStrings): string | null {
  return siteString(strings, BADGE_LABEL_KEYS[state])
}

export function editionLabel(state: EditionState, strings: SiteStrings): string | null {
  // OPEN_EDITION is the one edition value with no SEED §30 label, because it is the absence of a
  // scarcity claim and never appears on a card. It is still filterable, so it has a UI_LABEL word.
  if (state === 'OPEN_EDITION') return siteString(strings, CATALOG_UI_KEYS.valueOpenEdition)
  return siteString(strings, BADGE_LABEL_KEYS[state])
}

export function customizableLabel(strings: SiteStrings): string | null {
  return siteString(strings, BADGE_LABEL_KEYS.customizable)
}

export function largeFormatLabel(strings: SiteStrings): string | null {
  return siteString(strings, CATALOG_UI_KEYS.valueLargeFormat)
}
