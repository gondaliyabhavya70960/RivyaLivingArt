import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

/**
 * A band of featured collections and categories, chosen by merchandising. SEED §10-03's other
 * half, added in Phase 22.
 *
 * WHY A BLOCK OF ITS OWN AND NOT `category-grid`. The seeded §10-03 band is a `category-grid` — five
 * hand-written cards with their own descriptions, two of them withheld until the owner verifies a
 * capability claim — and it stays exactly that: editorial copy an editor owns. This block holds NO
 * cards. It asks `HOMEPAGE_FEATURED_COLLECTIONS` what is featured, draws the answer from the
 * collections' and categories' own rows, and hides itself (the slot's fallback) below three.
 * Folding the two into one block would have made a curated list and a hand-written list the same
 * thing with a flag, and the day the flag was wrong a concept collection would be on the homepage.
 *
 * IT IS NOT SEEDED ONTO THE HOMEPAGE. Adding a section to a seeded page is an editor's act in
 * Studio; the block is addable on `/` and reads the homepage slot by default the moment it is.
 */
const schema = z.object({
  limit: z.number().int().min(1).max(12),
  /**
   * The slot to read, or null for the page's default (`HOMEPAGE_FEATURED_COLLECTIONS` on `/`).
   * Written explicitly only to point a band somewhere unusual; the default is what the register
   * names for the page.
   */
  slot_key: z.string().nullable(),
})

export type FeaturedCollectionsPayload = z.infer<typeof schema>

export const featuredCollectionsBlock: BlockModule<FeaturedCollectionsPayload> = {
  type: 'featured-collections',
  state: 'BUILT',
  label: 'Featured collections',
  description:
    'Published collections and categories chosen in Studio → Merchandising → Featured. Hidden below three.',
  sharedFields: ['eyebrow', 'heading', 'body', 'cta_label', 'cta_url'],
  schema,
  defaults: { limit: 3, slot_key: null },
  payloadFields: [
    { name: 'limit', kind: 'number', label: 'How many to show' },
    {
      name: 'slot_key',
      kind: 'text',
      label: 'Merchandising slot',
      help: 'Leave empty for the homepage slot. Curated under Merchandising → Featured.',
    },
  ],
  entryArrays: [],
  mediaSlots: [],
  layoutVariants: ['grid', 'strip'],
  allowedPages: ['/', '/collection'],
}
