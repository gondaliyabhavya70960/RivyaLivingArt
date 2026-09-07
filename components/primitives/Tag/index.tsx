import * as React from 'react'
import { cn } from '@/lib/ui/cn'
import { asTag } from '@/lib/ui/polymorphic'

/**
 * Tag is the neutral chip: a material name, a technique, a category on a card's meta row
 * (§9). A raised surface, a decorative hairline, --rv-ink-secondary, radius-pill,
 * text-xs (§3.3: "Badges, chips, table column heads").
 *
 * NEUTRAL IS THE POINT. Where Badge says what STATE a record is in, a Tag says what a
 * record IS, and a taxonomy that colour-codes itself is a taxonomy that has run out of
 * colours by its fifth term. There is deliberately no `tone` prop.
 *
 * IT IS NOT A CONTROL. No hover state, no press state, no hit box: §7's 44px minimum
 * governs things a finger lands on, and a chip that filters something is a filter chip
 * (§12.1) — a button with a pressed state — not this. Rendering a Tag inside a link is
 * fine; the link owns the affordance.
 *
 * `as="li"` exists so a row of chips can be a real list, which is how a screen reader
 * announces "3 items" instead of reading three words with nothing between them.
 */
export type TagElement = 'span' | 'li'

export interface TagProps extends React.HTMLAttributes<HTMLElement> {
  /** `li` inside a chip list, `span` inline. Defaults to `span`. */
  as?: TagElement
  /** The term. Required — an empty chip is a rectangle with no meaning. */
  children: React.ReactNode
}

export const Tag = React.forwardRef<HTMLElement, TagProps>(function Tag(
  { as = 'span', className, children, ...rest },
  ref,
) {
  const Component = asTag(as)

  return (
    <Component
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-pill border border-line bg-surface-raised-2 px-3 py-1',
        // ink-secondary on raised-2 is 5.92 in DEEP, 8.69 in INK, 10.35 in BONE (§2.6-§2.7).
        'text-xs leading-(--rv-leading-xs) text-ink-secondary',
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  )
})
