import * as React from 'react'

import { BlockImage } from '@/components/patterns/MediaSlot'
import { Badge } from '@/components/primitives/Badge'
import { Cluster } from '@/components/primitives/Cluster'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { presentPrice, productBadges } from '@/lib/catalog/price'
import type { SiteStrings } from '@/lib/cms/strings'
import type { MediaAsset, Product } from '@/lib/supabase/schemas'

/**
 * RC-217. One product in the grid — server-rendered, zero client JavaScript.
 *
 * WHAT IT MAY SAY, AND NOTHING BEYOND IT. A picture, a title, its category, the price the record
 * actually carries, and at most two state badges. No hover-revealed specification, no comparison
 * checkbox, no "New" or "Bestseller", and — D1, FEAT §39 — no cart, wishlist or buy affordance of
 * any kind. Those are not omissions to fill in later: there is no checkout and there will not be
 * one, so a control implying otherwise would be a lie about how this business works.
 *
 * IT IS NOT A LINK, AND THAT IS THE PHASE BOUNDARY. `/product/[slug]` is Phase 15. Wrapping the
 * card in an anchor now would put a 404 behind every card in the grid, which is the same mistake
 * Phase 13's `resolveInternalTarget` exists to prevent — a door that does not open. Phase 15 adds
 * the heading anchor and the `::after` overlay the registry record describes; until then the card
 * is an `<article>` and the grid is a list of things, not a list of links to nowhere.
 *
 * `data-product-card` IS AN ASSERTION HOOK, not styling. The phase's own verification counts these
 * elements to prove the catalogue is empty — "zero `[data-product-card]` on every category page" —
 * and an attribute survives a CSS rename in a way a class does not.
 *
 * THE PRICE IS NEVER FORMATTED HERE. `presentPrice` is the only place that happens, and it returns
 * a label with no amount for both quote states, so this component cannot render a number a
 * quote-only product does not have even if someone later passes it one.
 */

/** Only what a card draws. A narrower type than `Product` so nothing else can leak onto the card. */
export type ProductCardProduct = Pick<
  Product,
  | 'id'
  | 'slug'
  | 'title'
  | 'price_state'
  | 'price_minor'
  | 'price_from_minor'
  | 'currency'
  | 'availability_state'
  | 'edition_state'
  | 'edition_size'
  | 'is_customizable'
  | 'hero_media_id'
>

export interface ProductCardProps {
  readonly product: ProductCardProduct
  /** The hero asset, already resolved. A card never fetches. */
  readonly asset: MediaAsset | null
  /** The category's name, from `categories.name`. Null on a listing that spans categories. */
  readonly categoryName?: string | null
  readonly strings: SiteStrings
  readonly cloudName: string
  /** The grid's `sizes` attribute, which only the grid knows. */
  readonly sizes?: string
}

/** The registry caps the card at two badges; `productBadges` returns them in priority order. */
const MAX_BADGES = 2

export function ProductCard({
  product,
  asset,
  categoryName = null,
  strings,
  cloudName,
  sizes = '(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw',
}: ProductCardProps): React.ReactElement {
  const price = presentPrice(product, strings)
  const badges = productBadges(product, strings).slice(0, MAX_BADGES)

  return (
    <article
      data-product-card=""
      data-product-slug={product.slug}
      data-price-state={product.price_state}
      className="group"
    >
      <Stack gap={3}>
        <BlockImage
          asset={asset}
          ratio="4:5"
          preset="card"
          sizes={sizes}
          strings={strings}
          cloudName={cloudName}
          className="transition-transform duration-(--rv-motion-medium) group-hover:scale-[1.015]"
        />

        {product.title === null ? null : (
          <Heading level={3} size="display-xs">
            {product.title}
          </Heading>
        )}

        {categoryName === null ? null : (
          <Text size="sm" tone="secondary">
            {categoryName}
          </Text>
        )}

        {price === null ? null : (
          <Text size="base">
            {/*
             * The label and the amount are two nodes, not one interpolated string. "From ₹12,500"
             * is a label followed by a number, and a quote-only piece renders the label alone —
             * with no separator left dangling, because there is nothing after it to separate.
             */}
            <span data-price-label="">{price.label}</span>
            {price.amount === null ? null : <span data-price-amount=""> {price.amount}</span>}
          </Text>
        )}

        {badges.length === 0 ? null : (
          <Cluster gap={2}>
            {badges.map((badge) => (
              <Badge key={badge.key} tone="neutral" data-product-badge={badge.kind}>
                {/*
                 * The edition size is appended as its own node for the same reason: the label is a
                 * seeded word and the number is data, and joining them into one string here would
                 * make the word unchangeable without a deploy.
                 */}
                {badge.label}
                {badge.detail === null ? null : <span data-badge-detail=""> {badge.detail}</span>}
              </Badge>
            ))}
          </Cluster>
        )}
      </Stack>
    </article>
  )
}
