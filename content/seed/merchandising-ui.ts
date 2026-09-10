import type { SeedModule, SeedRecord } from './types'

/**
 * Phase 22: the two headings the route-level merchandising regions draw.
 *
 * A curated band inside a page takes its heading from its own section; the two regions a ROUTE
 * appends — the featured row on `/collection` and the pinned region on a category page — have no
 * section, so their heading is a `global_content` row. Editable in Studio, EDITORIAL_COPY, and
 * asserting nothing: neither names a product, a price or a capability.
 */
function uiRow(key: string, value: string, label: string, description: string): SeedRecord {
  return {
    seedKey: `global:UI_LABEL.${key}`,
    table: 'global_content',
    fields: {
      group_key: 'UI_LABEL',
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

export const merchandisingUiSeed: SeedModule = {
  name: 'merchandising-ui',
  description:
    'Phase 22 merchandising: the heading over the featured row on /collection and over the pinned region on a category page.',
  records: [
    uiRow(
      'merchandising.store_featured',
      'Featured',
      'Store — featured row heading',
      'The heading above the pieces and collections curated into STORE_FEATURED_ROW on /collection. The row is absent below three entries.',
    ),
    uiRow(
      'merchandising.pinned',
      'Highlighted in this category',
      'Category page — pinned region heading',
      'The heading above the pieces pinned to the top of a category page (CATEGORY_PINNED_*). Absent when nothing is pinned.',
    ),
  ],
}
