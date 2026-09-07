'use client'

import * as React from 'react'
import { cn } from '@/lib/ui/cn'
import { useReducedMotion } from '@/components/primitives/motion/useReducedMotion'

/**
 * DropdownMenu — the APG menu-button pattern (DESIGN_SYSTEM §11, registry RC-231). A real
 * `Button` or `IconButton` carrying `aria-haspopup="menu"`, over a `role="menu"` of
 * `role="menuitem"` children with a roving tabindex.
 *
 * WHY IT IS IN PHASE 02 AT ALL. §11 says it plainly: Phase 05's Studio top bar needs a
 * user menu, and Phase 05 runs before Phase 10 builds the public chrome. Deferring this
 * would mean the Studio inventing a second one, and two menus is how two keyboard models
 * get shipped.
 *
 * A MENU OF LINKS IS A MENU ONLY IF IT BEHAVES LIKE ONE. `role="menu"` is a promise about
 * keyboard behaviour — one tab stop for the whole set, arrows to move within it, `Escape`
 * to leave — and a screen reader announces it as an application menu on that basis. A
 * column of navigation links that a reader should be able to `Tab` through one by one is
 * NOT that, and dressing it in `role="menu"` takes away the very traversal the reader
 * expects. If the answer to "does `Tab` visit every item?" is yes, the honest markup is a
 * `<nav>` with a plain list of links and no roles at all. `href` exists on an item here
 * for the mixed case a real user menu has — "Account settings" beside "Sign out" — not as
 * permission to model site navigation as a menu.
 *
 * NO FOCUS TRAP, DELIBERATELY. §11 and §8.2 both say so in as many words: a menu is not a
 * dialog, and trapping focus in one is a defect. `Tab` closes the menu and continues
 * through the page from the trigger, exactly as APG describes; nothing here reaches for
 * `FocusTrap` (RC-031), which is for modal surfaces only.
 *
 * THE KEYBOARD MODEL, in full, because this phase is verified by hand:
 *
 *   Trigger    `Enter` / `Space` / click  open, focus the FIRST item
 *              `ArrowDown`                open, focus the FIRST item
 *              `ArrowUp`                  open, focus the LAST item (APG; the fast route
 *                                         to "Sign out" at the bottom of a user menu)
 *   Menu       `ArrowDown` / `ArrowUp`    move, wrapping at both ends
 *              `Home` / `End`             first / last
 *              `Enter` / `Space`          activate the focused item
 *              `Escape`                   close AND RESTORE FOCUS TO THE TRIGGER
 *              `Tab`                      close, focus the trigger, and let the browser
 *                                         carry on to whatever follows it
 *
 * `Enter` and `Space` on a `<button>` item are the element's own behaviour, so there is no
 * handler for them. An `<a href>` item is the exception the DOM makes: `Enter` follows the
 * link but `Space` scrolls the page, so `Space` is translated into a click for links only.
 *
 * TYPEAHEAD IS NOT IMPLEMENTED. APG lists it as optional, and a Studio menu of four to
 * eight items is reached faster by two arrow presses than by a buffered string match. It
 * is a addition this component can take later without changing anything above.
 *
 * DISABLED ITEMS STAY FOCUSABLE. `aria-disabled`, not the `disabled` attribute: a menu
 * item a reader cannot reach is a menu item they cannot find out about, and §12.1 makes
 * the same call for zero-result filter options — disabled, not hidden, so the shape of
 * what is on offer stays visible.
 *
 * CLOSING. `Escape` and `Tab` restore focus to the trigger. An outside pointer press
 * closes without moving focus, because the press is itself a focus decision the reader
 * just made. Activating an item closes it — which is also what covers a route change,
 * since the navigation that changes the route starts here.
 *
 * MOTION. FORM class (§4.2): opacity plus an 8px rise (`--rv-motion-rise-sm`, which
 * `translate-y-2` is on the 4px scale) over `--rv-duration-base` on `--rv-ease-out`. The
 * panel renders armed and settles in an effect, the same shape RC-207's `Reveal` uses.
 * Under reduced motion it renders SETTLED on the first commit with no transition declared
 * at all — a static branch, not a faster one, and specifically not one frame of a panel
 * held at `opacity: 0` in front of a reader who asked for less movement.
 *
 * BELOW 768px, RC-231 wants this to open as a bottom-anchored `Drawer` (RC-202) so the
 * items land in thumb reach. `Drawer` does not exist yet; the rows are ≥ 44px either way,
 * and the swap belongs in RC-231's record when RC-202 lands.
 */
export interface DropdownMenuItem {
  /** Stable and unique within the menu. */
  id: string
  /** The item's visible label, which is also its accessible name. */
  label: React.ReactNode
  /** Runs on activation. Called before the menu closes. */
  onSelect?: () => void
  /** Renders the item as an `<a role="menuitem">`. Read the note on menus of links first. */
  href?: string
  /** `aria-disabled`, not `disabled` — the item stays reachable. See the note above. */
  disabled?: boolean
  /**
   * Renders the item in `--rv-state-danger`. RC-231: a destructive item is never first in
   * the list, and never acts without an RC-309 confirmation — this component enforces the
   * first half in development and can enforce neither half at runtime.
   */
  destructive?: boolean
}

export type DropdownMenuAlign = 'start' | 'end'

/**
 * What gets cloned onto the trigger. Typed as the full button attribute set rather than a
 * hand-listed subset so that `<Button>` and `<IconButton>` — whose props extend exactly
 * this — are assignable without their aria attributes having to be re-narrowed here.
 */
type DropdownTriggerElement = React.ReactElement<React.ButtonHTMLAttributes<HTMLButtonElement>>

export interface DropdownMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The trigger element — a `Button` or an `IconButton` (RC-231), never a bare `<div>`.
   * It is cloned with the id, the `aria-haspopup`/`aria-expanded`/`aria-controls` wiring
   * and the two handlers, so it must spread its rest props onto its own DOM node. Every
   * primitive in this system does; `Field` (§7.4) takes its single control the same way
   * and for the same reason.
   */
  trigger: DropdownTriggerElement
  /** In menu order. Destructive items belong at the bottom (RC-231). */
  items: readonly DropdownMenuItem[]
  /** Which edge of the trigger the panel aligns to. `end` for a right-hand top bar. */
  align?: DropdownMenuAlign
  /** Controlled state. Omit for an uncontrolled menu seeded by `defaultOpen`. */
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export const DropdownMenu = React.forwardRef<HTMLDivElement, DropdownMenuProps>(
  function DropdownMenu(
    {
      trigger,
      items,
      align = 'start',
      open,
      defaultOpen = false,
      onOpenChange,
      className,
      ...rest
    },
    ref,
  ) {
    const baseId = React.useId()
    const menuId = `${baseId}-menu`
    // A trigger that arrived with an id keeps it — a form library or a test may already be
    // pointing at that id — and the generated one is used otherwise. Either way the id is
    // how focus finds its way back: the trigger is somebody else's element and may or may
    // not forward a ref, so an id we injected is the one handle guaranteed to work.
    const triggerId = trigger.props.id ?? `${baseId}-trigger`

    const rootRef = React.useRef<HTMLDivElement | null>(null)
    const itemNodes = React.useRef<Array<HTMLElement | null>>([])
    const reducedMotion = useReducedMotion()

    const [uncontrolled, setUncontrolled] = React.useState(defaultOpen)
    const [activeIndex, setActiveIndex] = React.useState(0)
    const [settled, setSettled] = React.useState(false)

    const isControlled = open !== undefined
    const isOpen = isControlled ? open : uncontrolled
    // `items` can change under an open menu. Clamping on read keeps the roving tabindex on
    // a real item rather than on an index that used to exist.
    const active = Math.min(activeIndex, Math.max(items.length - 1, 0))

    const setOpen = React.useCallback(
      (next: boolean) => {
        if (!isControlled) setUncontrolled(next)
        onOpenChange?.(next)
      },
      [isControlled, onOpenChange],
    )

    // One node, two consumers: this component needs the root to test outside presses, and
    // the caller still gets the ref it passed.
    const setRoot = React.useCallback(
      (node: HTMLDivElement | null) => {
        rootRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      },
      [ref],
    )

    // Focus follows the active index, on open and on every move. Doing it in one effect
    // rather than at each key means the keyboard handlers only ever set state, and the
    // one place that moves focus is the one place to look when focus goes wrong.
    React.useEffect(() => {
      if (!isOpen) return
      itemNodes.current[active]?.focus()
    }, [isOpen, active])

    // The armed → settled commit that makes the FORM transition run. Under reduced motion
    // the panel is rendered settled from the first commit instead (see the note above), so
    // this effect has nothing to do and declares no transition to suppress.
    React.useEffect(() => {
      setSettled(isOpen)
    }, [isOpen])

    React.useEffect(() => {
      if (!isOpen) return
      function handlePointerDown(event: PointerEvent) {
        const root = rootRef.current
        if (root && event.target instanceof Node && root.contains(event.target)) return
        // No focus restoration: the press is itself the reader's decision about where
        // focus should go, and dragging it back to the trigger would undo that.
        setOpen(false)
      }
      document.addEventListener('pointerdown', handlePointerDown)
      return () => document.removeEventListener('pointerdown', handlePointerDown)
    }, [isOpen, setOpen])

    function focusTrigger() {
      document.getElementById(triggerId)?.focus()
    }

    function openAt(index: number) {
      setActiveIndex(index)
      setOpen(true)
    }

    function closeMenu(restoreFocus: boolean) {
      setOpen(false)
      // Synchronously, inside the handler, so that a browser default still to come — the
      // rest of a Tab press — is computed from the trigger rather than from a menu item
      // that is about to be unmounted.
      if (restoreFocus) focusTrigger()
    }

    function handleTriggerClick(event: React.MouseEvent<HTMLButtonElement>) {
      trigger.props.onClick?.(event)
      if (event.defaultPrevented) return
      // Enter and Space arrive here as a click from the <button> itself, which is why
      // neither appears in the key handler below: handling them twice would toggle twice.
      if (isOpen) setOpen(false)
      else openAt(0)
    }

    function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
      trigger.props.onKeyDown?.(event)
      if (event.defaultPrevented) return
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        openAt(0)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        openAt(Math.max(items.length - 1, 0))
      }
    }

    function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
      const last = Math.max(items.length - 1, 0)
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setActiveIndex(active === last ? 0 : active + 1)
          break
        case 'ArrowUp':
          event.preventDefault()
          setActiveIndex(active === 0 ? last : active - 1)
          break
        case 'Home':
          event.preventDefault()
          setActiveIndex(0)
          break
        case 'End':
          event.preventDefault()
          setActiveIndex(last)
          break
        case 'Escape':
          event.preventDefault()
          closeMenu(true)
          break
        case 'Tab':
          // Not prevented: the menu closes, focus lands on the trigger, and the browser's
          // own Tab carries on from there to whatever follows it in the document.
          closeMenu(true)
          break
        default:
          break
      }
    }

    function activate(item: DropdownMenuItem, event: React.MouseEvent<HTMLElement>) {
      if (item.disabled === true) {
        // An <a> would otherwise navigate; aria-disabled alone stops nothing.
        event.preventDefault()
        return
      }
      item.onSelect?.()
      // A link takes focus with it as the browser navigates, so restoring focus to the
      // trigger would be a fight this component loses. An action has nowhere else to send
      // the keyboard, so it goes back where it came from.
      closeMenu(item.href === undefined)
    }

    // Development-only. RC-231 requires that a destructive item is never first: a menu
    // whose top item deletes something is one mis-aimed Enter away from a support ticket.
    if (process.env.NODE_ENV !== 'production') {
      if (items[0]?.destructive === true) {
        console.error(
          'DropdownMenu: a destructive item must never be first in the list (registry RC-231). ' +
            'Move it to the bottom, and confirm it in a ConfirmDialog rather than acting on the click.',
        )
      }
    }

    const clonedTrigger = React.cloneElement(trigger, {
      id: triggerId,
      'aria-haspopup': 'menu',
      'aria-expanded': isOpen,
      // Only while the menu exists: aria-controls pointing at an absent id is a dangling
      // reference, and this component unmounts the panel rather than hiding it.
      'aria-controls': isOpen ? menuId : undefined,
      onClick: handleTriggerClick,
      onKeyDown: handleTriggerKeyDown,
    })

    return (
      <div ref={setRoot} className={cn('relative inline-flex', className)} {...rest}>
        {clonedTrigger}

        {isOpen ? (
          <div
            role="menu"
            id={menuId}
            aria-labelledby={triggerId}
            onKeyDown={handleMenuKeyDown}
            // The z-index is the §5.6 token, in a style rather than a `z-[...]` utility:
            // the token gate rejects arbitrary values, and the scale it protects is the
            // one this layer belongs to.
            style={{ zIndex: 'var(--rv-z-dropdown)' }}
            className={cn(
              'absolute top-full mt-2 flex min-w-56 flex-col p-1',
              // Elevation 2 (§6.2). The shadow half resolves per scheme through
              // --rv-elevation-2 (none on DEEP/INK, shadow-2 on BONE); the surface half
              // has no token that does the same, so the DEEP/INK value is used on all
              // three. `rv-surface-raised-2` is what lets scheme.css step the nested ink
              // tokens up to their compliant values (§2.11) — it travels with the
              // background utility and is not decoration.
              'rv-surface-raised-2 rounded-md border border-line-strong bg-surface-raised-2 shadow-2',
              align === 'end' ? 'right-0' : 'left-0',
              // FORM (§4.2), and only when there is motion to run. Under reduced motion no
              // transition is declared at all: nothing to suppress, nothing to strand.
              // `translate` is its own property in Tailwind 4, not part of `transform`,
              // which is why it is named in the transition list rather than assumed.
              !reducedMotion &&
                'transition-[opacity,translate] duration-(--rv-duration-base) ease-out-expo',
              reducedMotion || settled ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
            )}
          >
            {items.map((item, index) => {
              const isActive = index === active
              const itemClassName = cn(
                // ≥ 44px rows either way (RC-231), and the row itself is the hit box.
                'flex min-h-11 items-center gap-3 rounded-sm px-4 py-2 text-left text-sm',
                'transition-[color,background-color] duration-(--rv-duration-fast) ease-standard',
                item.destructive === true ? 'text-state-danger' : 'text-ink',
                'hover:bg-surface-raised',
                // Never opacity: 0.5 — that drags the contrast below the §2.6 exemption.
                'aria-disabled:cursor-not-allowed aria-disabled:text-ink-disabled',
              )

              const shared = {
                ref: (node: HTMLElement | null) => {
                  itemNodes.current[index] = node
                },
                role: 'menuitem' as const,
                // The roving tabindex: one 0 in the menu, and it follows the arrow keys.
                tabIndex: isActive ? 0 : -1,
                'aria-disabled': item.disabled === true ? (true as const) : undefined,
                onClick: (event: React.MouseEvent<HTMLElement>) => activate(item, event),
                className,
              }

              return item.href === undefined ? (
                <button key={item.id} {...shared} type="button">
                  {item.label}
                </button>
              ) : (
                <a
                  key={item.id}
                  {...shared}
                  href={item.href}
                  // The DOM gives <a> Enter but not Space; APG's menuitem needs both.
                  onKeyDown={(event: React.KeyboardEvent<HTMLAnchorElement>) => {
                    if (event.key !== ' ') return
                    event.preventDefault()
                    event.currentTarget.click()
                  }}
                >
                  {item.label}
                </a>
              )
            })}
          </div>
        ) : null}
      </div>
    )
  },
)
