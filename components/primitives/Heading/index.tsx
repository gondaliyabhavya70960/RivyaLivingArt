import * as React from 'react'
import { cn } from '@/lib/ui/cn'

/**
 * Heading renders h1-h6. The DOM LEVEL and the visual SIZE are separate props, and that
 * separation is the entire reason this component exists (DESIGN_SYSTEM §3.5): a page needs
 * one h1 and an unbroken outline whatever the type looks like. A section that must be an
 * h2 but should read at hero scale passes `level={2} size="display-2xl"`; it does not
 * reach for a second h1, and it does not demote the outline to get smaller type.
 *
 * §3.5 spells the visual prop `role`. It is `size` here because `role` is a real DOM
 * attribute carried by React.HTMLAttributes — shadowing it would stop a consumer passing
 * an ARIA role through ...rest, which is a worse trade than a renamed prop.
 *
 * Level 1-6 covers the outline; the display scale covers the look. Neither constrains the
 * other, so every combination is legal and none of them is a mistake the types can catch.
 */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export type HeadingSize =
  'display-2xl' | 'display-xl' | 'display-lg' | 'display-md' | 'display-sm' | 'display-xs'

/**
 * Size, leading and tracking travel together (§3.2, §3.4): display-2xl/xl take
 * --rv-leading-display and --rv-tracking-display, lg/md take the heading pair, and
 * sm/xs carry no tracking at all so they inherit --rv-tracking-body (0) from base.css
 * rather than re-declaring a zero.
 */
const SIZE: Record<HeadingSize, string> = {
  'display-2xl': 'text-display-2xl leading-display tracking-display',
  'display-xl': 'text-display-xl leading-display tracking-display',
  'display-lg': 'text-display-lg leading-heading tracking-heading',
  'display-md': 'text-display-md leading-heading tracking-heading',
  'display-sm': 'text-display-sm leading-heading',
  'display-xs': 'text-display-xs leading-heading',
}

/**
 * The default is the §3.5 role a level usually plays, so the common case is one prop.
 * `hero` (display-2xl) is deliberately never a default: §3.5 reserves it for the h1 on
 * `/` and `/large-format`, and an opt-in is how it stays reserved.
 */
const SIZE_FOR_LEVEL: Record<HeadingLevel, HeadingSize> = {
  1: 'display-xl', // page
  2: 'display-lg', // section
  3: 'display-md', // subsection
  4: 'display-sm',
  5: 'display-xs',
  6: 'display-xs', // card
}

export type HeadingHighlightProps = React.HTMLAttributes<HTMLSpanElement>

/**
 * The `heading_highlight` run (§3.5). A <span> inside the heading — never a second
 * heading element, because the outline must not gain a level to gain an accent.
 *
 * The accent is not the only thing marking it, because colour alone would fail WCAG 1.4.1.
 * It used to be a 500 weight against the display face's 400; since the face became Instrument
 * Serif (amendment A46) there IS no 500 — the family ships one weight — and `font-medium` would
 * have asked the browser to synthesise one, which at display sizes is a visibly smeared stroke
 * rather than a heavier cut. Instrument Serif does ship a true italic, so the run is marked by a
 * real change of cut instead of a fake change of weight. The distinction survives at 103px,
 * which the synthesised weight did not.
 *
 * The colour itself is whatever --rv-ink-accent already resolves to; inside a
 * --rv-surface-raised-2 element on a DEEP section the scheme has already stepped that up
 * for contrast (§2.6, §2.11) and this component must not override it.
 *
 * Exported so a highlight can sit mid-sentence, which the `highlight` prop cannot express.
 */
export const HeadingHighlight = React.forwardRef<HTMLSpanElement, HeadingHighlightProps>(
  function HeadingHighlight({ className, children, ...rest }, ref) {
    return (
      <span ref={ref} className={cn('text-ink-accent italic', className)} {...rest}>
        {children}
      </span>
    )
  },
)

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** The DOM level, from the block's own declaration. Required — there is no sane default. */
  level: HeadingLevel
  /** The display step. Defaults to the §3.5 role this level usually plays. */
  size?: HeadingSize
  /**
   * The `page_sections.heading_highlight` column, appended after the heading text inside
   * the same element so it lands in the accessible name. For a highlight that belongs in
   * the middle of a sentence, compose <HeadingHighlight> into `children` instead.
   */
  highlight?: React.ReactNode
}

export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(function Heading(
  { level, size, highlight, className, children, ...rest },
  ref,
) {
  const Tag: `h${HeadingLevel}` = `h${level}`

  return (
    <Tag
      ref={ref}
      className={cn(
        // --rv-weight-display is 400: the brand voice is calm, and a 700-weight serif
        // is not (§3.4). Explicit rather than inherited so a UA bold never leaks in.
        'font-display font-normal text-ink',
        SIZE[size ?? SIZE_FOR_LEVEL[level]],
        className,
      )}
      {...rest}
    >
      {children}
      {highlight ? (
        <>
          {/* Load-bearing space: without it the name computes as "SculptedLiving Art". */}{' '}
          <HeadingHighlight>{highlight}</HeadingHighlight>
        </>
      ) : null}
    </Tag>
  )
})
