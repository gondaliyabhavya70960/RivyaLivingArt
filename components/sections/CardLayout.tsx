import * as React from 'react'

import { ContentCarousel } from '@/components/patterns/ContentCarousel'
import { Grid } from '@/components/primitives/Grid'
import { carouselLabels, type SiteStrings } from '@/lib/cms/strings'

/**
 * The three arrangements a band of cards may take, in one place.
 *
 * WHY IT EXISTS. Eleven blocks in the catalogue declare two `layoutVariants` and, until Phase 45,
 * branched on NEITHER — every one of them rendered its first-listed variant unconditionally, so the
 * Studio's picker offered a choice that changed nothing. Six of those eleven differ only in whether
 * their cards wrap into a grid or scroll in a row, and writing that decision six times is how six
 * bands come to disagree about what a row is: one with snap, one without, one that forgets the
 * accessible names, one whose arrows appear at the wrong width.
 *
 * IT TAKES CHILDREN RATHER THAN AN ITEM ARRAY, deliberately, and that is what makes it a small
 * change at each call site instead of a rewrite. A renderer already has its `{cards.map(…)}` inside
 * a `<Grid>`; swapping the element is one line. `React.Children.toArray` is what lets the carousel
 * wrap each child in its own `<li>` — and it preserves the keys the caller set, so a reorder still
 * does the right thing.
 *
 * `rv-reveal-group` BELONGS TO THE GRID AND NOT TO THE ROW. `app/styles/motion.css` fades a group's
 * members in as the band crosses the viewport; in a horizontal row the members off to the right are
 * outside the viewport by definition, so they would sit at opacity 0 until somebody scrolled them
 * in — which, in a container that scrolls sideways rather than down, a page scroll never does. A
 * row reveals as one band, with its section.
 */

export type CardLayoutMode = 'grid' | 'carousel' | 'strip'

export type CardLayoutProps = {
  readonly layout: CardLayoutMode
  /** The grid's column classes. Ignored by the two row modes. */
  readonly gridClassName: string
  readonly strings: SiteStrings
  /** The row's accessible name — the section's own heading. Ignored by the grid. */
  readonly label: string | null
  readonly children: React.ReactNode
}

export function CardLayout({
  layout,
  gridClassName,
  strings,
  label,
  children,
}: CardLayoutProps): React.ReactElement {
  if (layout === 'grid') {
    return (
      <Grid gap={6} className={`rv-reveal-group ${gridClassName}`}>
        {children}
      </Grid>
    )
  }

  return (
    <ContentCarousel
      items={React.Children.toArray(children)}
      mode={layout === 'carousel' ? 'snap' : 'free'}
      label={label}
      {...carouselLabels(strings)}
    />
  )
}

/**
 * A section's `layout_variant`, read as an arrangement.
 *
 * AN UNKNOWN VALUE FALLS THROUGH, as `schemeOf` does for an unknown theme. `layout_variant` is a
 * `text` column an editor or a migration can put anything into, and a renderer that trusted it
 * would render nothing at all for a typo — a blank band with no clue why.
 *
 * THE FALLBACK IS THE BLOCK'S FIRST DECLARED VARIANT, passed by the caller, because that is what
 * the catalogue means by a default: `journal-strip` declares `strip` then `grid`, and
 * `selected-works` the other way round.
 */
export function cardLayoutOf(
  section: { readonly layout_variant: string | null },
  fallback: CardLayoutMode,
): CardLayoutMode {
  const variant = section.layout_variant
  if (variant === 'grid' || variant === 'carousel' || variant === 'strip') return variant
  /* `row` is what four blocks call a strip. Same arrangement, the catalogue's own word for it. */
  if (variant === 'row') return 'strip'
  return fallback
}
