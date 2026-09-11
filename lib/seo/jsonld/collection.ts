import type { Collection } from '@/lib/supabase/schemas'

/**
 * `CollectionPage` structured data for an exhibition page.
 *
 * WHAT IT WILL NOT EMIT IS THE WHOLE OF THIS FILE. The ten seeded collections are CONCEPTS — a
 * name, a slug and a sort order, with no statement, no media and no products, because writing a
 * statement about a collection that does not exist yet would assert a business capability nobody
 * has confirmed (D10). Structured data is read by machines that cannot see the page's careful
 * emptiness, so every optional key here is ABSENT rather than empty: no `description` invented from
 * the name, no `image` pointing at a category photograph that is not this collection's, and no
 * `numberOfItems: 0`, which reads as "a collection with nothing in it" rather than "a collection
 * whose contents are not published".
 *
 * NO `hasPart` OR `mainEntity` EITHER. Listing the curated products as parts would republish them
 * outside their own visibility rule the moment a draft piece slipped into the curation — and the
 * products already emit their own `Product` nodes on their own pages, where the price rules in
 * `product-jsonld.ts` apply. One claim, in one place.
 *
 * `null` FOR A COLLECTION WITH NOTHING TO SAY, and the route renders no script tag at all rather
 * than an empty graph. A `CollectionPage` node carrying only a URL tells a crawler nothing it did
 * not have from the sitemap.
 */

export type CollectionJsonLd = {
  readonly '@type': 'CollectionPage'
  readonly name: string
  readonly url: string
  readonly description?: string
  readonly image?: string
}

export function collectionJsonLd(
  collection: Collection,
  url: string,
  imageUrl: string | null,
): CollectionJsonLd | null {
  // Phase 39's gate: the row is PUBLISHED. The route only reaches here through the anon client,
  // which already refuses a draft; the check is stated so a test can state it too.
  if (collection.status !== 'PUBLISHED') return null
  const name = collection.name?.trim() ?? ''
  // A node with no name is not a description of anything. The column is `not null`, so this is a
  // guard against whitespace rather than against absence.
  if (name === '') return null

  const statement = collection.statement?.trim() ?? ''

  return {
    '@type': 'CollectionPage',
    name,
    url,
    ...(statement === '' ? {} : { description: statement }),
    ...(imageUrl === null ? {} : { image: imageUrl }),
  }
}
