import type { Category, MediaAsset, Product } from '@/lib/supabase/schemas'

/**
 * `Product` structured data, and the four keys it refuses to invent.
 *
 * THE RULE THIS FILE EXISTS FOR IS `offers`. Search engines read `offers` as a commitment: a price,
 * a currency, an availability. Three of this catalogue's four price states mean "there is no number
 * here" — STARTING_FROM carries a floor rather than a price, and both quote states carry nothing at
 * all — so emitting `offers` for any of them would publish a figure Rivya never quoted, to an
 * audience that cannot see the page's own careful wording. The key is therefore OMITTED ENTIRELY
 * rather than emitted with a zero, a null, or a `priceValidUntil` nobody chose. `price_minor` is
 * only ever populated beside FIXED — `products_price_state_coherent` in 0122 guarantees it — so the
 * one branch that emits a number is the one branch where a number exists.
 *
 * NO `aggregateRating`, NO `review`, EVER. This business has no reviews (D10 forbids inventing
 * them), and a rating stub with zero votes is a claim that a rating exists. There is no branch here
 * that can emit either key, so no future edit can turn one on by passing a flag.
 *
 * NO `availability` EITHER, even though `availability_state` exists. Schema.org's vocabulary for it
 * is `InStock` / `OutOfStock` / `PreOrder`, and none of those means "made when you order it". The
 * closest, `MadeToOrder`, is not part of `ItemAvailability`. Mapping READY_STOCK to `InStock` would
 * also republish an inventory claim outside the publish gate 0122 puts on it. Omitted.
 *
 * EVERY OPTIONAL KEY IS ABSENT RATHER THAN NULL. A JSON-LD consumer treats `"sku": null` as a
 * malformed sku, not as an absent one.
 */

export type ProductOffer = {
  readonly '@type': 'Offer'
  readonly price: string
  readonly priceCurrency: string
}

export type ProductJsonLd = {
  readonly '@context': 'https://schema.org'
  readonly '@type': 'Product'
  readonly name: string
  readonly url: string
  readonly description?: string
  readonly image?: readonly string[]
  readonly brand?: { readonly '@type': 'Brand'; readonly name: string }
  readonly category?: string
  readonly sku?: string
  readonly offers?: ProductOffer
}

export type ProductJsonLdInput = {
  readonly product: Product
  readonly url: string
  /** The brand name, from `global_content`. Absent when the CMS has not been seeded. */
  readonly brandName: string | null
  readonly category: Category | null
  /** Already-built absolute image URLs, hero first. Empty is fine and produces no `image` key. */
  readonly imageUrls: readonly string[]
  /** Minor units to a decimal string, so this module never divides by a guessed exponent. */
  readonly formatAmount: (minor: number, currency: string) => string | null
}

function blank(value: string | null | undefined): boolean {
  return typeof value !== 'string' || value.trim() === ''
}

/**
 * The offer, or null.
 *
 * Null for every state but FIXED, and null even for FIXED when the row is incoherent — a missing
 * currency or an amount the formatter cannot express. A half-built offer is worse than none: it
 * publishes a number without saying what it is denominated in.
 */
function offerFor(input: ProductJsonLdInput): ProductOffer | null {
  const { product } = input
  if (product.price_state !== 'FIXED') return null
  if (product.price_minor === null || blank(product.currency)) return null

  const price = input.formatAmount(product.price_minor, product.currency as string)
  if (price === null) return null

  return { '@type': 'Offer', price, priceCurrency: product.currency as string }
}

/**
 * Returns null when the product has no name, because a `Product` node without one is not a product
 * — it is a URL with a type annotation, and emitting it tells a crawler less than emitting nothing.
 */
export function productJsonLd(input: ProductJsonLdInput): ProductJsonLd | null {
  const { product } = input
  if (blank(product.title)) return null

  const offer = offerFor(input)

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: (product.title as string).trim(),
    url: input.url,
    ...(blank(product.description) ? {} : { description: (product.description as string).trim() }),
    ...(input.imageUrls.length === 0 ? {} : { image: input.imageUrls }),
    ...(input.brandName === null || blank(input.brandName)
      ? {}
      : { brand: { '@type': 'Brand' as const, name: input.brandName.trim() } }),
    ...(input.category === null ? {} : { category: input.category.name }),
    ...(blank(product.sku) ? {} : { sku: (product.sku as string).trim() }),
    ...(offer === null ? {} : { offers: offer }),
  }
}

/** The hero first, then the gallery, de-duplicated — the order a crawler reads as significance. */
export function productImageUrls(
  hero: MediaAsset | null,
  gallery: readonly MediaAsset[],
  toUrl: (asset: MediaAsset) => string | null,
): readonly string[] {
  const ordered = hero === null ? gallery : [hero, ...gallery.filter((a) => a.id !== hero.id)]
  const urls = ordered.map(toUrl).filter((url): url is string => url !== null)
  return [...new Set(urls)]
}
