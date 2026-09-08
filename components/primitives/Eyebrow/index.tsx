import * as React from 'react'
import { cn } from '@/lib/ui/cn'
import { asTag } from '@/lib/ui/polymorphic'

/**
 * Eyebrow is the `eyebrow` type role (§3.5): body family, uppercase, weight 500,
 * --rv-tracking-eyebrow (0.14em), at text-2xs or text-xs.
 *
 * IT IS NOT A HEADING. It renders a <p> — never an h1-h6 — because the line above a
 * section title is a label for that title, not a level in the document outline. Rendering
 * it as an h3 above an h2 is how a page ends up with an outline no screen-reader user can
 * navigate, and the temptation is real because it sits where a kicker heading would.
 * <Heading> exists for the thing that is actually a heading.
 *
 * THE CAPS ARE CSS. The string arrives sentence-case from `page_sections.eyebrow` and is
 * transformed by `text-transform`, so the accessible name stays the words the editor typed.
 * A string typed in capitals reaches assistive tech as capitals, and some screen readers
 * spell those out letter by letter. The tracking is the other half of the role: 0.14em is
 * what keeps uppercase letterforms apart, and it is the reason §3.3 lets the 11px floor
 * exist at all.
 */
export type EyebrowSize = '2xs' | 'xs'
export type EyebrowTone = 'tertiary' | 'secondary' | 'accent'

/** A label, an inline label, or a label that is a grid child. Never a heading element. */
export type EyebrowElement = 'p' | 'span' | 'div'

const SIZE: Record<EyebrowSize, string> = {
  '2xs': 'text-2xs leading-(--rv-leading-2xs)',
  xs: 'text-xs leading-(--rv-leading-xs)',
}

const TONE: Record<EyebrowTone, string> = {
  tertiary: 'text-ink-tertiary',
  secondary: 'text-ink-secondary',
  accent: 'text-ink-accent',
}

export interface EyebrowProps extends React.HTMLAttributes<HTMLElement> {
  /** The element to render. Defaults to a paragraph; use `span` inside a card's flow. */
  as?: EyebrowElement
  size?: EyebrowSize
  tone?: EyebrowTone
}

export const Eyebrow = React.forwardRef<HTMLElement, EyebrowProps>(function Eyebrow(
  { as = 'p', size = 'xs', tone = 'tertiary', className, children, ...rest },
  ref,
) {
  // Closed union in the public type; widened here so one JSX call site serves all three.
  const Component = asTag(as)

  return (
    <Component
      ref={ref}
      className={cn(
        'font-sans font-medium uppercase tracking-eyebrow',
        SIZE[size],
        TONE[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  )
})
