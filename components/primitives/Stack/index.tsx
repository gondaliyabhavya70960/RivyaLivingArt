import * as React from 'react'
import { cn } from '@/lib/ui/cn'
import { asTag } from '@/lib/ui/polymorphic'

/**
 * Stack is one axis of DESIGN_SYSTEM §5.1: children in a column, separated by one step of
 * the 4px scale. `gap` rather than margins on the children, so nothing collapses, nothing
 * needs a last-child exception, and the rhythm survives a child being conditionally
 * absent.
 *
 * `gap` is the token scale as a union, not a number and not a string: it is exactly the
 * steps `tokens.css` declares, §5.1 has no half-steps, and so a value off the scale is a
 * mistake the compiler catches rather than a rhythm nobody notices is wrong. Each step is
 * written out as a whole class name because Tailwind reads source text — a template
 * literal would compile to no CSS at all.
 *
 * LIST SEMANTICS, AND ONLY FOR `ul`. A `ul` here becomes a flex container, and Safari +
 * VoiceOver drop list semantics from a list whose markers are removed — which base.css
 * does for `ul[role='list']`. So an explicit `role="list"` is restored, exactly the
 * pattern that stylesheet is written against.
 *
 * An `ol` gets none. Its implicit role is already `list` — ARIA has no ordered-list role
 * — so the attribute buys assistive tech nothing, while it does match base.css's
 * `ol[role='list']` arm and silently strip the numbering. An `ol`'s children stay
 * `display: list-item` inside a flex container, so left alone the markers render and the
 * ordinal information the element exists to carry survives.
 *
 * A caller's own `role` still wins either way: `...rest` is spread after it, for the rare
 * list that is really a `menu` or a `tablist` — or the `ol` that wants no numbers.
 */
export type StackGap = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20

export type StackElement = 'div' | 'ul' | 'ol' | 'li' | 'section' | 'article' | 'nav'

const GAP: Record<StackGap, string> = {
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
const LIST_ELEMENTS = new Set<StackElement>(['ul'])

export interface StackProps extends React.HTMLAttributes<HTMLElement> {
  as?: StackElement
  /** A step on the §5.1 scale: `gap={4}` is 16px, `gap={6}` is 24px. */
  gap?: StackGap
}

export const Stack = React.forwardRef<HTMLElement, StackProps>(function Stack(
  { as = 'div', gap = 4, className, children, ...rest },
  ref,
) {
  const Tag = asTag(as)
  return (
    <Tag
      ref={ref}
      role={LIST_ELEMENTS.has(as) ? 'list' : undefined}
      className={cn('flex flex-col', GAP[gap], className)}
      {...rest}
    >
      {children}
    </Tag>
  )
})
