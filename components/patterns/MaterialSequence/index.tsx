'use client'

import * as React from 'react'

import { Stack } from '@/components/primitives/Stack'
import { useReducedMotion } from '@/components/primitives/motion/useReducedMotion'

/**
 * MaterialSequence (RC-215) — the material story's stages, with the one in view brought forward.
 *
 * IT OBSERVES SCROLL AND NEVER CAPTURES IT. No `scrollTo`, no wheel handler, no pinned section, no
 * scroll-jacking of any kind: the visitor scrolls the page exactly as they would with this island
 * absent, and all this does is notice which stage is passing the middle of the viewport. A pinned
 * sequence traps keyboard users — Tab moves focus to something the page then refuses to scroll to —
 * which is why Phase 11 lists that as a risk and this as its mitigation.
 *
 * THE STAGES ARE SERVER-RENDERED AND PASSED IN AS `children`. This component adds an attribute and
 * removes it; it never renders a stage, never fetches, and never decides what a stage contains. So
 * with JavaScript off, with hydration slow, or under reduced motion, the page shows the SAME four
 * stages with the SAME four pictures — a different layout, not a degraded one. That is the exact
 * distinction FEAT §4 draws, and building the stages inside a client component instead would have
 * meant a `<video>`-shaped hole for everybody who does not run it.
 *
 * ABSENCE OF `data-active` IS THE STATIC BRANCH, and the direction of that default is the whole
 * design. The server renders no attribute at all; the section's own styling dims a stage only on
 * `data-[active=false]`, which matches nothing until this island starts writing it. So the
 * unenhanced page is fully legible with every stage at full strength, and there is no frame in
 * which content is hidden waiting for JavaScript that may never arrive.
 *
 * UNDER REDUCED MOTION IT DOES NOT RUN AT ALL. The effect returns early, the attribute is never
 * written, and the cleanup removes any that a preference change left behind — so a visitor who
 * turns reduced motion ON mid-session gets the static composition immediately rather than four
 * stages frozen at whatever opacity they happened to have.
 *
 * ONE OBSERVER, NOT ONE PER STAGE. `IntersectionObserver` takes many targets, and the rootMargin
 * below narrows the viewport to a band across its middle: a stage is "active" while it crosses
 * that band. A threshold-based version — "active when 60% visible" — behaves differently on a
 * phone and a desktop for the same content, because the fraction is of the ELEMENT, not the
 * screen.
 */

/**
 * The middle band of the viewport, as a rootMargin.
 *
 * -45% top and bottom leaves a 10%-tall strip across the centre. Wide enough that there is almost
 * always exactly one stage in it, narrow enough that the change happens as a stage arrives rather
 * than long before.
 */
const CENTRE_BAND = '-45% 0px -45% 0px'

/** The attribute the section's styling reads. `false` dims; absent renders at full strength. */
const ACTIVE = 'active'

export type MaterialSequenceProps = {
  /** The `<li>` stages, rendered by the server. */
  readonly children: React.ReactNode
  readonly className?: string
}

export function MaterialSequence({
  children,
  className,
}: MaterialSequenceProps): React.ReactElement {
  const listRef = React.useRef<HTMLElement | null>(null)
  const reducedMotion = useReducedMotion()

  React.useEffect(() => {
    const list = listRef.current
    if (list === null) return
    const stages = Array.from(list.querySelectorAll<HTMLElement>('[data-entry-key]'))
    if (stages.length === 0) return

    /** Puts every stage back to the static branch — no attribute, full strength. */
    const clear = () => {
      for (const stage of stages) delete stage.dataset[ACTIVE]
    }

    if (reducedMotion) {
      clear()
      return
    }

    if (typeof IntersectionObserver !== 'function') return

    // Dim first, then let the observer promote whatever is already in the band. Doing it the other
    // way round — promote first — leaves every stage at full strength until the first scroll, so
    // the effect appears to be broken for anyone who lands mid-page.
    for (const stage of stages) stage.dataset[ACTIVE] = 'false'

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const stage = entry.target
          if (stage instanceof HTMLElement) {
            stage.dataset[ACTIVE] = entry.isIntersecting ? 'true' : 'false'
          }
        }
      },
      { rootMargin: CENTRE_BAND, threshold: 0 },
    )

    for (const stage of stages) observer.observe(stage)

    return () => {
      observer.disconnect()
      clear()
    }
  }, [reducedMotion])

  return (
    <Stack as="ol" gap={6} ref={listRef} className={className}>
      {children}
    </Stack>
  )
}
