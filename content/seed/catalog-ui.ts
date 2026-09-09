import type { SeedModule, SeedRecord } from './types'

/**
 * The words the catalogue's controls use: the filter rail, the sort control and pagination.
 *
 * WHY A MODULE OF ITS OWN, AND WHY IT EXISTS AT ALL. The Phase 14 document names one seed addition
 * — the "filters match nothing" empty state, which lives in `commerce-labels.ts` where the
 * document puts it. What it did not anticipate is that a server-rendered filter rail needs its own
 * vocabulary: something has to name the Material group, the sort options and the Previous link.
 * D2 and SEED §1 leave no room for typing those into JSX — `scripts/cms/check-section-copy.ts`
 * fails the build over exactly that, in `components/patterns` where the rail lives — so they are
 * rows, and this module is where they live.
 *
 * IT FOLLOWS `site-chrome.ts` EXACTLY, for the reason that module gives: Phase 10's shell strings
 * did not belong in Phase 09's `global.ts` because their reason for existing was in a different
 * phase, and back-filling them would have made it impossible to tell which sentences came from the
 * SEED specification and which from a component. The same applies here twice over: none of these
 * is quoted from the specification, all of them describe a control, and a reader should be able to
 * see at a glance which strings the catalogue invented.
 *
 * TWO VALUE LABELS, AND WHY ONLY TWO. Most facet values already have a label: SEED §30 names
 * `Ready Stock`, `Made to Order`, `One of One`, `Limited Edition`, `Customizable` and all four
 * price states, and the rail reads those from `COMMERCE_LABEL` rather than restating them. The
 * gaps are `OPEN_EDITION`, which §30 has no word for because it is the ABSENCE of a scarcity
 * claim and therefore never appears on a card, and the `large-format` scale value, which is a
 * filter and not a badge. Those two are interface words, so they are `UI_LABEL` rows rather than
 * an eleventh and twelfth commerce label.
 *
 * NONE OF THESE ASSERTS A BUSINESS FACT. They name controls, so every row is `EDITORIAL_COPY` /
 * `NOT_REQUIRED` and seeds `PUBLISHED`: a filter whose groups have no names is not a filter, and
 * gating the catalogue's controls behind owner verification would make the listing unusable while
 * telling the owner nothing they could act on.
 */

function catalogRow(
  group: 'UI_LABEL' | 'ACTION_LABEL',
  key: string,
  value: string,
  label: string,
  description: string,
): SeedRecord {
  return {
    seedKey: `catalog:${group.toLowerCase()}.${key}`,
    table: 'global_content',
    fields: {
      group_key: group,
      key,
      label,
      value,
      description,
      is_enabled: true,
      status: 'PUBLISHED',
      fact_classification: 'EDITORIAL_COPY',
      owner_verification: 'NOT_REQUIRED',
    },
  }
}

export const catalogUiSeed: SeedModule = {
  name: 'catalog-ui',
  description: 'Phase 14 listing controls: filter rail groups, sort options, pagination.',
  records: [
    // --- the rail and its groups (UI_LABEL) -----------------------------------------------------
    catalogRow(
      'UI_LABEL',
      'catalog.filters',
      'Filter',
      'Filter rail heading',
      'The heading above the filters on a collection page. Also the accessible name of the filter form.',
    ),
    catalogRow(
      'UI_LABEL',
      'catalog.facet.material',
      'Material',
      'Filter group — material',
      'Names the group of material checkboxes. The materials themselves are rows in the materials table and are never listed here.',
    ),
    catalogRow(
      'UI_LABEL',
      'catalog.facet.price',
      'Price',
      'Filter group — price state',
      'Names the group of price-state checkboxes. Each option reads its own words from the COMMERCE_LABEL rows, so this is the group name only.',
    ),
    catalogRow(
      'UI_LABEL',
      'catalog.facet.availability',
      'Availability',
      'Filter group — availability',
      'Names the group holding Ready Stock and Made to Order.',
    ),
    catalogRow(
      'UI_LABEL',
      'catalog.facet.edition',
      'Edition',
      'Filter group — edition',
      'Names the group holding One of One, Limited Edition and Open Edition.',
    ),
    catalogRow(
      'UI_LABEL',
      'catalog.facet.scale',
      'Scale',
      'Filter group — scale',
      'Names the group holding the large-format filter.',
    ),
    catalogRow(
      'UI_LABEL',
      'catalog.facet.customization',
      'Customization',
      'Filter group — customization',
      'Names the group holding the customizable filter. The option itself reads the COMMERCE_LABEL word.',
    ),
    catalogRow(
      'UI_LABEL',
      'catalog.facet.collection',
      'Collection',
      'Filter group — collection',
      'Names the group of collection checkboxes. Collections stay DRAFT_COLLECTION_CONCEPT until the owner confirms them, so this group is empty until then.',
    ),

    // --- the two facet values SEED §30 has no word for ------------------------------------------
    catalogRow(
      'UI_LABEL',
      'catalog.value.large_format',
      'Large Format',
      'Filter value — large format',
      'The one value the scale filter accepts. A filter, not a badge: no product card shows it.',
    ),
    catalogRow(
      'UI_LABEL',
      'catalog.value.open_edition',
      'Open Edition',
      'Filter value — open edition',
      'SEED §30 has no label for this because it is the ABSENCE of a scarcity claim and never appears on a card. It is still a thing a visitor may want to filter to, so it needs a word here.',
    ),

    // --- sort (UI_LABEL) ------------------------------------------------------------------------
    //
    // There is no "price" option, and there will not be one: three of the four price states carry
    // no number, so an ordering across them would have to invent a position for "Request a Quote".
    // Recorded in docs/project/BUSINESS_RULES.md.
    catalogRow(
      'UI_LABEL',
      'catalog.sort',
      'Sort',
      'Sort control label',
      'Labels the sort control on a collection page.',
    ),
    catalogRow(
      'UI_LABEL',
      'catalog.sort.curated',
      'Curated',
      'Sort option — curated',
      'The default order: the sequence the owner arranged in Studio, with anything unplaced falling in behind it, newest first.',
    ),
    catalogRow(
      'UI_LABEL',
      'catalog.sort.newest',
      'Newest',
      'Sort option — newest',
      'Most recently published first.',
    ),
    catalogRow(
      'UI_LABEL',
      'catalog.sort.title',
      'Title (A–Z)',
      'Sort option — title',
      'Alphabetical by title.',
    ),

    // --- results and pagination (UI_LABEL) ------------------------------------------------------
    catalogRow(
      'UI_LABEL',
      'catalog.results',
      'Pieces',
      'Product grid region name',
      'Never shown on screen. Names the grid of products so a screen-reader user can tell it from the filters beside it.',
    ),
    catalogRow(
      'UI_LABEL',
      'catalog.pagination.position',
      'Page {{page}} of {{pages}}',
      'Pagination position',
      'The only string on the listing that contains a number, so the only one carrying tokens. Both {{page}} and {{pages}} are substituted at render time; the sentence lives here whole because "Page 2 of 7" cannot be rebuilt from fragments in another language. Shown on narrow screens, where the numbered page strip is dropped.',
    ),
    catalogRow(
      'UI_LABEL',
      'catalog.pagination',
      'Pages',
      'Pagination region name',
      'Never shown on screen. Names the pagination navigation, so it is not announced as an unlabelled second "navigation" beside the site menu.',
    ),

    // --- the controls (ACTION_LABEL) ------------------------------------------------------------
    catalogRow(
      'ACTION_LABEL',
      'catalog.apply',
      'Apply',
      'Apply filters button',
      'Submits the filter form. It is a real submit button because the rail is a plain GET form: without JavaScript this is the only thing that applies a filter, so it can never be hidden behind a script.',
    ),
    catalogRow(
      'ACTION_LABEL',
      'catalog.clear',
      'Clear Filters',
      'Clear filters link',
      'Returns to the unfiltered listing. Shown only when something is filtering, and always shown then — it is the way out of a set of filters that matched nothing.',
    ),
    catalogRow(
      'ACTION_LABEL',
      'catalog.previous',
      'Previous',
      'Pagination — previous page',
      'The link to the previous page of results. Carries rel="prev".',
    ),
    catalogRow(
      'ACTION_LABEL',
      'catalog.next',
      'Next',
      'Pagination — next page',
      'The link to the next page of results. Carries rel="next".',
    ),
  ],
}
