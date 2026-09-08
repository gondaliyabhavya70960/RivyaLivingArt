import * as React from 'react'
import { cn } from '@/lib/ui/cn'
import { asTag } from '@/lib/ui/polymorphic'

/**
 * Surface renders one of the four elevation levels of DESIGN_SYSTEM §6.2. It takes a
 * level and never asks which scheme it is in — that is the whole point of the ladder.
 *
 * §6.2 says elevation is expressed differently on the two grounds: on DEEP and INK a
 * drop shadow is invisible, so elevation is a LIFTED SURFACE plus a line; on BONE it is
 * a shadow. Both arrive through the same class list because `--rv-elevation-1|2|3` is
 * declared per scheme in scheme.css — `none` on DEEP and INK, a real shadow on BONE —
 * and `shadow-1|2|3` in the Tailwind bridge resolves to it. So `shadow-2` paints nothing
 * on a deep ground and paints the §6.2 BONE treatment on a light one, from one string.
 *
 * The line has no equivalent per-scheme switch in the token layer, so it is drawn at
 * every level above 0 in every scheme. On DEEP and INK §6.2 requires it. On BONE it is a
 * hairline in `--rv-line-strong` (neutral-400), a measured §2.7 boundary at 3.10-3.61:1
 * on every bone surface, so it is permitted rather than merely harmless.
 *
 * LEVEL 2 AND 3 CARRY `rv-surface-raised-2`, AND THAT IS LOAD-BEARING. The automatic ink
 * step-ups of §2.11 are declared as `.rv-scheme-deep .rv-surface-raised-2` and
 * `.rv-scheme-ink .rv-surface-raised-2`: on the second raised surface `--rv-ink-tertiary`
 * steps from neutral-300 up to neutral-200, and on DEEP `--rv-ink-accent` steps from
 * champagne up to gold-bright (4.24 UI -> 5.35 AA on ocean-raised-2). Nothing computes
 * those; they are inherited by every descendant of the element carrying the class. Paint
 * the raised-2 background without the class and every nested caption, metadata line and
 * inline TextLink silently renders below AA, with no error anywhere. So the background
 * and the marker class are never separated.
 *
 * On BONE the raised-2 background reads one ramp step deeper than §6.2's BONE column
 * (bone-sunken rather than bone-raised, both from §2.3) because there is one background
 * token per level and DEEP/INK need the lifted one. Every ink pairing on bone-sunken is
 * measured AA in §2.7 (obsidian 16.91, neutral-700 10.35, neutral-600 7.13,
 * champagne-deep 4.54), so the swap costs no contrast.
 *
 * A level-3 surface is a dialog or a drawer, which §6.2 also places over a scrim. The
 * scrim is BEHIND the surface, not part of it: it belongs to the overlay that positions
 * this element, and Surface never renders one.
 */
export type SurfaceLevel = 0 | 1 | 2 | 3
export type SurfaceRadius = 'none' | 'sm' | 'md' | 'lg'

/** Kept to elements that are a box. A surface is never an interactive element. */
export type SurfaceElement =
  'div' | 'section' | 'article' | 'aside' | 'header' | 'footer' | 'figure' | 'li'

const LEVEL: Record<SurfaceLevel, string> = {
  0: 'bg-surface',
  1: 'bg-surface-raised border border-line shadow-1',
  2: 'bg-surface-raised-2 rv-surface-raised-2 border border-line-strong shadow-2',
  3: 'bg-surface-raised-2 rv-surface-raised-2 border border-line-strong shadow-3',
}

const RADIUS: Record<SurfaceRadius, string> = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
}

/**
 * §6.1 maps radius to what a thing IS, and §6.2's levels name the same things: level 1 is
 * cards and panels and level 2 popovers, both `--rv-radius-md`; level 3 is dialogs and
 * drawers, `--rv-radius-lg`. Level 0 is flat content and media, and media is square —
 * "a rounded photograph of a resin table reads as a web widget". The one case the two
 * tables disagree on is the mega-menu panel, level 2 in §6.2 and radius-lg in §6.1; it
 * passes `radius="lg"` rather than bending the default for everything else.
 */
const DEFAULT_RADIUS: Record<SurfaceLevel, SurfaceRadius> = {
  0: 'none',
  1: 'md',
  2: 'md',
  3: 'lg',
}

export interface SurfaceProps extends React.HTMLAttributes<HTMLElement> {
  /** The box element. A surface with meaning of its own says so — `article`, `aside`. */
  as?: SurfaceElement
  /** §6.2 elevation level. 0 is flat content on the ground. */
  level?: SurfaceLevel
  /** Overrides the radius §6.1 derives from the level. `none` for a media frame. */
  radius?: SurfaceRadius
}

export const Surface = React.forwardRef<HTMLElement, SurfaceProps>(function Surface(
  { as = 'div', level = 0, radius, className, children, ...rest },
  ref,
) {
  const Tag = asTag(as)
  return (
    <Tag
      ref={ref}
      className={cn(LEVEL[level], RADIUS[radius ?? DEFAULT_RADIUS[level]], className)}
      {...rest}
    >
      {children}
    </Tag>
  )
})
