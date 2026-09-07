import * as React from 'react'
import { cn } from '@/lib/ui/cn'

/**
 * Divider is a rule drawn in --rv-line-subtle (§2.8: "Decorative rules only. Any border
 * that identifies a control uses --rv-line-strong"). It is always an <hr> — a real void
 * element, never a styled <div> — so the semantic case costs nothing and the decorative
 * case is one attribute away.
 *
 * DECORATIVE BY DEFAULT, AND HIDDEN WHEN IT IS. Most rules in this system are visual
 * punctuation between blocks that are already separated by headings and landmarks; an
 * <hr> exposes role="separator" to assistive tech, and a screen-reader user who meets six
 * of them in a page has been told nothing six times. `decorative` (the default) sets
 * aria-hidden, which removes it from the accessibility tree entirely. Pass
 * `decorative={false}` only where the rule is the ONLY thing marking a change of subject.
 *
 * It carries no margin. Spacing between a divider and what it divides belongs to the
 * layout that owns both, not to the rule itself.
 */
export type DividerOrientation = 'horizontal' | 'vertical'

const ORIENTATION: Record<DividerOrientation, string> = {
  horizontal: 'w-full border-t',
  // A vertical rule has no height of its own: it stretches to the flex row it sits in.
  vertical: 'h-full self-stretch border-l',
}

export interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
  orientation?: DividerOrientation
  /** Visual punctuation only. Default true, which hides the rule from assistive tech. */
  decorative?: boolean
}

export const Divider = React.forwardRef<HTMLHRElement, DividerProps>(function Divider(
  { orientation = 'horizontal', decorative = true, className, ...rest },
  ref,
) {
  return (
    <hr
      ref={ref}
      aria-hidden={decorative || undefined}
      // role="separator" is implicit on <hr> and defaults to horizontal; a semantic
      // vertical rule has to say so. Pointless while aria-hidden, hence the pairing.
      aria-orientation={!decorative && orientation === 'vertical' ? 'vertical' : undefined}
      className={cn('m-0 border-0 border-line', ORIENTATION[orientation], className)}
      {...rest}
    />
  )
})
