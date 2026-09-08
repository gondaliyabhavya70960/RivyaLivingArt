import * as React from 'react'
import { cn } from '@/lib/ui/cn'
import { asTag } from '@/lib/ui/polymorphic'

/**
 * VisuallyHidden takes content out of the visual layout and leaves it in the accessible
 * tree (registry RC-028). It is the opposite of `aria-hidden`, and confusing the two is
 * the most common way an interface loses information it thought it had given:
 * `display: none` and `hidden` remove content from BOTH; `aria-hidden` removes it from
 * assistive technology only; this removes it from sight only.
 *
 * The mechanism is the standard clip pattern, which Tailwind ships as `sr-only`: a 1px
 * box, clipped to nothing, `overflow: hidden`, `white-space: nowrap`, margin `-1px`. Not
 * `text-indent`, which reverses in RTL; not `width: 0`, which some screen readers skip;
 * not `opacity: 0`, which still occupies its full box and still takes clicks. And never
 * `position: absolute; left: -9999px`, which forces a horizontal scroll region in RTL
 * writing modes.
 *
 * WHAT IT IS FOR, AND WHAT IT IS NOT. It is for text that would be redundant on screen and
 * is essential without it: a `<caption>` on a table whose page heading already names it
 * (§13.1), the extra words that make an icon button's name specific, a "n of m" counter
 * read alongside a visible one. §7.7 draws the line the other way for form groups — a
 * `<fieldset>` with a real question keeps a VISIBLE `<legend>`, because sighted users need
 * the question too. Hiding a label is not the same as not needing one.
 *
 * `focusable` is the skip-link case (RC-032). Content that is hidden until something inside
 * it takes focus must not be hidden from the keyboard while it is hidden from the eye, so
 * the reveal is driven by `:focus-within`, which matches both the element itself when it is
 * focusable and any descendant of it — one variant covering the anchor-is-the-element case
 * and the wrapper-around-a-control case without a second class to keep in step.
 *
 * Revealing restores `position: static`, so a revealed element takes part in layout and
 * will push the page down unless the caller positions it. That is the caller's decision,
 * not this component's: a skip link pins itself to the top-left with its own classes, an
 * inline hint may well want to push. Nothing is positioned here that a caller would have to
 * undo.
 */
export type VisuallyHiddenElement = 'span' | 'div' | 'p' | 'li' | 'legend' | 'caption' | 'dt' | 'dd'

export interface VisuallyHiddenProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * The element to render. It matters: a table caption must be a `<caption>` and a group
   * label a `<legend>` for the semantics to survive being hidden.
   */
  as?: VisuallyHiddenElement
  /** Reveals the content while it, or anything inside it, holds focus. */
  focusable?: boolean
}

export const VisuallyHidden = React.forwardRef<HTMLElement, VisuallyHiddenProps>(
  function VisuallyHidden({ as = 'span', focusable = false, className, children, ...rest }, ref) {
    const Tag = asTag(as)
    return (
      <Tag
        ref={ref}
        className={cn('sr-only', focusable && 'focus-within:not-sr-only', className)}
        {...rest}
      >
        {children}
      </Tag>
    )
  },
)
