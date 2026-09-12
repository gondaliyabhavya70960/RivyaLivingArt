import dynamic from 'next/dynamic'
import * as React from 'react'

import { interpolate } from '@/lib/cms/strings'

/**
 * LOADED ON DEMAND, AND THAT IS A BUDGET DECISION RATHER THAN A STYLE ONE — the same one
 * `ProcessStepsSection` makes for `ChapterMedia`. `components/sections/registry.ts` imports every
 * renderer, so a static import of a Client Component here would put the arrows in the initial
 * JavaScript of all sixteen CMS routes, including every route that renders no carousel at all.
 * `ssr` is left alone: a Server Component may not pass `ssr: false`, and it does not need to —
 * the arrows are an enhancement over a row that already scrolls.
 */
const CarouselControls = dynamic(() =>
  import('./Controls').then((module) => module.CarouselControls),
)

/**
 * ContentCarousel — RC-222, DESIGN_SYSTEM §7.18.
 *
 * A SCROLLABLE LIST, NOT A TRANSFORM TRACK, and every other decision follows from that one. The
 * items are an ordinary `<ul>` in an ordinary overflow container: the DOM is complete, so a crawler
 * reads all eight cards rather than the one on screen, a printer prints them, find-in-page finds
 * them, and a reader who has turned JavaScript off scrolls the row with a finger or a trackpad
 * exactly as they would any other scrollable thing. A transform track shows one slide and hides the
 * rest behind a state nobody outside the page can see.
 *
 * THE SCROLLER IS A SERVER COMPONENT AND THE CONTROLS ARE NOT. `components/sections/registry.ts`
 * imports every renderer, so a Client Component imported statically by any of them is an island on
 * all sixteen CMS routes — which is how this project's budget went to seven before Phase 45 took it
 * to five. The arrows are `next/dynamic`, so a route whose blocks never ask for them ships nothing.
 *
 * CONTROLS ARE PROGRESSIVE ENHANCEMENT, WHICH MEANS THE ROW WORKS WITHOUT THEM. Below 768px there
 * are no arrows at all (§7.18: "no arrows below 768px") because a thumb is a better control than a
 * 44px button, and above it they are a convenience over a row that already scrolls. Nothing here
 * depends on their having loaded.
 *
 * KEYBOARD MOVEMENT IS THE PLATFORM'S, NOT OURS. A focusable overflow container scrolls on arrow
 * keys, Home and End natively, so `tabIndex={0}` on the scroller is the whole implementation and
 * there is no key handler to get wrong. Each card's own link stays separately tabbable, which is
 * what §7.18 asks for and what a hand-rolled roving-tabindex implementation usually breaks.
 *
 * ONE AND A PEEK. `scroll-padding-inline-start` plus a basis under 100% leaves the next card's edge
 * showing, so the row says it continues rather than looking like a single centred card. §7.18 names
 * this for mobile; it is right at every width, and a row with fewer items than fit simply fills.
 *
 * AUTO-ADVANCE IS NOT IMPLEMENTED AND IS NOT AN OMISSION. §7.18 says it is off by default and that
 * a block enabling it must pause on hover, focus and `document.hidden`, expose a pause control
 * first, and never run under reduced motion. No block enables it, so the correct amount of code for
 * it is none: a movement nobody asked for that steals the row out from under a reader mid-sentence
 * is the WCAG 2.2.2 failure the clause exists to prevent, and the way to never ship it is to never
 * write it.
 *
 * EVERY WORD IS A PROP. `aria-roledescription` and the per-item position are read aloud, so they
 * come from `global_content` like every other string a visitor meets — `scripts/cms/check-section-copy.ts`
 * lists `aria-roledescription` among the props it refuses a literal in, which is the rule working.
 */

export type ContentCarouselProps = {
  /** One element per item. Each keeps its own link, its own focus and its own tab stop. */
  readonly items: readonly React.ReactNode[]
  /** `UI_LABEL.carousel.roledescription`. Null renders a plain group, never an invented word. */
  readonly roleDescription: string | null
  /** `UI_LABEL.carousel.item_position`, carrying `{{index}}` and `{{total}}`. */
  readonly itemPosition: string | null
  /** The group's accessible name — the section's own heading, so a reader knows which row this is. */
  readonly label: string | null
  /** `ACTION_LABEL.carousel.previous` / `.next`. Both must resolve or no arrows are rendered. */
  readonly previousLabel: string | null
  readonly nextLabel: string | null
  /**
   * `snap` adds the arrows and scroll-snap; `free` is the same row without either.
   *
   * TWO NAMES FOR ONE COMPONENT RATHER THAN TWO COMPONENTS. The catalogue declares `carousel` on
   * three blocks and `strip` on three others, and they differ in exactly this: whether the row
   * clicks into position and offers buttons, or simply scrolls. Building them separately would be
   * two implementations of one scroll container, disagreeing the first time one gained a fix.
   */
  readonly mode?: 'snap' | 'free'
}

export function ContentCarousel({
  items,
  roleDescription,
  itemPosition,
  label,
  previousLabel,
  nextLabel,
  mode = 'snap',
}: ContentCarouselProps): React.ReactElement | null {
  if (items.length === 0) return null

  const snap = mode === 'snap'
  const total = String(items.length)

  return (
    <div
      className="relative"
      role="group"
      {...(roleDescription === null ? {} : { 'aria-roledescription': roleDescription })}
      {...(label === null ? {} : { 'aria-label': label })}
      data-carousel={mode}
    >
      <ul
        // `tabIndex` on the scroller is what gives the platform's own arrow-key movement. The
        // negative margin and matching padding let a card's focus ring breathe without the row
        // appearing inset from the container it sits in.
        tabIndex={0}
        data-carousel-scroller=""
        className={[
          'flex list-none gap-6 overflow-x-auto',
          '-mx-4 scroll-px-4 px-4 py-2',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--rv-ink-accent)',
          snap ? 'snap-x snap-mandatory' : '',
          // Firefox and Safari keep a visible bar on a mouse-driven row; the row is the affordance.
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {items.map((item, index) => (
          <li
            key={index}
            data-carousel-item=""
            {...(itemPosition === null
              ? {}
              : {
                  'aria-label': interpolate(itemPosition, {
                    index: String(index + 1),
                    total,
                  }),
                })}
            className={[
              'shrink-0 basis-[78%] sm:basis-[46%] lg:basis-[31%]',
              snap ? 'snap-start' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {item}
          </li>
        ))}
      </ul>

      {snap && previousLabel !== null && nextLabel !== null ? (
        <CarouselControls previousLabel={previousLabel} nextLabel={nextLabel} />
      ) : null}
    </div>
  )
}
