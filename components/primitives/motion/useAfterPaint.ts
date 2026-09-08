'use client'

import * as React from 'react'

/**
 * `false` until the browser has painted, then `true` — the gate that keeps a decorative layer out
 * of the first frame.
 *
 * WHAT IT IS FOR. Phase 11's performance budget requires the hero's LCP element to be the still
 * image, and a `<video>` rendered in the same commit competes with it for the connection at
 * exactly the wrong moment. Mounting after paint is not a nicety here: the video is decoration and
 * the still is the page, so the still must be allowed to finish first.
 *
 * TWO ANIMATION FRAMES, NOT ONE, AND NOT A TIMEOUT. A callback scheduled with one
 * `requestAnimationFrame` runs BEFORE the paint it was scheduled against; the second frame is the
 * first moment at which the previous paint has actually happened. A `setTimeout` would be a guess
 * about how long a device takes, and the slower the device the worse the guess — it would mount
 * the video soonest, relative to the paint, on exactly the hardware least able to afford it.
 *
 * SAME `useSyncExternalStore` SHAPE AS ITS THREE NEIGHBOURS, and for the same reason
 * `useDeliveryConstraints` gives: the hard part is the SSR boundary, not change notification.
 * React takes `getServerSnapshot` for the server render AND for hydration, then switches — so the
 * server HTML and the first client render agree on `false`, and nothing is torn.
 *
 * `useState` PLUS AN EFFECT IS THE OBVIOUS VERSION AND IS WRONG TWICE. It trips
 * `react-hooks/set-state-in-effect`, which this repository has already been bitten by once
 * (`MegaMenu`, Phase 10), and it makes every consumer pay a second render whether or not anything
 * is going to mount.
 *
 * THE FLAG IS MODULE-LEVEL, which is deliberate: "this document has painted" is a fact about the
 * page, not about a component, and a second hero on the same page should not wait for its own two
 * frames. It is never reset — a paint that happened cannot unhappen, and a client-side navigation
 * within the same document is not a new first paint.
 */

let painted = false

function subscribe(onStoreChange: () => void): () => void {
  if (painted) return () => {}
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return () => {}
  }

  let second = 0
  const first = window.requestAnimationFrame(() => {
    second = window.requestAnimationFrame(() => {
      painted = true
      onStoreChange()
    })
  })

  return () => {
    window.cancelAnimationFrame(first)
    if (second !== 0) window.cancelAnimationFrame(second)
  }
}

function getSnapshot(): boolean {
  return painted
}

function getServerSnapshot(): boolean {
  return false
}

/**
 * True once the first paint is behind us.
 *
 * A consumer branches on it exactly as it branches on `useReducedMotion()`: `false` means render
 * nothing heavy yet, never "render a placeholder for the heavy thing".
 */
export function useAfterPaint(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
