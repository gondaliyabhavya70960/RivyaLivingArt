import * as React from 'react'
import { cn } from '@/lib/ui/cn'
import { asTag } from '@/lib/ui/polymorphic'

/**
 * Eyebrow is the `eyebrow` type role (§3.5): MONO family, uppercase, --rv-tracking-eyebrow
 * (0.14em), at text-2xs or text-xs.
 *
 * THE FAMILY CHANGED FROM BODY TO MONO IN A46, and it is the detail that does the most work for
 * the least ink. The reference sets every one of these — thirteen on its homepage alone — in
 * JetBrains Mono via a single `.u-micro` class at 11px/0.14em, and the effect is that the small
 * technical line above each oversized serif heading reads as a different KIND of text rather than
 * as a smaller version of the same text. Inter uppercase at 12px beside Instrument Serif at 103px
 * is just quiet; a mono at the same size is a caption on a plate. Tabular figures come with it,
 * which matters because several eyebrows are numbers ("01 · the pour").
 *
 * `font-medium` GOES WITH IT. JetBrains Mono is loaded at 400 only (see app/layout.tsx on why the
 * third family is budgeted rather than free), so asking for 500 would have the browser synthesise
 * one — the same fake-weight problem `HeadingHighlight` has with the display face. Mono letterforms
 * are already wide and even, so the uppercase line holds without extra weight.
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
      className={cn('font-mono uppercase tracking-eyebrow', SIZE[size], TONE[tone], className)}
      {...rest}
    >
      {children}
    </Component>
  )
})
