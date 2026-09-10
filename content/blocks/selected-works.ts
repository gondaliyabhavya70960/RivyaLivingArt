import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

/**
 * A band of products, chosen by merchandising rather than by an editor. SEED §10-04.
 *
 * THE BLOCK HOLDS NO PRODUCTS AND NEVER WILL. `products` has zero rows, Phases 14 and 15 seed
 * none, and §10 says twice not to hardcode any. What the payload carries is the QUESTION —
 * how many to show, and which selection to ask for — while the answer comes from
 * `lib/cms/selectors`. Phase 22 replaced that selector's body with real merchandising, and this
 * file gained two optional keys — the slot to ask and the section to fall back to — and nothing
 * that names a product.
 *
 * WITH AN EMPTY CATALOGUE IT RENDERS ITS SEEDED EDITORIAL FALLBACK, not a skeleton and not a
 * placeholder card. A skeleton says "loading", which is false — nothing is loading, there is
 * nothing to load — and a placeholder card is a product that does not exist, which is the
 * fabrication D10 forbids in its plainest form.
 */
const schema = z.object({
  /** How many to show when there are any. Not a promise that there will be. */
  limit: z.number().int().min(1).max(12),
  /**
   * Which selection to ask the selector for. `featured` is the only one Phase 11 implements;
   * the others compile and return empty until Phase 22 gives them meaning.
   */
  selection: z.enum(['featured', 'newest', 'category']),
  /** Required when `selection` is `category`. Ignored otherwise. */
  category_slug: z.string().nullable(),
  /**
   * Phase 22: the merchandising slot that answers this band, or null for the page's default
   * (`HOMEPAGE_SELECTED_WORKS` on `/`, nothing elsewhere).
   *
   * OPTIONAL IN THE SCHEMA, PRESENT IN THE DEFAULTS, for the reason `category-grid` states: every
   * row seeded before this key existed must still parse, and `parseBlockPayload` falls back to the
   * defaults when a payload fails its schema — making it required would empty the band silently.
   */
  slot_key: z.string().nullable().optional(),
  /**
   * Phase 22: the section an EDITORIAL_BLOCK fallback draws its tiles from, or null for the page's
   * own `material-story` (SEED §10-05). The slot row carries the same field; the block's wins when
   * both are set, because the block is the thing on the page.
   */
  fallback_section_id: z.string().uuid().nullable().optional(),
})

export type SelectedWorksPayload = z.infer<typeof schema>

export const selectedWorksBlock: BlockModule<SelectedWorksPayload> = {
  type: 'selected-works',
  state: 'BUILT',
  label: 'Selected works',
  description:
    'A row of products chosen by merchandising, or its editorial fallback when there are none.',
  /*
   * THE MEDIA FIELDS ARE HERE FOR THE BACKDROP AND FOR NOTHING ELSE. Phase 11's media table gives
   * this band `interior-lifestyle` "as band backdrop only" — one wide picture behind the editorial
   * copy, never a card. The products, when there are any, bring their own images through the
   * selector, which is why there is no repeating slot on this block: a picture an editor placed
   * here could otherwise be mistaken for a product that does not exist.
   */
  sharedFields: [
    'eyebrow',
    'heading',
    'body',
    'cta_label',
    'cta_url',
    'media_desktop_id',
    'media_mobile_id',
    'media_alt_override',
  ],
  schema,
  defaults: {
    limit: 3,
    selection: 'featured',
    category_slug: null,
    slot_key: null,
    fallback_section_id: null,
  },
  payloadFields: [
    { name: 'limit', kind: 'number', label: 'How many to show' },
    {
      name: 'selection',
      kind: 'select',
      label: 'Selection',
      options: [
        { value: 'featured', label: 'Featured' },
        { value: 'newest', label: 'Newest' },
        { value: 'category', label: 'From one category' },
      ],
    },
    {
      name: 'category_slug',
      kind: 'text',
      label: 'Category slug',
      help: 'Only used by the "From one category" selection.',
    },
    {
      name: 'slot_key',
      kind: 'text',
      label: 'Merchandising slot',
      help: 'Leave empty for the homepage slot. Curated under Merchandising → Homepage.',
    },
    {
      name: 'fallback_section_id',
      kind: 'text',
      label: 'Fallback section',
      help: "The section whose media and copy the editorial fallback draws. Leave empty for this page's material story.",
    },
  ],
  entryArrays: [],
  mediaSlots: [
    { id: 'backdrop', role: 'DESKTOP', repeating: false, desktopRatio: '16:9', mobileRatio: '4:5' },
  ],
  layoutVariants: ['grid', 'carousel'],
  allowedPages: null,
}
