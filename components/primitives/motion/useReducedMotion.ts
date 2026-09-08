'use client'

import * as React from 'react'

/**
 * The single source of the reduced-motion preference (DESIGN_SYSTEM §4.3, part 2).
 * One query, read through one subscription shape, by every component that animates.
 * No component calls `matchMedia` itself: a second reader is a second answer, and the
 * two drift the moment one of them forgets to unsubscribe.
 *
 * SSR SAFETY IS THE WHOLE DESIGN. `window` is never touched during render. The value
 * arrives through `useSyncExternalStore`, whose *server* snapshot is a constant — the
 * server was never sent a preference and cannot invent one, so it renders the same
 * markup for everybody and React reconciles to the real value straight after hydration.
 * Seeding state from `matchMedia` in a `useState` initialiser instead is the classic
 * version of this hook and it is wrong here: the first client render would disagree
 * with the server HTML for precisely the users least able to tolerate the repaint that
 * resolves it, and React 19 discards the server tree on that mismatch.
 *
 * `false` is also the right constant to be wrong with. It selects the *animated* branch,
 * and every animated branch in this system renders its content in the final position —
 * Reveal only arms an element after this hook has reported. A reduced-motion visitor
 * therefore never has content held back from them while the answer is in flight.
 *
 * The query is not cached in a module variable. `matchMedia` is cheap, and a cached
 * MediaQueryList would outlive the page view that created it, which is the kind of
 * module-level state that turns a preference change into a stale answer.
 */
const QUERY = '(prefers-reduced-motion: reduce)'

/** `null` where there is no `matchMedia`: during SSR, and in a bare test environment. */
function mediaQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(QUERY)
}

function subscribe(onStoreChange: () => void): () => void {
  const list = mediaQuery()
  if (!list) return () => {}
  list.addEventListener('change', onStoreChange)
  return () => list.removeEventListener('change', onStoreChange)
}

/** A boolean compares by value, which is what useSyncExternalStore's cache rule needs. */
function getSnapshot(): boolean {
  return mediaQuery()?.matches ?? false
}

function getServerSnapshot(): boolean {
  return false
}

/**
 * `true` when the visitor has asked their platform for reduced motion.
 *
 * Consumers must branch on it, not merely shorten a duration: §4.3 asks for the finished
 * composition, and an element whose transition is suppressed halfway is an element stuck
 * at `opacity: 0` forever.
 */
export function useReducedMotion(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
