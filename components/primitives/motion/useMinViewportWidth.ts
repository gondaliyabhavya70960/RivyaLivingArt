'use client'

import * as React from 'react'

/**
 * `true` when the viewport is at least `minWidth` CSS pixels across.
 *
 * WHY THIS IS A HOOK AND NOT A CSS MEDIA QUERY. Everywhere that a breakpoint decides how something
 * LOOKS, CSS is the right tool and this hook is the wrong one — `AspectBox` switches its ratio with
 * `md:aspect-*` and touches no JavaScript. This exists for the cases where a breakpoint decides
 * whether an element EXISTS: `MediaVideo` must not mount a `<video>` below 768px (RC-233's mobile
 * behaviour, CLOUDINARY.md §6), and CSS cannot un-mount an element — `display: none` on a `<video>`
 * still costs the element, the decoder and the fetch.
 *
 * REACTIVE, UNLIKE `useDeliveryConstraints`. A viewport genuinely changes under the visitor —
 * rotating a phone, dragging a window — and `matchMedia` reports it. That is why this subscribes
 * and the Data Saver hook does not.
 *
 * SSR SAFETY: the server snapshot is `false`, which is the CONSERVATIVE answer here rather than
 * the permissive one. `false` means "assume narrow", so the first paint is the poster and the
 * video mounts after hydration if the viewport turns out to be wide. The other default would mount
 * a video on every phone for the length of one hydration and then remove it — a fetch started and
 * abandoned, on the connection least able to afford it.
 *
 * No component calls `matchMedia` itself (DESIGN_SYSTEM §4.3's rule for `useReducedMotion`, and
 * the same reasoning): a second reader is a second answer, and the two drift the moment one of
 * them forgets to unsubscribe.
 */

/** `matchMedia` is absent during SSR and in a bare test environment. */
function query(minWidth: number): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(`(min-width: ${minWidth}px)`)
}

export function useMinViewportWidth(minWidth: number): boolean {
  // Rebuilt only when the threshold changes, so the subscription is not torn down every render.
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      const list = query(minWidth)
      if (list === null) return () => {}
      list.addEventListener('change', onStoreChange)
      return () => list.removeEventListener('change', onStoreChange)
    },
    [minWidth],
  )

  const getSnapshot = React.useCallback(() => query(minWidth)?.matches ?? false, [minWidth])

  return React.useSyncExternalStore(subscribe, getSnapshot, () => false)
}
