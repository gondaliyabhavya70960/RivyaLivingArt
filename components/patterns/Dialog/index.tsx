'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/ui/cn'
import { FocusTrap } from '@/components/primitives/FocusTrap'
import { Heading, type HeadingLevel } from '@/components/primitives/Heading'
import { IconButton } from '@/components/primitives/IconButton'
import { Surface } from '@/components/primitives/Surface'
import { useReducedMotion } from '@/components/primitives/motion/useReducedMotion'

/**
 * Dialog is the modal surface of DESIGN_SYSTEM §11 (registry RC-201): `role="dialog"`,
 * `aria-modal="true"`, labelled by its own heading, focus moved in on open and restored to
 * the trigger on close, `Escape` and the close button and the scrim all close it, the page
 * behind is `inert` and cannot scroll.
 *
 * WHAT IT DOES NOT OWN. Trapping is `FocusTrap` (RC-031) and elevation is `Surface`
 * (level 3, §6.2: raised-2 + line on the deep grounds, raised + shadow-3 on bone). Both are
 * imported rather than reimplemented, so there is one focus cycle and one elevation ladder
 * in the product. `FocusTrap` wraps the panel exactly as its own contract describes — the
 * trap is a behaviour, the `Surface` inside it is the box.
 *
 * NO COPY LIVES HERE. `title`, `description` and `closeLabel` are props, sourced by the
 * consumer from `global_content` (SEED §1). There is no default close label: a control with
 * no text has no accessible name, and a default would be English copy compiled into a
 * component.
 *
 * THE FOUR THINGS THAT ARE EASY TO GET WRONG, AND WHY THEY ARE WHERE THEY ARE:
 *
 *   1. `inert` AND THE SCROLL LOCK ARE LAYOUT EFFECTS, NOT PASSIVE ONES. React tears a
 *      subtree down child-first, so `FocusTrap`'s passive cleanup — the one that puts the
 *      keyboard back on the trigger — runs BEFORE this component's own passive cleanup
 *      would. If the background were still `inert` at that moment, `trigger.focus()` would
 *      be silently ignored by the browser and the keyboard user would be dropped on
 *      `<body>`. Layout-effect cleanups run in the commit phase, strictly before any passive
 *      cleanup, so the page is made interactive again before focus is handed back.
 *   2. THE SCROLL LOCK IS REFERENCE-COUNTED AND ITS RELEASE IS IDEMPOTENT, so a Dialog that
 *      is unmounted while open — a route change, an error boundary, a parent that simply
 *      stops rendering it — still gives the page its scrollbar back. That is an effect
 *      cleanup, which React runs on unmount whatever the reason.
 *   3. THE ENTRANCE IS APPLIED TO THE DOM, NOT HELD IN STATE. A CSS transition needs a
 *      from-state that was actually painted; a `useState` flip scheduled after mount is a
 *      passive effect and React may flush those before the browser paints, so the armed
 *      frame is never seen and nothing animates. Arming in a layout effect (before paint)
 *      and settling in `requestAnimationFrame` (after it) is what makes FORM run. The
 *      properties touched are never named in a `style` prop, so React does not fight it.
 *   4. THE EXIT IS INSTANT AND THAT IS DELIBERATE (a stated deviation from §4.2's
 *      `--rv-ease-in` half). A closing dialog leaves the DOM with its `open` prop, and
 *      keeping it mounted for another 240ms would keep focus 240ms from the trigger, or
 *      hand it back into a panel that is still visible and half-dismissed. §11 and §4.3
 *      both rank focus behaviour above the exit curve, and so does this file.
 *
 * REDUCED MOTION IS A STATIC BRANCH (§4.3). With the preference set, nothing is armed and
 * no transition is declared anywhere — the dialog is simply present. Focus movement,
 * trapping and restoration are untouched, exactly as §4.3's table requires.
 */

/**
 * `useLayoutEffect` warns when a Client Component is server-rendered, and this one is. The
 * server branch never runs an effect body that matters: the surface renders `null` until
 * `mounted`, which only a client effect can set.
 */
const useIsomorphicLayoutEffect =
  typeof document === 'undefined' ? React.useEffect : React.useLayoutEffect

/* ------------------------------------------------------------------ the scroll lock */

/**
 * Module-level and counted, because the lock is a property of the PAGE, not of a component
 * instance. §11 forbids nested modals, but a drawer closing as a dialog opens overlaps for
 * one commit, and two independent locks that each restore `overflow` on the way out would
 * leave the page unscrollable or unlock it while a surface is still open.
 */
let scrollLocks = 0
let restoreOverflow = ''
let restorePaddingRight = ''

function lockBodyScroll(): () => void {
  const { body, documentElement } = document

  if (scrollLocks === 0) {
    restoreOverflow = body.style.overflow
    restorePaddingRight = body.style.paddingRight
    // §11: "body scroll lock compensates for the scrollbar width so the page does not
    // jump". This is a measured platform value, not a spacing decision — the §5.1 scale
    // has no step for "however wide this browser draws its scrollbar".
    const scrollbar = window.innerWidth - documentElement.clientWidth
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`
    body.style.overflow = 'hidden'
  }

  scrollLocks += 1
  let released = false

  return () => {
    // Idempotent: a double release would take the count negative and the next lock would
    // never restore anything.
    if (released) return
    released = true
    scrollLocks -= 1
    if (scrollLocks > 0) return
    body.style.overflow = restoreOverflow
    body.style.paddingRight = restorePaddingRight
  }
}

/* ---------------------------------------------------------------------- the inert page */

/**
 * §11: "background content is `inert` while a modal surface is open. `aria-hidden` on a
 * container holding the focused element is a bug." `inert` is the correct tool because it
 * removes the background from the accessible tree, from the tab order and from pointer
 * interaction at once, and it cannot be aimed at the element that currently holds focus by
 * accident — the modal is excluded by identity.
 *
 * An element that was already `inert` before the dialog opened is left alone, so closing
 * the dialog does not activate something the page had deliberately switched off.
 */
function inertOutside(overlay: HTMLElement): () => void {
  const marked: HTMLElement[] = []

  for (const node of Array.from(document.body.children)) {
    if (!(node instanceof HTMLElement)) continue
    if (node === overlay || node.contains(overlay)) continue
    if (node.hasAttribute('inert')) continue
    node.setAttribute('inert', '')
    marked.push(node)
  }

  return () => {
    for (const node of marked) node.removeAttribute('inert')
  }
}

/* ------------------------------------------------------------------- the shared surface */

export interface ModalSurface {
  /** The portal may render: a document exists, and the surface is open. */
  visible: boolean
  /** The overlay root — the scroll-locked, `inert`-excluded, fading box. */
  overlayRef: React.RefObject<HTMLDivElement | null>
  /** The panel. Carries the entrance transform, and forwards the consumer's own ref. */
  panelRef: (node: HTMLElement | null) => void
}

/**
 * Everything a modal surface needs that is not its markup: the portal gate, the scroll
 * lock, the `inert` sweep and the FORM entrance. `Drawer` (RC-202) consumes it too —
 * `COMPONENT_REGISTRY.md` §7.2 says it "shares RC-201's focus and scroll-lock
 * implementation; differs only in placement and transform axis", and `enterFrom` is that
 * axis. Exported for that reason and no other; it is not a public API.
 *
 * @param open        the consumer's open state
 * @param enterFrom   the panel's armed `transform` — `translateY(...)` for a dialog, a
 *                    100% edge translation for a drawer
 * @param forwardedRef the consumer's ref, which lands on the panel
 */
export function useModalSurface(
  open: boolean,
  enterFrom: string,
  forwardedRef: React.ForwardedRef<HTMLElement>,
): ModalSurface {
  const reducedMotion = useReducedMotion()
  const overlayRef = React.useRef<HTMLDivElement | null>(null)
  const panelNode = React.useRef<HTMLElement | null>(null)

  // `createPortal` needs a document. Rendering the portal on the first client render
  // instead would disagree with the server's empty output, and React 19 throws the server
  // tree away on that mismatch rather than patching it.
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const visible = open && mounted

  const panelRef = React.useCallback(
    (node: HTMLElement | null) => {
      panelNode.current = node
      if (typeof forwardedRef === 'function') forwardedRef(node)
      else if (forwardedRef) forwardedRef.current = node
    },
    [forwardedRef],
  )

  // Layout effect, for the ordering reason in the header comment. Cleanup is what makes
  // an unmount mid-open safe.
  useIsomorphicLayoutEffect(() => {
    if (!visible) return
    const overlay = overlayRef.current
    const releaseScroll = lockBodyScroll()
    const releaseInert = overlay ? inertOutside(overlay) : null
    return () => {
      releaseInert?.()
      releaseScroll()
    }
  }, [visible])

  useIsomorphicLayoutEffect(() => {
    if (!visible || reducedMotion) return
    // Without a frame callback there is no safe moment to settle in, so nothing is armed:
    // an overlay left at opacity 0 is an invisible dialog, which is far worse than a
    // dialog that does not animate.
    if (typeof requestAnimationFrame !== 'function') return

    const overlay = overlayRef.current
    const panel = panelNode.current
    if (!overlay) return

    // Armed, with no transition, before this frame is painted.
    overlay.style.transition = 'none'
    overlay.style.opacity = '0'
    if (panel) {
      panel.style.transition = 'none'
      panel.style.transform = enterFrom
    }

    const frame = requestAnimationFrame(() => {
      // FORM (§4.2): --rv-duration-base on --rv-ease-out, transform and opacity only.
      overlay.style.transition = 'opacity var(--rv-duration-base) var(--rv-ease-out)'
      overlay.style.opacity = '1'
      if (panel) {
        panel.style.transition = 'transform var(--rv-duration-base) var(--rv-ease-out)'
        panel.style.transform = 'none'
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [visible, reducedMotion, enterFrom])

  return { visible, overlayRef, panelRef }
}

/* -------------------------------------------------------------------------- the glyph */

/** 20px is applied by IconButton; 1.5 stroke and `currentColor` are §7.2's icon contract. */
const CloseGlyph = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M6 6 18 18M18 6 6 18" strokeLinecap="round" />
  </svg>
)

/* ----------------------------------------------------------------------------- Dialog */

/** §6.1 radius-lg, widths on the §5.1 scale: 480 / 640 / 800px above the sheet breakpoint. */
export type DialogSize = 'sm' | 'md' | 'lg'

const SIZE: Record<DialogSize, string> = {
  sm: 'md:max-w-120',
  md: 'md:max-w-160',
  lg: 'md:max-w-200',
}

/** §11: 8px rise + fade. `--rv-motion-rise-sm`, read as a token rather than a number. */
const DIALOG_ENTER_FROM = 'translateY(var(--rv-motion-rise-sm))'

export interface DialogProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  open: boolean
  /** Called by `Escape`, the close button and the scrim. The consumer owns `open`. */
  onClose: () => void
  /** The dialog's accessible name, rendered as its heading. From `global_content`. */
  title: React.ReactNode
  /**
   * The DOM level of that heading. A dialog is a new context rather than a place in the
   * page outline, so `2` is the default rather than a computed level (§3.5 keeps the DOM
   * level and the visual size apart, and this only sets the level).
   */
  titleLevel?: HeadingLevel
  /** Optional supporting line, wired to `aria-describedby` (§11). */
  description?: React.ReactNode
  /** Accessible name of the close control. Required: an icon has no text to fall back on. */
  closeLabel: string
  size?: DialogSize
  /**
   * §11: a destructive confirm must not be dismissible by a stray click on the scrim.
   * `ConfirmDialog` (RC-309) passes `false`.
   */
  closeOnScrimClick?: boolean
  /** Where focus lands on open. Defaults to the first tabbable — usually the close button. */
  initialFocus?: React.RefObject<HTMLElement | null>
  /** Where focus returns, when the trigger will not survive the dialog (RC-031). */
  returnFocusTo?: React.RefObject<HTMLElement | null>
}

/**
 * `ref` and the rest props land on the element carrying `role="dialog"` — the panel is what
 * a consumer means by "the dialog", so `id`, `data-*` and any `aria-*` override belong
 * there rather than on the scrim wrapper.
 */
export const Dialog = React.forwardRef<HTMLElement, DialogProps>(function Dialog(
  {
    open,
    onClose,
    title,
    titleLevel = 2,
    description,
    closeLabel,
    size = 'md',
    closeOnScrimClick = true,
    initialFocus,
    returnFocusTo,
    className,
    style,
    children,
    'aria-describedby': describedBy,
    ...rest
  },
  ref,
) {
  const headingId = React.useId()
  const descriptionId = React.useId()
  const { visible, overlayRef, panelRef } = useModalSurface(open, DIALOG_ENTER_FROM, ref)

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape' || event.defaultPrevented) return
    // Stopped here so an Escape meant for this dialog cannot also close whatever it was
    // opened from — a filter drawer behind a confirm, say.
    event.stopPropagation()
    onClose()
  }

  if (!visible) return null

  return createPortal(
    <div
      ref={overlayRef}
      // Bottom sheet on a phone (RC-201's mobile row), centred from `md` up.
      className="fixed inset-0 flex items-end justify-center md:items-center md:p-6"
      // §5.6. Not a Tailwind `z-` utility: the layer is a token, and the scale in §5.6 is
      // the only place a stacking order is allowed to be decided.
      style={{ zIndex: 'var(--rv-z-dialog)' }}
    >
      {/*
        The scrim carries the click, not the overlay root: a drag that starts on the panel
        and ends outside fires its click on the common ancestor, so putting the handler
        here means a slipped text selection cannot dismiss the dialog. It is `aria-hidden`
        because every route out of the dialog it offers — Escape, the close button — is
        already in the accessible tree.
      */}
      <div
        aria-hidden="true"
        onClick={closeOnScrimClick ? onClose : undefined}
        className="absolute inset-0"
        style={{ backgroundColor: 'var(--rv-scrim)' }}
      />
      <FocusTrap
        initialFocus={initialFocus}
        returnFocusTo={returnFocusTo}
        onKeyDown={handleKeyDown}
        // `relative` so the panel stacks above the absolutely positioned scrim without a
        // second z-index; the trap itself paints nothing.
        className={cn('relative flex w-full flex-col', SIZE[size])}
      >
        <Surface
          ref={panelRef}
          level={3}
          radius="none"
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          aria-describedby={cn(description ? descriptionId : undefined, describedBy) || undefined}
          className={cn(
            'flex flex-col overflow-hidden',
            // Square where it meets the bottom edge of a phone, fully rounded once it is
            // a centred card (§6.1: dialogs are --rv-radius-lg). Two corner utilities
            // rather than `rounded-lg` at `md`, so nothing depends on which of two
            // border-radius declarations Tailwind happens to emit last.
            'rounded-t-lg md:rounded-b-lg',
            className,
          )}
          style={{
            // A fraction of the viewport, which the §5.1 spacing scale cannot express, and
            // the safe-area inset a phone's home indicator needs (RC-201's mobile row).
            maxHeight: '90dvh',
            paddingBottom: 'env(safe-area-inset-bottom)',
            ...style,
          }}
          {...rest}
        >
          <header className="flex items-start justify-between gap-4 p-6 pb-4">
            <div className="flex flex-col gap-2">
              <Heading id={headingId} level={titleLevel} size="display-xs">
                {title}
              </Heading>
              {description ? (
                <p id={descriptionId} className="text-sm text-ink-secondary">
                  {description}
                </p>
              ) : null}
            </div>
            <IconButton aria-label={closeLabel} onClick={onClose}>
              {CloseGlyph}
            </IconButton>
          </header>
          {/* `min-h-0` so this box may shrink inside the capped column; without it a flex
              item refuses to go below its content height and the panel overflows instead
              of scrolling. */}
          <div className="min-h-0 overflow-y-auto px-6 pb-6">{children}</div>
        </Surface>
      </FocusTrap>
    </div>,
    document.body,
  )
})
