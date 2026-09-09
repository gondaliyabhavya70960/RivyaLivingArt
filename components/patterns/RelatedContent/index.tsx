import * as React from 'react'

import { ProductCard, type ProductCardProduct } from '@/components/patterns/ProductCard'
import { Grid } from '@/components/primitives/Grid'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { interpolate, siteString, type SiteStrings } from '@/lib/cms/strings'
import type { MediaAsset } from '@/lib/supabase/schemas'

/**
 * Related content — editor edges, or an honestly-labelled fallback, and never a blend of the two.
 *
 * NO RELATION IS INVENTED. "Related" means an editor drew an edge in `product_relations` and said
 * these two things belong together. Nothing here computes affinity, and there is no scoring, no
 * "customers also viewed", no tag overlap — FEAT §11 puts the relationship engine in Phase 23,
 * behind named rules an editor can override, and this component predates all of it.
 *
 * THE ONE AUTOMATIC BEHAVIOUR IS LABELLED AS WHAT IT IS. When a product has zero manual edges, up
 * to six other published products in the same category are shown under "More in {Category}" —
 * never "Related", never "You may also like", never "Recommended". The heading is the honesty: it
 * says these pieces share a category, which is true and checkable, rather than implying a judgement
 * nobody made. The two headings come from different CMS keys so they cannot be confused for one
 * another by an editor renaming a string.
 *
 * IT IS EITHER/OR. A curated set is never topped up to six with same-category filler, because a
 * visitor cannot tell which of the six an editor chose. One manual edge means one card.
 */

export type RelatedMode = 'curated' | 'same-category'

export interface RelatedContentProps {
  readonly mode: RelatedMode
  /** Already resolved, ordered, and capped by the caller. */
  readonly products: readonly ProductCardProduct[]
  readonly assets: ReadonlyMap<string, MediaAsset>
  /** Only used by the `same-category` heading, which names it. */
  readonly categoryName: string | null
  readonly strings: SiteStrings
  /**
   * Empty string when the environment has no cloud name, matching what `loadCatalogListing` passes
   * ProductCard — the card then renders its own fallback frame rather than a broken image.
   */
  readonly cloudName: string
  readonly headingLevel?: 2 | 3
}

/** FEAT §11's cap on the automatic branch. A curated set is whatever the editor drew. */
export const SAME_CATEGORY_LIMIT = 6

export function RelatedContent({
  mode,
  products,
  assets,
  categoryName,
  strings,
  cloudName,
  headingLevel = 2,
}: RelatedContentProps): React.ReactElement | null {
  if (products.length === 0) return null

  const heading =
    mode === 'curated'
      ? siteString(strings, 'UI_LABEL.product.related.curated')
      : // The fallback heading NAMES the category, so "More in Furniture" is a statement of fact
        // rather than a claim of relevance. Without the name it would read as a recommendation.
        (() => {
          const template = siteString(strings, 'UI_LABEL.product.related.same_category')
          if (template === null || categoryName === null) return null
          return interpolate(template, { category: categoryName })
        })()

  // An unnamed band of products beside a product reads as "related" whether or not it says so.
  // Without its heading the section does not render at all.
  if (heading === null) return null

  return (
    <section data-related-content={mode}>
      <Stack gap={6}>
        <Heading level={headingLevel}>{heading}</Heading>
        <Grid gap={8} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              asset={
                product.hero_media_id === null ? null : (assets.get(product.hero_media_id) ?? null)
              }
              strings={strings}
              cloudName={cloudName}
            />
          ))}
        </Grid>
      </Stack>
    </section>
  )
}
