import * as React from 'react'
import { cn } from '@/lib/ui/cn'

/**
 * Skeleton is the shape a thing will have, drawn while it is still on its way
 * (registry RC-027). It is decoration, and it says so: `aria-hidden="true"`.
 *
 * WHY IT IS HIDDEN. A screen-reader user does not want six placeholder rectangles read out
 * as "blank, blank, blank"; they want one announcement that the region is loading and then
 * the content. The announcement belongs to whatever owns the region — a `role="status"`
 * container, an `aria-busy` control, the DataTable's live count (§13.1) — the same
 * division of labour Spinner uses, where the surrounding control owns the status and the
 * glyph is decorative. So `aria-hidden` is not a prop here: it is the contract, set after
 * the spread so nothing can turn it off, and removed from the prop type so trying is a
 * type error rather than a silent regression.
 *
 * REDUCED MOTION IS A STATIC BRANCH, NOT A SLOWER PULSE. §4.3 spells the skeleton case out
 * by name: "static block at `--rv-surface-raised-2`; no shimmer". `motion-reduce:animate-none`
 * removes the animation outright, leaving the block painted at full opacity — the finished
 * composition, not a faster journey to it. The `!important` transition floor in base.css
 * would merely have compressed a 2s pulse into 0.01ms, which is a flicker, not a branch.
 *
 * WHY THE PULSE IS RE-TIMED. Tailwind's `animate-pulse` ships a 2s loop. §4.1 fixes
 * `--rv-duration-scene` at 900ms and calls it "the ceiling. Nothing in this product animates
 * longer" — a rule about the product, not about one transition — so the duration is taken
 * back from the token layer in `style`, which beats the class's shorthand. 900ms is the
 * slowest loop the system permits, and the slowest is what a placeholder wants.
 *
 * SIZE COMES FROM THE CALLER, WITH A FLOOR. A skeleton is the silhouette of specific
 * content — a 4-line paragraph, a table row of six cells, a card's meta line — so its
 * height and width are `className` (`h-10 w-2/3`), on the §5.1 scale like everything else.
 * `min-h-4` is a floor, not a default: a skeleton nobody sized would otherwise be zero
 * pixels tall, reserving nothing and showing nothing, and a caller's `h-*` still wins
 * because a minimum and a height are different properties rather than the same utility
 * fighting for cascade order.
 *
 * The tone is `--rv-surface-raised-2`, §4.3's stated value, and it carries the
 * `rv-surface-raised-2` marker class for the same reason Surface does (§2.11): the class,
 * not the background, is what triggers the automatic ink step-ups for anything nested
 * inside it. A skeleton has no children today, and the marker keeps that true if one ever
 * composes around it.
 */
export type SkeletonRadius = 'none' | 'xs' | 'sm' | 'md' | 'pill'

/** §6.1 maps radius to what a thing is: media is square, controls are rounded. */
const RADIUS: Record<SkeletonRadius, string> = {
  none: 'rounded-none',
  xs: 'rounded-xs',
  sm: 'rounded-sm',
  md: 'rounded-md',
  pill: 'rounded-pill',
}

export interface SkeletonProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'aria-hidden' | 'children'> {
  /**
   * §6.1. `sm` matches inputs and buttons, `md` cards and panels, `pill` chips and status
   * pills, `none` the media a MediaFrame would hold.
   */
  radius?: SkeletonRadius
}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(function Skeleton(
  { radius = 'sm', className, style, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'bg-surface-raised-2 rv-surface-raised-2 block w-full min-h-4',
        'animate-pulse motion-reduce:animate-none',
        RADIUS[radius],
        className,
      )}
      style={{ animationDuration: 'var(--rv-duration-scene)', ...style }}
      {...rest}
      // Not negotiable, and therefore after the spread: a placeholder that announces
      // itself is noise in the one moment a screen-reader user has nothing else to hear.
      aria-hidden="true"
    />
  )
})
