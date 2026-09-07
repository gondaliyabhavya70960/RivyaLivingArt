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
 * See Stack for why `gap` is a union of §5.1 steps and why a list element gets an
 * explicit `role`.
 */
export type GridGap = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20

export type GridElement = 'div' | 'ul' | 'ol' | 'section' | 'article' | 'nav'

/** §5.4: 16px, then 24px from 768, then 32px from 1440. The default when `gap` is unset. */
const RESPONSIVE_GAP = 'gap-4 md:gap-6 2xl:gap-8'

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

const LIST_ELEMENTS = new Set<GridElement>(['ul', 'ol'])

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
        'grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12',
        gap === undefined ? RESPONSIVE_GAP : GAP[gap],
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
})
