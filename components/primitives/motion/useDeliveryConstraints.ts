'use client'

import * as React from 'react'

/**
 * The two capability gates DESIGN_SYSTEM §4.3 puts alongside the motion preference:
 * `navigator.connection.saveData === true` and `deviceMemory < 4`.
 *
 * WHY THEY LIVE NEXT TO `useReducedMotion` AND NOT IN A "CAPABILITIES" MODULE. §4.3 groups them
 * for a reason its own wording gives — "a preference is not the only reason to hold back". They
 * are read at exactly the same decision points, by exactly the same components, to make exactly
 * the same call: mount this heavy thing, or render the still. Splitting them across two modules
 * would let one gate be consulted and the other forgotten.
 *
 * SAME MECHANISM AS `useReducedMotion`, WITH AN EMPTY SUBSCRIBE. `useSyncExternalStore` is the
 * right tool even though there is nothing to subscribe to, because the hard part here is not
 * change notification — it is the SSR boundary. React uses `getServerSnapshot` for the server
 * render and for hydration, then switches to `getSnapshot`, which is precisely the sequence this
 * needs. The first version of this file used `useState` plus an effect and was wrong twice over:
 * it tripped `react-hooks/set-state-in-effect`, and it cost every visitor a second render.
 *
 * The subscribe function returns a no-op teardown and never calls back. That is honest rather than
 * lazy: `saveData` and `deviceMemory` have no change event. A Data Saver toggle is read at
 * navigation, and a device does not grow memory mid-session. `prefers-reduced-motion` genuinely
 * does change under the visitor, which is why THAT hook subscribes and this one does not.
 *
 * THE SERVER SNAPSHOT IS THE PERMISSIVE ANSWER. The server was sent neither value and cannot
 * invent one. Being wrong in the permissive direction for the hydration frame costs a poster
 * swap; being wrong the other way would hold media back from every visitor whose hydration is
 * slow, which is the group least able to afford a second decision.
 *
 * BOTH ARE NON-STANDARD APIs, and `deviceMemory` in particular ships only on Chromium. A browser
 * that does not report is treated as unconstrained, which is the only honest reading: absence of
 * a signal is not evidence of a limitation.
 */

export type DeliveryConstraints = {
  /** The visitor has asked their browser to reduce data use. */
  readonly saveData: boolean
  /** The device reports under 4 GB of RAM. False where the browser does not report at all. */
  readonly lowMemory: boolean
}

const UNCONSTRAINED: DeliveryConstraints = { saveData: false, lowMemory: false }

/**
 * `useSyncExternalStore` compares snapshots with `Object.is`, so `getSnapshot` MUST return the
 * same reference until something actually changes. Returning a fresh object each call is an
 * infinite render loop, not a subtle inefficiency.
 */
let cached: DeliveryConstraints = UNCONSTRAINED

/** Neither API is in `lib.dom`, so the shapes are declared here rather than asserted away. */
type NetworkInformationLike = { saveData?: boolean }
type NavigatorWithHints = Navigator & {
  connection?: NetworkInformationLike
  deviceMemory?: number
}

function read(): DeliveryConstraints {
  if (typeof navigator === 'undefined') return UNCONSTRAINED
  const nav = navigator as NavigatorWithHints

  return {
    saveData: nav.connection?.saveData === true,
    // `< 4` and not `<= 4`: §4.3 says "deviceMemory < 4", and a 4 GB device is on the permitted
    // side of that line. `typeof` rather than a truthiness check, because 0 is a value a spoofed
    // or privacy-hardened browser can report and it must not read as "not reported".
    lowMemory: typeof nav.deviceMemory === 'number' && nav.deviceMemory < 4,
  }
}

function subscribe(): () => void {
  // Nothing to listen to. See the header: neither API has a change event.
  return () => {}
}

function getSnapshot(): DeliveryConstraints {
  const next = read()
  if (next.saveData !== cached.saveData || next.lowMemory !== cached.lowMemory) {
    cached = next
  }
  return cached
}

function getServerSnapshot(): DeliveryConstraints {
  return UNCONSTRAINED
}

/**
 * The delivery constraints for this visitor.
 *
 * Returns `{ saveData: false, lowMemory: false }` on the server and during hydration, then the
 * real values. Consumers branch on them exactly as they branch on `useReducedMotion()` — see
 * `MediaVideo`, where any one of the three being true means no `<video>` element mounts.
 */
export function useDeliveryConstraints(): DeliveryConstraints {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
