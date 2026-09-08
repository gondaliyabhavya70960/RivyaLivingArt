import * as React from 'react'
import { cn } from '@/lib/ui/cn'
import { asTag } from '@/lib/ui/polymorphic'

/**
 * Section is a band: the vertical rhythm of DESIGN_SYSTEM §5.1 plus, optionally, the
 * colour scheme of §2.4. It sets no width — that is Container, composed inside it — and
 * it renders no copy, because every string a visitor reads arrives from `page_sections`.
 *
 * SCHEME. §2.4: "A section sets its own class on its outermost element", and switching is
 * a class change only — it never re-mounts and never animates. The class redeclares the
 * semantic tokens (scheme.css) and nothing else, so the section must also PAINT its
 * ground and re-declare its ink, and this is not optional:
 *
 *   `color` inherits as a computed colour, not as the `var()` that produced it. A BONE
 *   band inside a DEEP page would redeclare `--rv-ink-primary` to obsidian and still
 *   inherit the bone colour computed further up the tree — obsidian ground tokens under
 *   near-white text. `bg-surface text-ink` re-resolves both against the scheme in force
 *   at this element, so the band is correct in whichever scheme it declares or inherits.
 *
 * Both are applied whether or not `scheme` is passed: with no scheme the section paints
 * the ground it already sits on, which is a no-op, and one code path is worth more than
 * a saved declaration.
 *
 * SPACING. §5.1's four fluid section-rhythm tokens, applied as `padding-block`. They have
 * no `@theme` bridge (they are clamps, not spacing steps) and `py-[...]` is an arbitrary
 * value check-tokens.mjs rejects, so the token is referenced directly in `style` — see
 * Container for the same reasoning about `--rv-gutter`.
 *
 * §5.1 also says two adjacent sections collapse to the LARGER of their two paddings
 * rather than summing. Padding does not collapse and margin does, but a margin would
 * leave an unpainted strip between two bands of different schemes — the visible seam
 * §2.4 calls a rendering fault. Padding is therefore correct here and adjacency is the
 * composing page's business: it knows which two bands meet and picks the pair of
 * spacings, exactly as it already picks which schemes may sit next to each other.
 */
export type SectionSpacing = 'sm' | 'md' | 'lg' | 'xl'

/** The three permitted values of `page_sections.theme` (§2.4), spelled as the column is. */
export type SectionScheme = 'DEEP' | 'INK' | 'BONE'

export type SectionElement = 'section' | 'div' | 'article' | 'aside' | 'header' | 'footer'

const SPACING: Record<SectionSpacing, string> = {
  sm: 'var(--rv-section-y-sm)',
  md: 'var(--rv-section-y-md)',
  lg: 'var(--rv-section-y-lg)',
  xl: 'var(--rv-section-y-xl)',
}

const SCHEME: Record<SectionScheme, string> = {
  DEEP: 'rv-scheme-deep',
  INK: 'rv-scheme-ink',
  BONE: 'rv-scheme-bone',
}

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  as?: SectionElement
  /** §5.1 vertical rhythm. Defaults to `lg`, as §5.1 states. */
  spacing?: SectionSpacing
  /** §2.4 colour scheme. Omitted, the band inherits the scheme of its shell. */
  scheme?: SectionScheme
}

export const Section = React.forwardRef<HTMLElement, SectionProps>(function Section(
  { as = 'section', spacing = 'lg', scheme, className, style, children, ...rest },
  ref,
) {
  const Tag = asTag(as)
  return (
    <Tag
      ref={ref}
      className={cn('bg-surface text-ink', scheme && SCHEME[scheme], className)}
      style={{ paddingBlock: SPACING[spacing], ...style }}
      {...rest}
    >
      {children}
    </Tag>
  )
})
