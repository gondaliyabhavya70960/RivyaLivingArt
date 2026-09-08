'use client'

import * as React from 'react'

import { cn } from '@/lib/ui/cn'

/**
 * The Collection trigger and its panel — the only interactive part of the header.
 *
 * IT HOLDS NO DATA AND FETCHES NONE. The panel's contents arrive as `children`, already rendered
 * on the server by `SiteHeader`, which is what lets the category cards use `MediaImage` (a Server
 * Component) inside a panel whose open/closed state is client state. The alternative — a client
 * component that fetched the menu — is the header waterfall this phase's risk table names first,
 * and `tests/e2e/navigation-a11y.spec.ts` asserts no network request is made when the panel opens.
 *
 * THE TRIGGER IS A BUTTON, NOT A LINK, and the parent's own destination lives inside the panel.
 * A control that both navigates and expands has no correct keyboard behaviour: `Enter` must either
 * follow the link or open the panel, and whichever is chosen, half the visitors get the other one.
 * `aria-expanded` also means nothing on a link. So the button opens, and `/collection` is the
 * panel's first link — reachable by keyboard, by touch and by mouse, in one predictable place.
 *
 * THE KEYBOARD MODEL, in full, because it is the part that is easy to half-implement:
 *
 *   Tab          reaches the trigger, then traverses the panel in DOM order when it is open
 *   Enter/Space  toggles (native button behaviour — not re-implemented)
 *   ArrowDown    opens and moves focus to the first link in the panel
 *   Escape       closes and RESTORES FOCUS TO THE TRIGGER, from anywhere inside the panel
 *   Tab past end moves focus out of the panel, which closes it — no focus trap
 *
 * NO FOCUS TRAP, DELIBERATELY. A mega menu is not a dialog: trapping focus in a navigation panel
 * strands a keyboard user who wanted to carry on to the next header item. `Drawer` traps focus
 * because a modal drawer is modal; this is not.
 */

/** Desktop pointer only. A touch device reports `hover: none`, and a hover-open menu there fires
 *  on the tap that was meant to activate the trigger, opening and closing in one gesture. */
const FINE_POINTER = '(hover: hover) and (pointer: fine)'

/** DESIGN_SYSTEM §4: long enough that crossing the trigger on the way somewhere else does not
 *  open it, short enough that a deliberate hover feels immediate. */
const HOVER_INTENT_MS = 120

export type MegaMenuProps = {
  /** The trigger's visible text — the `navigation_items` label, never a literal. */
  readonly label: string
  /** Names the panel for assistive technology. Falls back to the trigger when absent. */
  readonly panelLabel: string | null
  /** Server-rendered panel contents. */
  readonly children: React.ReactNode
  readonly className?: string
}

export function MegaMenu({
  label,
  panelLabel,
  children,
  className,
}: MegaMenuProps): React.ReactElement {
  const [open, setOpen] = React.useState(false)
  /**
   * Set when the panel was opened by ArrowDown, so focus moves into it once it exists.
   *
   * A REF AND NOT STATE. Nothing renders from it, and as state it would have to be cleared from
   * inside the effect that consumes it — a `setState` in an effect body, which cascades a second
   * render for a value no one displays. `react-hooks/set-state-in-effect` fails the build on it,
   * correctly.
   */
  const focusOnOpen = React.useRef(false)

  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const panelRef = React.useRef<HTMLElement>(null)
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const hoverTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const panelId = React.useId()

  const clearHover = React.useCallback(() => {
    if (hoverTimer.current !== null) {
      clearTimeout(hoverTimer.current)
      hoverTimer.current = null
    }
  }, [])

  const close = React.useCallback(
    (restoreFocus: boolean) => {
      clearHover()
      focusOnOpen.current = false
      setOpen(false)
      if (restoreFocus) triggerRef.current?.focus()
    },
    [clearHover],
  )

  const focusFirstInPanel = React.useCallback(() => {
    panelRef.current?.querySelector<HTMLElement>('a[href], button:not([disabled])')?.focus()
  }, [])

  // Focus the first link once the panel has rendered. Doing this in the ArrowDown handler alone
  // would run before the panel exists on the very first open, and focus would silently stay put.
  React.useEffect(() => {
    if (!open || !focusOnOpen.current) return
    focusOnOpen.current = false
    focusFirstInPanel()
  }, [open, focusFirstInPanel])

  // A click anywhere else closes the panel. `pointerdown` rather than `click`, so the panel is
  // already gone by the time the click lands on whatever is underneath it.
  React.useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      const target = event.target
      if (target instanceof Node && wrapperRef.current?.contains(target) === true) return
      focusOnOpen.current = false
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  React.useEffect(() => clearHover, [clearHover])

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      // `true`: Escape is the one exit where focus must come back to the trigger, or a keyboard
      // user is dropped at the top of the document and has to Tab from the beginning again.
      close(true)
    }
  }

  function onTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowDown') return
    event.preventDefault()
    // Already open: the panel is in the DOM, so move focus now. The effect below only fires on the
    // false -> true transition and would not run for a second ArrowDown.
    if (open) {
      focusFirstInPanel()
      return
    }
    focusOnOpen.current = true
    setOpen(true)
  }

  /**
   * Focus leaving the whole component closes it, without restoring focus — the visitor is already
   * somewhere else and pulling them back would be a trap of a different kind. `relatedTarget` is
   * null when focus leaves the document entirely (a devtools panel, another window), which must
   * NOT close the menu: a visitor who alt-tabs away and back expects it as they left it.
   */
  function onBlur(event: React.FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget
    if (next === null) return
    if (next instanceof Node && event.currentTarget.contains(next)) return
    focusOnOpen.current = false
    setOpen(false)
  }

  function onPointerEnter(event: React.PointerEvent<HTMLDivElement>) {
    // `pointerenter` fires for touch too. The media query is the desktop test; the pointer type
    // check stops a stylus or a hybrid device from opening the menu on contact.
    if (event.pointerType !== 'mouse') return
    if (!window.matchMedia(FINE_POINTER).matches) return
    clearHover()
    hoverTimer.current = setTimeout(() => setOpen(true), HOVER_INTENT_MS)
  }

  function onPointerLeave() {
    clearHover()
    focusOnOpen.current = false
    setOpen(false)
  }

  return (
    <div
      ref={wrapperRef}
      className={cn('relative', className)}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          'inline-flex items-center gap-1 py-2 text-sm tracking-technical uppercase',
          'text-ink-secondary hover:text-ink focus-visible:text-ink',
          'transition-[color] duration-(--rv-duration-fast) ease-standard',
          open && 'text-ink',
        )}
      >
        {label}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
          className={cn(
            'size-4 transition-transform duration-(--rv-duration-fast) ease-standard',
            open && 'rotate-180',
          )}
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/*
       * `hidden` rather than unmounting: the panel's server-rendered contents — including the
       * category images — are then present in the first HTML response and in the accessibility
       * tree's document order, so opening the menu costs no request and no layout pass. `hidden`
       * removes it from the tab order and from assistive technology for free.
       */}
      <nav
        ref={panelRef}
        id={panelId}
        hidden={!open}
        // A <nav> rather than a div, because `aria-label` names a LANDMARK and does nothing at all
        // on a plain div — the panel would have been "labelled" in source and anonymous in a
        // screen reader. Nesting it inside the header's own <nav> is valid and is what gives the
        // category list a name of its own.
        aria-label={panelLabel ?? label}
        className={cn(
          'absolute left-0 top-full z-20 mt-2 w-max max-w-full',
          'border border-line bg-surface-raised shadow-2 rounded-sm p-6',
        )}
      >
        {children}
      </nav>
    </div>
  )
}
