'use client'

import * as React from 'react'

/**
 * FocusTrap keeps Tab inside its subtree while it is active, and puts focus back where it
 * came from when it goes away (registry RC-031). `Dialog` (RC-201) and `Drawer` (RC-202)
 * both name it in their contracts — "focus moved in on open, trapped by RC-031, restored to
 * the trigger on close" — which is why the contract here is written down in this much
 * detail: two components depend on the exact behaviour, and a third and fourth (Lightbox
 * §10.3, fullscreen 3D §14) will.
 *
 * It is a client component because it listens for keys and moves focus. It is one of the
 * few things in `components/primitives/**` that has to be.
 *
 * WHAT IT DOES NOT DO, DELIBERATELY. No scrim, no `inert` on the rest of the page, no body
 * scroll lock, no `Escape` handling, no `role="dialog"`. §11 requires all of those of a
 * modal surface, and all of them belong to the surface: `Escape` closes a dialog but moves
 * a lightbox to its close button, and only the component that owns the open state can know
 * which. Trapping is the one piece that is identical everywhere, so it is the one piece
 * that lives here. A mega menu and a dropdown menu use none of this — §8.2 and §11 both say
 * so in as many words: "a mega menu is not a dialog; trapping focus in it is a defect".
 *
 * THE CYCLE. Tab from the last tabbable goes to the first, Shift+Tab from the first goes to
 * the last, in DOM order. Positive `tabindex` values are not honoured, because they are a
 * defect anywhere in this system — a control that needs to come earlier moves earlier in the
 * DOM. Anything focusable only programmatically (`tabindex="-1"`), disabled, `hidden`,
 * `aria-hidden` or inside an `inert` subtree is skipped, which is the same set the browser
 * itself skips.
 *
 * THE EMPTY CASE, WHICH IS THE ONE THAT BITES. A trap can legitimately contain nothing
 * tabbable: a confirm dialog rendered a frame before its buttons, a drawer whose content is
 * still loading, an alert that is only text. The naive implementation indexes into an empty
 * array and throws, or silently lets Tab walk out into the page behind. This one swallows
 * the key and holds focus on the container, which is why the container always carries
 * `tabIndex={-1}` — a focus target that costs nothing and is never in the tab order.
 *
 * RESTORING. The element that had focus when the trap became active is captured and
 * refocused on the way out, so a dialog opened from a table row's action button returns the
 * keyboard to that row rather than to the top of the document. `returnFocusTo` overrides it
 * for the case where the triggering element is gone by then — a row that was just deleted —
 * and `restoreFocus={false}` is for the caller that will place focus itself. A capture that
 * has since left the document is not refocused: `focus()` on a detached node silently does
 * nothing in a browser, and moving focus to `<body>` is worse than leaving it alone.
 *
 * EFFECT ORDER IS LOAD-BEARING. The stray-focus guard is declared BEFORE the focus/restore
 * effect so that on unmount React runs the guard's cleanup first. React tears down effects
 * in declaration order while the host nodes are still in the document, so a guard that was
 * still listening would see the restore focus the trigger — an element outside the container
 * — and drag focus straight back into the subtree that is being removed.
 */

/**
 * Everything the browser puts in the tab order, before filtering. `[tabindex]` catches
 * both the deliberately-focusable div and the `tabindex="-1"` one that isTabbable then
 * removes; `input[type="hidden"]` is excluded here because it is not a control at all.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  'iframe',
  'object',
  'embed',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(',')

function isTabbable(element: HTMLElement): boolean {
  if (element.hasAttribute('disabled')) return false
  if (element.hasAttribute('hidden')) return false
  if (element.getAttribute('aria-hidden') === 'true') return false
  if (element.closest('[inert]') !== null) return false
  const tabindex = element.getAttribute('tabindex')
  if (tabindex !== null && Number.parseInt(tabindex, 10) < 0) return false
  return true
}

/**
 * Geometry is deliberately not consulted. `offsetParent`, `getClientRects()` and
 * `getComputedStyle` all report an unlaid-out document in jsdom, so a visibility filter
 * built on them would report every control in every unit test as untabbable — a trap that
 * passes its tests by doing nothing. The attribute filters above are what actually removes
 * a hidden control, and they work in both environments.
 */
function tabbablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isTabbable)
}

export interface FocusTrapProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Trapping is on. Turn it off rather than unmounting when the surface stays in the DOM —
   * focus is restored on the way to `false` exactly as it is on unmount.
   */
  active?: boolean
  /**
   * Where focus lands when the trap activates. Defaults to the first tabbable, then to the
   * container itself. §11 wants a dialog's first control or its heading; a ConfirmDialog
   * wants the cancel button, and passes it here.
   */
  initialFocus?: React.RefObject<HTMLElement | null>
  /** Where focus returns. Defaults to whatever had it when the trap activated. */
  returnFocusTo?: React.RefObject<HTMLElement | null>
  /** Leaves focus where it is on the way out, for a caller that will place it itself. */
  restoreFocus?: boolean
}

export const FocusTrap = React.forwardRef<HTMLDivElement, FocusTrapProps>(function FocusTrap(
  {
    active = true,
    initialFocus,
    returnFocusTo,
    restoreFocus = true,
    className,
    children,
    onKeyDown,
    ...rest
  },
  ref,
) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  // One node, two consumers: this component needs the element to search and focus, and the
  // caller still gets the ref it passed, because a dialog measures and animates this box.
  const setContainer = React.useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    [ref],
  )

  // Declared first on purpose — see EFFECT ORDER above.
  React.useEffect(() => {
    if (!active) return

    function handleFocusIn(event: FocusEvent) {
      const container = containerRef.current
      if (container === null) return
      const target = event.target
      if (target instanceof Node && container.contains(target)) return
      // Focus reached something outside without passing through the key handler — a
      // programmatic focus() elsewhere, or a click on the page behind. Pull it back.
      const [first] = tabbablesIn(container)
      ;(first ?? container).focus()
    }

    document.addEventListener('focusin', handleFocusIn)
    return () => document.removeEventListener('focusin', handleFocusIn)
  }, [active])

  React.useEffect(() => {
    if (!active) return

    const previouslyFocused = document.activeElement
    const container = containerRef.current
    if (container !== null) {
      const [first] = tabbablesIn(container)
      ;(initialFocus?.current ?? first ?? container).focus()
    }

    // Resolved on the way IN, not on the way out. react-hooks warns — correctly, in
    // general — that a ref read inside a cleanup has probably changed by then. Here that
    // is the reason to read it now: the override exists for the case where the element
    // focus should return to is about to disappear (the row a ConfirmDialog just deleted),
    // so the node is captured while it is still mounted and `isConnected` below decides
    // whether it can still take focus.
    const explicitReturn = returnFocusTo?.current ?? null

    return () => {
      if (!restoreFocus) return
      const target = explicitReturn ?? previouslyFocused
      // A trigger that was removed while the surface was open cannot take focus back, and
      // focusing <body> instead would drop the keyboard user at the top of the document.
      if (target instanceof HTMLElement && target.isConnected) target.focus()
    }
    // Both ref props are stable identities, so listing them costs nothing and keeps the
    // dependency array honest rather than silenced.
  }, [active, restoreFocus, initialFocus, returnFocusTo])

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event)
    if (!active || event.key !== 'Tab' || event.defaultPrevented) return

    const container = containerRef.current
    if (container === null) return

    const tabbables = tabbablesIn(container)
    const first = tabbables[0]
    const last = tabbables[tabbables.length - 1]

    if (first === undefined || last === undefined) {
      // Nothing to move to. Swallow the key so the page behind does not receive focus.
      event.preventDefault()
      container.focus()
      return
    }

    const current = document.activeElement
    const atEdge = event.shiftKey ? current === first : current === last
    // Focus sitting on the container itself is the post-empty case: content arrived after
    // the trap opened, and the next Tab should enter it rather than leave.
    if (atEdge || current === container || !container.contains(current)) {
      event.preventDefault()
      ;(event.shiftKey ? last : first).focus()
    }
  }

  return (
    <div
      ref={setContainer}
      // Focusable programmatically, never in the tab order: the holding place for focus
      // when the trap has nothing tabbable in it yet.
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      // No classes of its own: a trap is a behaviour, and the surface it wraps — a dialog
      // panel, a drawer, a fullscreen viewer — owns every pixel of the box.
      className={className}
      {...rest}
    >
      {children}
    </div>
  )
})
