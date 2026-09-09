import * as React from 'react'
import { cn } from '@/lib/ui/cn'
import { asTag } from '@/lib/ui/polymorphic'

/**
 * Grid is the editorial column grid of DESIGN_SYSTEM §5.4, and only that: 4 columns below
 * 768px, 8 from 768, 12 from 1024, with the gap stepping 16px -> 24px -> 32px at 1440.
 * Children place themselves on it with `col-span-*`, which is why there is no `columns`
 * prop — a caller who wants three cards across on desktop is describing a span, not a
 * different grid, and a second column count would put two grids in the system.
 *
 * The breakpoints are the bridge's, which are §5.2's: `md` 48rem/768, `lg` 64rem/1024,
 * `2xl` 90rem/1440. Mobile-first, so the base classes are the 360px case and no
 * `max-width` query appears anywhere.
 *
 * WHAT THIS IS NOT. §5.4 also specifies card grids as `repeat(auto-fill, minmax(<min>,
 * 1fr))` with per-entity minimums — product 280px, collection 320px, portfolio 340px,
 * journal 300px — so four products do not stretch across twelve columns. Those minimums
 * are raw pixel values with no token, and expressing them here would need an arbitrary
 * class that check-tokens.mjs rejects. They belong to the card grid patterns that own
 * those entities, each of which knows its own minimum. This primitive stays the column
 * grid, and a card rail is not built by bending it.
 *
 * A CALLER MAY STILL STATE ITS OWN COLUMN COUNT, and when it does this drops the three
 * defaults entirely rather than emitting both sets. That is not a convenience; it is a
 * correctness fix. `cn` is a plain joiner with no Tailwind awareness, so two competing
 * `grid-cols-*` utilities on one element are settled by STYLESHEET order, not by which
 * was passed last — and Tailwind emits `grid-cols-*` in ascending numeric order within
 * each breakpoint layer. `grid-cols-4` therefore beat a caller's `grid-cols-1`, and
 * `lg:grid-cols-12` beat `lg:grid-cols-3`. Every caller that passed column classes was
 * rendering 4 columns on a phone and 12 on a desktop: measured in Chromium, a product
 * card came out 66px wide at 360px and 90px at 1440px. Six call sites across five phases
 * were affected, so the fix belongs here rather than in any one of them.
 *
 * Only a caller that names NO column class gets the editorial 4/8/12, which is the
 * contract `col-span-*` children rely on.
 *
 * See Stack for why `gap` is a union of §5.1 steps, why `ul` alone gets an explicit
 * `role`, and why an `ol` is left to render its own numbers.
 */
export type GridGap = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20

export type GridElement = 'div' | 'ul' | 'ol' | 'section' | 'article' | 'nav'

/** §5.4: 16px, then 24px from 768, then 32px from 1440. The default when `gap` is unset. */
const RESPONSIVE_GAP = 'gap-4 md:gap-6 2xl:gap-8'

/** §5.4's editorial column grid. Emitted only when the caller states no columns of its own. */
const EDITORIAL_COLUMNS = 'grid-cols-4 md:grid-cols-8 lg:grid-cols-12'

/**
 * True when `className` carries any `grid-cols-*`, at any breakpoint. The leading boundary
 * matters: `sm:grid-cols-2` is preceded by a colon, a bare `grid-cols-1` by a space or the
 * start of the string, and neither may be confused with a class that merely ends in those
 * characters.
 */
function statesColumns(className: string | undefined): boolean {
  return className !== undefined && /(?:^|[\s:])grid-cols-/.test(className)
}

const GAP: Record<GridGap, string> = {
  0: 'gap-0',
  1: 'gap-1',
  2: 'gap-2',
  3: 'gap-3',
  4: 'gap-4',
  5: 'gap-5',
  6: 'gap-6',
  8: 'gap-8',
  10: 'gap-10',
  12: 'gap-12',
  16: 'gap-16',
  20: 'gap-20',
}

/** Only `ul`: see the note above on why an `ol` must keep its markers. */
const LIST_ELEMENTS = new Set<GridElement>(['ul'])

export interface GridProps extends React.HTMLAttributes<HTMLElement> {
  as?: GridElement
  /**
   * Fixes the gap at one §5.1 step at every viewport. Left unset, the grid uses §5.4's
   * responsive gap, which is what a section laid out on the column grid wants.
   */
  gap?: GridGap
}

export const Grid = React.forwardRef<HTMLElement, GridProps>(function Grid(
  { as = 'div', gap, className, children, ...rest },
  ref,
) {
  const Tag = asTag(as)
  return (
    <Tag
      ref={ref}
      role={LIST_ELEMENTS.has(as) ? 'list' : undefined}
      className={cn(
        'grid',
        statesColumns(className) ? undefined : EDITORIAL_COLUMNS,
        gap === undefined ? RESPONSIVE_GAP : GAP[gap],
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
})
