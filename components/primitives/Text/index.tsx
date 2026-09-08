import * as React from 'react'
import { cn } from '@/lib/ui/cn'
import { asTag } from '@/lib/ui/polymorphic'

/**
 * Text is the body scale (§3.3) plus a tone (§2.5) plus the element it should be. It is
 * presentational and holds no state, so it is a Server Component.
 *
 * THE 11px FLOOR IS TYPED, NOT DOCUMENTED. §3.3 permits --rv-text-2xs only for uppercase,
 * letter-spaced labels, "where the tracking is what keeps the letterforms apart — never
 * for sentence-case prose". A comment cannot enforce that, so it is a union: `size="2xs"`
 * is assignable only alongside `uppercase`, and `uppercase` is what applies
 * --rv-tracking-eyebrow. No combination of props produces 11px sentence case. The named
 * role for a 2xs label is <Eyebrow>; this guard is for callers who reach for the raw
 * scale anyway.
 *
 * WEIGHT is not set here. base.css resolves body copy to --rv-weight-body already, and
 * leaving font-weight unclaimed is what lets a caller add one through `className` without
 * two utilities fighting over the same declaration.
 *
 * MEASURE is not a prop. §3.4 names --rv-measure-narrow/prose/wide; tokens.css defines
 * none of them, so a max-width here would be a number invented at the component layer.
 * Line length stays the layout's job until those tokens exist.
 */
export type TextSize = 'xl' | 'lg' | 'md' | 'base' | 'sm' | 'xs' | '2xs'
export type TextTone = 'primary' | 'secondary' | 'tertiary'

/**
 * A closed set, not `keyof JSX.IntrinsicElements`: Text is prose, and prose is a
 * paragraph, a list item, a definition, a caption or a run inside one of those. A heading
 * is <Heading> — the level and the outline matter far too much to reach through here, and
 * <strong>/<em> are left out because their weight and slant are the content's meaning,
 * not a typographic size this component gets to set.
 */
export type TextElement = 'p' | 'span' | 'div' | 'li' | 'dd' | 'dt' | 'figcaption' | 'blockquote'

/**
 * Each step carries its own line height from §3.3. The --rv-leading-* companions exist in
 * tokens.css but are not bridged to a Tailwind name in globals.css, so they are read as
 * the tokens they are rather than rounded to the nearest bridged leading.
 */
const SIZE: Record<TextSize, string> = {
  xl: 'text-xl leading-(--rv-leading-xl)',
  lg: 'text-lg leading-(--rv-leading-lg)',
  md: 'text-md leading-(--rv-leading-md)',
  base: 'text-base leading-(--rv-leading-base)',
  sm: 'text-sm leading-(--rv-leading-sm)',
  xs: 'text-xs leading-(--rv-leading-xs)',
  '2xs': 'text-2xs leading-(--rv-leading-2xs)',
}

const TONE: Record<TextTone, string> = {
  primary: 'text-ink',
  secondary: 'text-ink-secondary',
  tertiary: 'text-ink-tertiary',
}

/**
 * The guard. Branch one is the whole readable scale, uppercase optional; branch two is the
 * 11px floor, which requires it. `size="2xs"` on its own satisfies neither branch.
 */
type TextSizing =
  { size?: Exclude<TextSize, '2xs'>; uppercase?: boolean } | { size: '2xs'; uppercase: true }

export type TextProps = React.HTMLAttributes<HTMLElement> & {
  /** The element to render. Defaults to a paragraph. */
  as?: TextElement
  tone?: TextTone
} & TextSizing

export const Text = React.forwardRef<HTMLElement, TextProps>(function Text(
  { as = 'p', size = 'base', tone = 'primary', uppercase = false, className, children, ...rest },
  ref,
) {
  // `as` is a closed union in the public type. It widens here only so the single JSX call
  // site does not have to satisfy eight different intrinsic prop types at once.
  const Component = asTag(as)

  return (
    <Component
      ref={ref}
      className={cn(
        // Explicit, not inherited: a Text inside a font-display card must still be body.
        'font-sans',
        SIZE[size],
        TONE[tone],
        // Uppercase is a CSS transform, never a typed-in shout — the string in the DOM
        // stays the string the CMS holds, so assistive tech is not handed an acronym.
        // The tracking is not decoration either; it is what makes caps legible (§3.4).
        uppercase && 'uppercase tracking-eyebrow',
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  )
})
