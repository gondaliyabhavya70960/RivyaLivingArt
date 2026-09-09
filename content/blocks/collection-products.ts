import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

/**
 * The pieces in a collection. FEAT §8 element 4, and the reason an exhibition page is not a poster.
 *
 * THE BLOCK HOLDS NO PRODUCTS, exactly as `selected-works` holds none. The curation lives in
 * `product_collections` — a Phase 03 join with its own `sort_order`, which is what the Studio
 * curator drag-reorders — and this payload carries only the QUESTION: which collection, and how
 * many. Putting product ids here would fork the answer in two, and the copy in the payload would
 * be the one nobody updates.
 *
 * `collection_slug` NULL MEANS "THE COLLECTION THIS PAGE BELONGS TO", and that is the default
 * because `collections.page_id` already records the link, uniquely and with a foreign key. A block
 * that repeated the slug would be a second opinion about the same fact — and the day someone
 * repoints the page at a different collection, the band would go on showing the old one, silently
 * and only on the page where it matters most. Naming a slug explicitly is still allowed, because
 * the block is also useful on a page that is not an exhibition: a category page showing what a
 * collection holds, a homepage band. Both readings are resolved once, before render, in
 * `lib/cms/references.ts`.
 *
 * NO MEDIA SLOTS, and none of the shared media fields either. The products bring their own
 * pictures through the selector; a backdrop bound here would sit behind them competing for the
 * same attention, and an editor's picture in a band OF PRODUCTS is the one place a stray image is
 * most likely to be read as a product that does not exist.
 *
 * WITH NOTHING CURATED IT RENDERS THE SEEDED `EMPTY_STATE.collection` SENTENCE — "This collection
 * is being prepared" — which is true of all ten concepts today and will stay true of any
 * collection until the owner attaches pieces to it. Not a skeleton, which claims something is
 * loading, and not a placeholder card, which would be a fabricated product (D10).
 */
const schema = z.object({
  /**
   * How many to show. A ceiling, never a promise: a collection with three pieces shows three.
   */
  limit: z.number().int().min(1).max(24),
  /**
   * Which collection, or `null` for the one this page belongs to.
   *
   * A SLUG RATHER THAN AN ID, matching `selected-works.category_slug`, because a payload is read
   * and written by people: a slug in a JSON field can be recognised, and a uuid cannot. The
   * resolution happens once, server-side, where a slug that names nothing is an empty band rather
   * than an error.
   */
  collection_slug: z.string().nullable(),
})

export type CollectionProductsPayload = z.infer<typeof schema>

export const collectionProductsBlock: BlockModule<CollectionProductsPayload> = {
  type: 'collection-products',
  state: 'BUILT',
  label: 'Collection products',
  description: 'The pieces curated into a collection, in the order the curator arranged them.',
  sharedFields: ['eyebrow', 'heading', 'body', 'cta_label', 'cta_url'],
  schema,
  defaults: { limit: 12, collection_slug: null },
  payloadFields: [
    { name: 'limit', kind: 'number', label: 'How many to show', min: 1, max: 24 },
    {
      name: 'collection_slug',
      kind: 'text',
      label: 'Collection slug',
      help: 'Leave empty to show the collection this page belongs to. Fill it in only to show a different one.',
    },
  ],
  entryArrays: [],
  mediaSlots: [],
  layoutVariants: ['grid', 'carousel'],
  allowedPages: null,
}
