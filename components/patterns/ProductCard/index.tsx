import type { Route } from 'next'
import Link from 'next/link'
import * as React from 'react'

import { BlockImage } from '@/components/patterns/MediaSlot'
import { Badge } from '@/components/primitives/Badge'
import { Cluster } from '@/components/primitives/Cluster'
import { Eyebrow } from '@/components/primitives/Eyebrow'
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
 * IT IS A LINK FROM PHASE 42, AND IT SHOULD HAVE BEEN ONE FROM PHASE 15.
 *
 * This comment used to read "it is not a link, and that is the phase boundary": `/product/[slug]`
 * did not exist in Phase 14, so an anchor would have put a 404 behind every card — the dead door
 * `resolveInternalTarget` exists to refuse. Phase 15 shipped the route and was supposed to add "the
 * heading anchor and the `::after` overlay the registry record describes". It shipped the route and
 * not the anchor, and NOTHING NOTICED FOR TWENTY-SEVEN PHASES: every unit test asserted what the
 * card renders, the registry row described the intent, and no test asked the only question a
 * visitor asks — can I open this. `tests/e2e/touch.spec.ts` asked it in Phase 42 and found a
 * catalogue whose products could not be reached from the catalogue.
 *
 * THE ANCHOR IS ON THE HEADING AND THE OVERLAY IS A `::after`, which is the shape the registry
 * record specifies and the right one: the accessible name is the product's title rather than
 * "read more", there is exactly ONE link per card — a whole-card anchor wrapping the image would
 * announce the picture and the title as two separate links to the same place — and the `::after`
 * makes the entire card tappable, which is what a finger expects.
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
  /**
   * The heading level this card's title takes. Defaults to 3.
   *
   * A CARD TITLE IS NOT ALWAYS THE SAME DEPTH, and fixing it at 3 produced a real defect that
   * Phase 42's heading spec found: on `/collection` and `/journal` the grid is the page's own
   * region, the only heading above it is the `h1`, and every card title arrived as an `h3` with no
   * `h2` between. A screen-reader user jumping the outline hears level 3 headings belonging to
   * nothing.
   *
   * THE PAGE KNOWS AND THE CARD CANNOT. Inside a CMS section that renders its own `h2` the card is
   * correctly an `h3`; as the page's top-level grid it is an `h2`. So the level is passed in, and 3
   * remains the default because that is the common case.
   */
  readonly headingLevel?: 2 | 3
}

/** The registry caps the card at two badges; `productBadges` returns them in priority order. */
const MAX_BADGES = 2

export function ProductCard({
  product,
  asset,
  categoryName = null,
  strings,
  cloudName,
  sizes = '(min-width: 1024px) 30vw, (min-width: 430px) 45vw, 100vw',
  headingLevel = 3,
}: ProductCardProps): React.ReactElement {
  const price = presentPrice(product, strings)
  const badges = productBadges(product, strings).slice(0, MAX_BADGES)

  return (
    <article
      data-product-card=""
      data-product-slug={product.slug}
      data-price-state={product.price_state}
      // `relative` is what the overlay below is positioned against. Without it the `::after`
      // stretches to the nearest positioned ancestor, which is the grid, and one card swallows
      // every other card's taps.
      className="group relative"
    >
      <Stack gap={3}>
        <BlockImage
          asset={asset}
          ratio="4:5"
          preset="card"
          sizes={sizes}
          strings={strings}
          cloudName={cloudName}
          /*
           * THE DURATION TOKEN DID NOT EXIST — Phase 45, found by the §50 motion inventory.
           *
           * This line read `duration-(--rv-motion-medium)`. There is no such token: the
           * `--rv-motion-*` family is `rise-sm/md/lg`, `parallax-max` and `stagger`, and durations
           * live under `--rv-duration-*`. `duration-(--var)` is valid Tailwind syntax whatever the
           * variable resolves to, so `check-tokens.mjs` (which fails on colour literals and on
           * arbitrary values) and `check-utilities.mjs` (which fails on a class that produces no
           * CSS) both passed it — the class DID produce CSS, with an empty duration. Every card in
           * the catalogue therefore snapped to its hover scale rather than easing into it, on the
           * one component a visitor meets most.
           *
           * `--rv-duration-quick` and `--rv-ease-standard` are what §4.2 assigns to the LIGHT
           * class, which is the class hover belongs to. `motion-reduce:transition-none` is the
           * house idiom for the parity branch §4.5 requires.
           */
          className="transition-transform duration-(--rv-duration-quick) ease-standard group-hover:scale-[1.015] motion-reduce:transition-none"
          /*
           * THE EMPTY WELL CARRIES THE CATEGORY WORD — §A5, "a sand well with the category word in
           * mono, never Image unavailable".
           *
           * A52 made every public well silent, which was right for an editorial band: an unbound
           * hero has nothing useful to say. A PRODUCT CARD IS DIFFERENT. A grid of identical blank
           * wells is unreadable, and the one fact the card already knows — what kind of object this
           * is — turns each well into a legible placeholder without asserting anything. It is not a
           * message about the image; it is the card's own category, set in the frame instead of a
           * photograph that does not exist yet.
           *
           * `Eyebrow` RATHER THAN HAND-ROLLED CLASSES. It is the mono face (§A46's third family),
           * uppercased in CSS so the accessible name keeps the editor's casing, with the 0.14em
           * tracking that makes uppercase legible at this size. Reaching for `font-mono` here would
           * be a second opinion about what a mono label is.
           *
           * `aria-hidden`, AND THAT IS THE WHOLE REASON IT IS SAFE. The same category word is real
           * text a few lines below, under the title. Announcing it twice would make every card in
           * the grid stutter for a screen-reader user, and this copy is decorative — it stands in
           * for a picture, which is exactly the thing assistive tech should skip.
           *
           * THE WELL'S COLOUR IS NOT SET HERE and must not be. `MediaFrame` paints
           * `--rv-surface-sunken`, whose §2.5 role is "wells, code, table header, empty media", and
           * on the catalogue's mineral and sand grounds that role IS the sand the brief asks for.
           * A literal would fail `check-tokens.mjs` and would also be wrong on DEEP.
           */
          fallback={
            categoryName === null ? undefined : (
              <Eyebrow as="span" tone="tertiary" aria-hidden="true" data-card-empty-category="">
                {categoryName}
              </Eyebrow>
            )
          }
        />

        {product.title === null ? null : (
          <Heading level={headingLevel} size="display-xs">
            <Link
              href={`/product/${product.slug}` as Route}
              data-product-link=""
              /*
               * `after:absolute after:inset-0` is the overlay: the anchor's own box is the title,
               * and its `::after` covers the card. A tap anywhere lands on this link, while the
               * accessible name stays the title and the focus ring renders on the card outline
               * rather than around the words — which is what the registry record asks for.
               */
              className="after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--rv-ink-accent)"
            >
              {product.title}
            </Link>
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
