'use client'

import * as React from 'react'
import { asTag } from '@/lib/ui/polymorphic'
import { useReducedMotion } from './useReducedMotion'

/**
 * Reveal is the WOOD class of DESIGN_SYSTEM §4.2, and nothing else: opacity plus
 * `translateY` over `--rv-duration-slow` on `--rv-ease-out`, travelling
 * `--rv-motion-rise-md`, once per element per page view, driven by an
 * `IntersectionObserver`. No scale, no blur, no rotation, and no layout property — §4.2's
 * third cross-cutting rule permits compositor properties only.
 *
 * THE CONTRACT, WHICH IS NOT A DURATION (§4.3). Under `prefers-reduced-motion: reduce`
 * this renders the FINAL STATE: in position, fully opaque, with no transition declared
 * and no observer attached. It is not a faster animation. The failure this prevents is
 * specific and permanent — an element armed at `opacity: 0` whose transition is then
 * suppressed by the media query never arrives, and the visitor simply never sees the
 * content. base.css's reduced-motion block is the floor under that, not the mechanism;
 * the mechanism is the branch below.
 *
 * MOTION NEVER GATES CONTENT (§4.2). The server renders children in their final state —
 * a page with JavaScript disabled is complete — and arming happens in an effect,
 * afterwards. Three more conditions take the same static branch as reduced motion, and
 * for the same reason: no `IntersectionObserver`, a metered connection (`saveData`, per
 * RC-207), and an element already on screen when the effect runs. Hiding what the
 * browser has already painted is not an entrance, it is a flash.
 *
 * ONE OBSERVER PER PAGE, not one per element (RC-207's performance line). The observer
 * below is module-level, created on the first armed Reveal and released when the last
 * one settles or unmounts, so nothing outlives the page view.
 *
 * `as` exists because a staggered group is usually a list: a `<div>` between `<ul>` and
 * `<li>` is invalid markup, and this component must never be the reason for it. The tag
 * is routed through `asTag` for the reason §6.3 gives.
 */
export type RevealElement = 'div' | 'section' | 'article' | 'li' | 'figure'

export interface RevealProps extends React.HTMLAttributes<HTMLElement> {
  as?: RevealElement
  /**
   * Zero-based position in a group. Delays this item by `index` × `--rv-motion-stagger`,
   * capped at `--rv-motion-stagger-max`: item 7 onward shares item 6's delay.
   */
  index?: number
  children: React.ReactNode
}

/** Mirrors `--rv-motion-stagger-max` (§4.1). A CSS integer JS cannot read as a number. */
const STAGGER_MAX = 6

/**
 * ARRIVAL IS MEASURED AGAINST THE VIEWPORT, NEVER AGAINST THE ELEMENT. A negative bottom
 * root margin shrinks the observer's root by 12% of the viewport height, so an element
 * counts as arrived only once it has climbed clear of the fold by that much — the same
 * rule, and the same feel, for a 40px caption and a 6000px section.
 *
 * A `threshold` cannot express this, and reaching for one is the trap. `intersectionRatio`
 * is a fraction of the TARGET's area, so any ratio large enough to mean "properly in view"
 * is unreachable for an element taller than viewport ÷ ratio — 0.15 is already impossible
 * past ~5300px on a 1440×800 desktop, ordinary for `as="section"` — and that element would
 * sit armed at `opacity: 0` for the rest of the page view, which is exactly the permanent
 * failure the docblock above says this component exists to avoid. Hence `threshold: 0`
 * with the gate on `isIntersecting`: the root does the measuring, and height drops out.
 */
const ROOT_MARGIN = '0px 0px -12% 0px'

/**
 * Arming carries NO transition, so the hide is instantaneous: an element that faded out
 * before it faded in would be animating the very thing this class exists to avoid.
 * The transition is declared on the settled style instead — CSS Transitions starts a
 * transition from the after-change style, so declaring it alongside the final values is
 * what makes the reveal run, and the two commits are a frame apart in any case.
 */
const ARMED: React.CSSProperties = {
  opacity: 0,
  transform: 'translateY(var(--rv-motion-rise-md))',
}

const SETTLED: React.CSSProperties = {
  opacity: 1,
  transform: 'translateY(0)',
  transitionProperty: 'opacity, transform',
  transitionDuration: 'var(--rv-duration-slow)',
  transitionTimingFunction: 'var(--rv-ease-out)',
}

type RevealPhase = 'static' | 'armed' | 'settled'

/* -------------------------------------------------------------- the shared observer */

let observer: IntersectionObserver | null = null
const settlers = new Map<Element, () => void>()

function observeOnce(node: Element, settle: () => void): () => void {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const run = settlers.get(entry.target)
        // Release first: WOOD runs once, and a target released before its callback cannot
        // be settled twice by a second entry in the same batch.
        release(entry.target)
        run?.()
      }
    },
    { threshold: 0, rootMargin: ROOT_MARGIN },
  )
  settlers.set(node, settle)
  observer.observe(node)
  return () => release(node)
}

function release(node: Element): void {
  if (!observer) return
  observer.unobserve(node)
  settlers.delete(node)
  // Nothing left on the page is waiting. Drop the observer rather than leave a live one
  // bound to a document that has finished with it.
  if (settlers.size === 0) {
    observer.disconnect()
    observer = null
  }
}

/* ------------------------------------------------------------------- the other gates */

/**
 * §4.3's second suppression gate. A visitor on a metered connection has asked for less,
 * and a decorative entrance is the first thing that should give it up.
 * `connection` is not in the DOM lib because it is not on the standards track.
 */
function isDataSaving(): boolean {
  const { connection } = navigator as Navigator & { connection?: { saveData?: boolean } }
  return connection?.saveData === true
}

/** Already painted and readable: there is nothing left for an entrance to do. */
function isOnScreen(node: Element): boolean {
  const box = node.getBoundingClientRect()
  return box.bottom > 0 && box.top < window.innerHeight
}

/* ------------------------------------------------------------------------ component */

export const Reveal = React.forwardRef<HTMLElement, RevealProps>(function Reveal(
  { as = 'div', index = 0, style, children, ...rest },
  ref,
) {
  const reducedMotion = useReducedMotion()
  // 'static' on the server AND on the first client render, so the two agree and the
  // content is readable from first paint whatever happens next.
  const [phase, setPhase] = React.useState<RevealPhase>('static')
  const nodeRef = React.useRef<HTMLElement | null>(null)
  const hasSettled = React.useRef(false)

  const attachRef = React.useCallback(
    (node: HTMLElement | null) => {
      nodeRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    [ref],
  )

  React.useEffect(() => {
    // A preference can change mid-session, and whatever is in flight must land FINISHED.
    // An element left parked at opacity 0 because the media query cancelled its
    // transition is exactly the failure §4.3 exists to prevent.
    if (reducedMotion) {
      setPhase('static')
      return
    }
    // Once per element per page view (§4.2). Re-arming would hide content already read.
    if (hasSettled.current) return

    const node = nodeRef.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') return
    if (isDataSaving()) return
    if (isOnScreen(node)) return

    setPhase('armed')
    return observeOnce(node, () => {
      hasSettled.current = true
      setPhase('settled')
    })
  }, [reducedMotion])

  const step = Math.min(Math.max(Math.trunc(index), 0), STAGGER_MAX - 1)
  const Tag = asTag(as)

  return (
    <Tag
      ref={attachRef}
      // The static branch declares nothing of its own: no held-back opacity, no travel,
      // no transition. That is what makes it static rather than fast.
      style={
        phase === 'static'
          ? style
          : {
              ...style,
              ...(phase === 'armed' ? ARMED : SETTLED),
              ...(phase === 'settled' && step > 0
                ? { transitionDelay: `calc(var(--rv-motion-stagger) * ${step})` }
                : null),
            }
      }
      {...rest}
    >
      {children}
    </Tag>
  )
})
