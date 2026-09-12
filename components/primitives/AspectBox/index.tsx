import * as React from 'react'
import { cn } from '@/lib/ui/cn'
import { asTag } from '@/lib/ui/polymorphic'

/**
 * AspectBox reserves a box at one of the eight ratios D6 fixes (DESIGN_SYSTEM §5.5:
 * 21:9 · 16:9 · 4:3 · 3:2 · 1:1 · 4:5 · 3:4 · 9:16) BEFORE anything inside it loads.
 *
 * WHY IT EXISTS AT ALL. The CLS budget is 0.05 and §3.1 already spends part of it on the
 * font swap; images may not spend the rest. A media slot whose height is decided by the
 * asset moves every word below it the moment the asset arrives — and moves them again,
 * differently, when the asset 404s. Reserving from the CMS ratio makes the three outcomes
 * (loaded, slow, failed) identical in layout, which is also what lets MediaFrame render
 * the SEED §47 fallback without the page reflowing around it.
 *
 * TWO RATIOS, BECAUSE EVERY CMS MEDIA SLOT IS A PAIR. D6 stores desktop and mobile as
 * separate slots, and §5.5's default table pairs them per slot type — a page hero is 21:9
 * on desktop and 9:16 or 4:5 on a phone, a section band is 16:9 / 4:5. So the ratio is two
 * props, not one: `ratio` is the desktop box and `mobileRatio` the phone box. Three of the
 * eight slot types in §5.5 (portfolio, journal, material macro) pair a ratio with itself,
 * which is why `mobileRatio` defaults to `ratio` rather than being required.
 *
 * The switch is the bridge's `md` breakpoint — 48rem/768px, §5.2's `--rv-bp-md` — which is
 * the same width §10.1 has `<picture>` swap the asset at, so the box and the source it
 * holds change together. Mobile-first, so the bare class is the phone ratio and `md:`
 * raises it; no `max-width` query appears anywhere (§5.2).
 *
 * WHY TAILWIND CLASSES AND NOT INLINE STYLE. §5.5 names `--rv-ratio-21x9 … --rv-ratio-9x16`,
 * but those tokens are not in `app/styles/tokens.css`, and the token layer is not this
 * component's to extend. `aspect-<ratio>` is a first-class Tailwind 4 utility with a bare
 * value, so `aspect-4/5` and `md:aspect-21/9` compile to real CSS, are visible to
 * check-utilities.mjs, and are not the bracketed arbitrary values check-tokens.mjs rejects.
 * Two ratios also need a media query, which an inline style cannot express.
 *
 * It clips. `overflow-hidden` is what makes the reservation a boundary as well as a size —
 * it is what §9's card hover (media scaling to `--rv-motion-scale-in`) scales behind. One
 * consequence to design around rather than discover: a focus ring sits 2px OUTSIDE its
 * control (§2.10), so interactive content placed flush against the frame edge will have
 * its ring clipped. Inset it, or put it outside the box.
 */
export type AspectRatio = '21:9' | '16:9' | '4:3' | '3:2' | '1:1' | '4:5' | '3:4' | '9:16'

/** Boxes only. An aspect box is a container, never a control. */
export type AspectBoxElement = 'div' | 'figure' | 'li' | 'section' | 'article'

/** Below `md`. Every entry is a literal string so Tailwind's scanner can see it. */
const MOBILE_RATIO: Record<AspectRatio, string> = {
  '21:9': 'aspect-21/9',
  '16:9': 'aspect-16/9',
  '4:3': 'aspect-4/3',
  '3:2': 'aspect-3/2',
  '1:1': 'aspect-1/1',
  '4:5': 'aspect-4/5',
  '3:4': 'aspect-3/4',
  '9:16': 'aspect-9/16',
}

/** From `md` (768px) up. */
const DESKTOP_RATIO: Record<AspectRatio, string> = {
  '21:9': 'md:aspect-21/9',
  '16:9': 'md:aspect-16/9',
  '4:3': 'md:aspect-4/3',
  '3:2': 'md:aspect-3/2',
  '1:1': 'md:aspect-1/1',
  '4:5': 'md:aspect-4/5',
  '3:4': 'md:aspect-3/4',
  '9:16': 'md:aspect-9/16',
}

export interface AspectBoxProps extends React.HTMLAttributes<HTMLElement> {
  /** The box element. `figure` where the media has a real `figcaption` beside it. */
  as?: AspectBoxElement
  /** The desktop ratio (§5.5), applied from 768px up. */
  ratio: AspectRatio
  /** The mobile ratio (§5.5), applied below 768px. Defaults to `ratio`. */
  mobileRatio?: AspectRatio
  /**
   * A floor on the rendered height, as a raw token value — `var(--rv-hero-min-h)`.
   *
   * WHY A VALUE AND NOT A CLASS. The floor is viewport-relative (`svh`), and Tailwind has no
   * scale for that: `min-h-[76svh]` is an arbitrary value, which `scripts/design/check-tokens.mjs`
   * refuses outright, and inventing a `min-h-hero` utility would put a layout decision in the
   * theme bridge where no other section measurement lives. `Section` already sets its vertical
   * rhythm and `Container` its maxima this way, from the raw token, for the same reason.
   *
   * IT IS A FLOOR, SO THE RATIO STILL GOVERNS. The box renders at whichever is taller, and both
   * are known before the image loads — so this reserves space exactly as the ratio alone did and
   * shifts nothing.
   */
  minBlockSize?: string
}

export const AspectBox = React.forwardRef<HTMLElement, AspectBoxProps>(function AspectBox(
  { as = 'div', ratio, mobileRatio, minBlockSize, className, style, children, ...rest },
  ref,
) {
  const Tag = asTag(as)
  return (
    <Tag
      ref={ref}
      className={cn(
        'relative block w-full overflow-hidden',
        MOBILE_RATIO[mobileRatio ?? ratio],
        // Emitted unconditionally: when the pair is identical the md: rule restates the
        // base one, which costs nothing and leaves no branch here to get wrong.
        DESKTOP_RATIO[ratio],
        className,
      )}
      style={minBlockSize === undefined ? style : { minBlockSize, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  )
})
