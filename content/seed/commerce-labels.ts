import type { SeedModule, SeedRecord } from './types'

/**
 * The label library: SEED §7's thirteen CTAs, §30's ten price labels and §31's seven action labels.
 *
 * WHY THESE ARE ROWS AND NOT CONSTANTS. Every one of them is a word a visitor reads on a button,
 * and D2 puts every visitor-readable string in the database so the owner can change "Enquire on
 * WhatsApp" to something else without a deploy. They are also the strings most likely to be
 * reworded: button copy is where a business's voice gets tuned.
 *
 * THE KEY IS DERIVED FROM THE LABEL, NOT NUMBERED. `cta.commission_a_piece` rather than `cta.03`,
 * because a numbered key tells a reader nothing and renumbers if the list is reordered. The label
 * is the identity here; if the owner rewords it, the key stays and the value changes, which is
 * exactly the indirection these rows exist to provide.
 *
 * TWO LABELS NEED CARE, and the phase document calls both out:
 *
 *   `Place Order` is seeded `is_enabled = false`. There is no checkout and there will not be one
 *   (D1's business rules: no online checkout, no payment gateway, no customer accounts). The label
 *   exists because §31 lists it and because deleting it would invite someone to re-add it later
 *   with a cart behind it; disabled with a note is the honest state. If it is ever enabled it
 *   resolves to the inquiry + WhatsApp flow.
 *
 *   `Ready Stock` is seeded `OWNER_VERIFICATION_REQUIRED`. It asserts that something is available
 *   now, which is a claim about inventory nobody has confirmed — and D10 forbids seeding an
 *   availability claim.
 */

/** `Explore Large Format` → `explore_large_format`. Stable while the wording changes. */
function keyFor(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

function labelRow(
  group: string,
  label: string,
  options: { description?: string; enabled?: boolean; verification?: string } = {},
): SeedRecord {
  const key = keyFor(label)
  return {
    seedKey: `global:${group}.${key}`,
    table: 'global_content',
    fields: {
      group_key: group,
      key,
      label,
      value: label,
      description: options.description ?? null,
      is_enabled: options.enabled ?? true,
      /**
       * A row asserting an unverified claim CANNOT be published, and the database says so:
       * `global_content_verified_before_publish` refuses the combination. Deriving the status from
       * the flag rather than letting a caller state both is what stops the two disagreeing — the
       * first draft seeded `Ready Stock` PUBLISHED and OWNER_VERIFICATION_REQUIRED together, and
       * the constraint rejected it, which is the check working exactly as intended.
       */
      status: options.verification === 'OWNER_VERIFICATION_REQUIRED' ? 'DRAFT' : 'PUBLISHED',
      fact_classification: 'BRAND_COPY',
      owner_verification: options.verification ?? 'NOT_REQUIRED',
    },
  }
}

/** SEED §7, in the specification's order. */
const CTA_LABELS = [
  'Explore Large Format',
  'View the Collection',
  'Commission a Piece',
  'Start a Custom Project',
  'Explore Selected Works',
  'Discover the Process',
  'View Product',
  'View Project',
  'Explore Materials',
  'Read the Journal',
  'Discuss Your Idea',
  'Enquire on WhatsApp',
  'Send an Enquiry',
] as const

/** SEED §30, in the specification's order. */
const PRICE_LABELS = [
  'Price',
  'From',
  'Starting from',
  'Request a Quote',
  'Price on Request',
  'Made to Order',
  'One of One',
  'Limited Edition',
  'Ready Stock',
  'Customizable',
] as const

/** SEED §31, in the specification's order. */
const ACTION_LABELS = [
  'Customize This Piece',
  'Place Order',
  'Discuss on WhatsApp',
  'Request a Quote',
  'Ask About This Piece',
  'View Details',
  'Explore Similar Work',
] as const

/**
 * The one row this module gained in Phase 14, and the only one that is not a label.
 *
 * SEED §27's `EMPTY_STATE.collection` already covers "this collection is being prepared" — a
 * category with nothing published in it, and the whole catalogue on `/collection`. It does not
 * cover the other empty listing: a category that HAS products, none of which match the filters a
 * visitor has applied. Showing "this collection is being prepared" there would be untrue, and it
 * would send someone away from a catalogue that has exactly what they want one checkbox back.
 *
 * So the two empty states say different things and the difference is the point. This one names the
 * filters as the cause, and the rail renders "Clear Filters" beside it — a way out rather than a
 * dead end. `EDITORIAL_COPY`, because it describes the interface and asserts nothing about the
 * business.
 */
const NO_RESULTS: SeedRecord = {
  seedKey: 'global:EMPTY_STATE.collection.no_results',
  table: 'global_content',
  fields: {
    group_key: 'EMPTY_STATE',
    key: 'collection.no_results',
    label: 'Collection — no results for these filters',
    value: 'No pieces match these filters.',
    description:
      'Shown when a collection has published products but none match the applied filters — a different situation from SEED §27, which is a collection with nothing in it. Rendered with a Clear Filters action.',
    is_enabled: true,
    status: 'PUBLISHED',
    fact_classification: 'EDITORIAL_COPY',
    owner_verification: 'NOT_REQUIRED',
  },
}

export const commerceLabelsSeed: SeedModule = {
  name: 'commerce-labels',
  description:
    '13 CTA labels (§7), 10 price labels (§30), 7 action labels (§31) and the filtered-listing empty state.',
  records: [
    ...CTA_LABELS.map((label) => labelRow('CTA', label)),

    ...PRICE_LABELS.map((label) =>
      label === 'Ready Stock'
        ? labelRow('COMMERCE_LABEL', label, {
            description:
              'Asserts that a piece is available now, which is a claim about inventory nobody has confirmed. D10 forbids seeding an availability claim, so this is flagged for the owner before it can be published anywhere.',
            verification: 'OWNER_VERIFICATION_REQUIRED',
          })
        : labelRow('COMMERCE_LABEL', label),
    ),

    ...ACTION_LABELS.map((label) =>
      label === 'Place Order'
        ? labelRow('ACTION_LABEL', label, {
            description:
              'DISABLED, and it stays disabled. There is no online checkout and no payment gateway — that is a fixed business rule, not a missing feature. The label is seeded because §31 lists it and because deleting it invites someone to re-add it later with a cart behind it. If it is ever enabled it must resolve to the inquiry + WhatsApp flow, never to a basket.',
            enabled: false,
          })
        : labelRow('ACTION_LABEL', label),
    ),

    NO_RESULTS,
  ],
}
