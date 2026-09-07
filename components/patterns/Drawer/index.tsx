'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/ui/cn'
import { FocusTrap } from '@/components/primitives/FocusTrap'
import { Heading, type HeadingLevel } from '@/components/primitives/Heading'
import { IconButton } from '@/components/primitives/IconButton'
import { Surface } from '@/components/primitives/Surface'
import { VisuallyHidden } from '@/components/primitives/VisuallyHidden'
import { useModalSurface } from '@/components/patterns/Dialog'

/**
 * Drawer is `Dialog`'s edge-anchored twin (registry RC-202, DESIGN_SYSTEM §11): the same
 * modal contract — `role="dialog"`, `aria-modal="true"`, labelled by its heading, focus
 * moved in and trapped and restored, `Escape` and the close button and the scrim all close
 * it, the page behind `inert` and unscrollable — differing, as §7.2 of the registry puts it,
 * "only in placement and transform axis".
 *
 * That sentence is the reason this file imports `useModalSurface` from `Dialog` instead of
 * copying it. The portal gate, the reference-counted scroll lock, the `inert` sweep and the
 * layout-effect ordering that keeps focus restoration working are subtle enough that a
 * second copy would drift; the axis is the only thing that genuinely differs, so the axis is
 * the only thing passed in. Everything the header comment of `Dialog/index.tsx` explains
 * about effect ordering, the instant exit and the reduced-motion branch is true here too.
 *
 * WHAT IS BUILT ON THIS. The mobile navigation (§8.3), the filter sheet (§14), the inquiry
 * drawer and Studio's `DrawerForm` (RC-310) are all this component with different children.
 * They are Phase 10 and Phase 14's work; the geometry those sections fix — full width below
 * 430px and 420px above, rows at least 56px tall, the primary action pinned above the
 * safe-area inset — is partly here (the width, the inset) and partly theirs (the rows, the
 * pinning), because a row height belongs to the list that has rows.
 *
 * SWIPE-TO-DISMISS IS NOT IMPLEMENTED, and the registry's line on it is the reason it is
 * safe not to be: swipe is "an addition to, never a replacement for, the close button". The
 * close button, `Escape` and the scrim are all here, so nothing is unreachable without it.
 *
 * `bottom` is the filter-sheet anchor and it is capped, not full height: a sheet that covers
 * the whole viewport is a dialog wearing the wrong animation.
 */
export type DrawerSide = 'left' | 'right' | 'bottom'

/** Where the panel sits inside the fixed overlay. Stretch is the default cross-axis. */
const OVERLAY: Record<DrawerSide, string> = {
  left: 'justify-start',
  right: 'justify-end',
  bottom: 'items-end justify-center',
}

/**
 * §8.3: full width below `--rv-bp-sm` (430px), 420px above it. 420 is `w-105` on the 4px
 * scale of §5.1 — a spacing step, not an arbitrary value.
 */
const WRAPPER: Record<DrawerSide, string> = {
  left: 'h-full w-full sm:w-105',
  right: 'h-full w-full sm:w-105',
  bottom: 'w-full',
}

/** §6.1: drawers are `--rv-radius-lg`, rounded only on the edge that faces the page. */
const PANEL: Record<DrawerSide, string> = {
  left: 'h-full rounded-r-lg',
  right: 'h-full rounded-l-lg',
  bottom: 'rounded-t-lg',
}

/**
 * FORM (§4.2, §11): `translateX`/`translateY` over `--rv-duration-base` on `--rv-ease-out`.
 * The travel is a full edge width rather than one of the `--rv-motion-rise-*` steps because
 * those ceilings govern a REVEAL — content arriving in place — and a drawer is a surface
 * arriving from off-screen. It is still transform and opacity only, which is the rule that
 * actually binds.
 */
const ENTER_FROM: Record<DrawerSide, string> = {
  left: 'translateX(-100%)',
  right: 'translateX(100%)',
  bottom: 'translateY(100%)',
}

/**
 * `env(safe-area-inset-bottom)` on every side so a phone's home indicator never sits on top
 * of the last row; a viewport-fraction cap on the bottom sheet, which the §5.1 scale has no
 * step for.
 */
const PANEL_STYLE: Record<DrawerSide, React.CSSProperties> = {
  left: { paddingBottom: 'env(safe-area-inset-bottom)' },
  right: { paddingBottom: 'env(safe-area-inset-bottom)' },
  bottom: { maxHeight: '90dvh', paddingBottom: 'env(safe-area-inset-bottom)' },
}

/** 20px is applied by IconButton; 1.5 stroke and `currentColor` are §7.2's icon contract. */
const CloseGlyph = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M6 6 18 18M18 6 6 18" strokeLinecap="round" />
  </svg>
)

export interface DrawerProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  open: boolean
  /** Called by `Escape`, the close button and the scrim. The consumer owns `open`. */
  onClose: () => void
  /** Which edge the drawer is anchored to. `bottom` is the filter-sheet form. */
  side?: DrawerSide
  /** The drawer's accessible name, rendered as its heading. From `global_content`. */
  title: React.ReactNode
  /** The DOM level of that heading. A drawer is a new context, so `2` by default. */
  titleLevel?: HeadingLevel
  /**
   * Keeps the heading in the accessible tree and takes it off the screen, for a drawer
   * whose content already names itself — the mobile nav, where a visible "Menu" heading
   * above the menu is a caption on a caption. It is never dropped: `aria-modal` without a
   * name gives a screen-reader user a dialog called nothing.
   */
  titleHidden?: boolean
  /** Optional supporting line, wired to `aria-describedby` (§11). */
  description?: React.ReactNode
  /** Accessible name of the close control. Required: an icon has no text to fall back on. */
  closeLabel: string
  closeOnScrimClick?: boolean
  /** Where focus lands on open. Defaults to the first tabbable — usually the close button. */
  initialFocus?: React.RefObject<HTMLElement | null>
  /** Where focus returns, when the trigger will not survive the drawer (RC-031). */
  returnFocusTo?: React.RefObject<HTMLElement | null>
}

/**
 * `ref` and the rest props land on the element carrying `role="dialog"` — the panel is what
 * a consumer means by "the drawer", so `id`, `data-*` and any `aria-*` override belong there
 * rather than on the scrim wrapper.
 */
export const Drawer = React.forwardRef<HTMLElement, DrawerProps>(function Drawer(
  {
    open,
    onClose,
    side = 'right',
    title,
    titleLevel = 2,
    titleHidden = false,
    description,
    closeLabel,
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
  const overlayRef = React.useRef<HTMLDivElement | null>(null)
  const panelRef = React.useRef<HTMLElement | null>(null)
  const { visible, capturedTrigger } = useModalSurface({
    open,
    overlayRef,
    panelRef,
    enterFrom: ENTER_FROM[side],
  })

  // One node, two consumers: the entrance needs the element to animate, and the caller
  // still gets the ref it passed. The same shape FocusTrap uses for its own container.
  const setPanel = React.useCallback(
    (node: HTMLElement | null) => {
      panelRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    [ref],
  )

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape' || event.defaultPrevented) return
    // Stopped here so an Escape meant for this drawer cannot also close whatever it was
    // opened from.
    event.stopPropagation()
    onClose()
  }

  if (!visible) return null

  const heading = (
    <Heading id={headingId} level={titleLevel} size="display-xs">
      {title}
    </Heading>
  )

  return createPortal(
    <div
      ref={overlayRef}
      className={cn('fixed inset-0 flex', OVERLAY[side])}
      // §5.6: drawers sit at 400, below dialogs at 500, so a confirm opened from inside a
      // drawer lands on top of it. Not a Tailwind `z-` utility — the layer is a token.
      style={{ zIndex: 'var(--rv-z-drawer)' }}
    >
      {/*
        The scrim carries the click, not the overlay root: a drag that starts on the panel
        and ends outside fires its click on the common ancestor, so a slipped selection
        cannot dismiss the drawer. `aria-hidden` because Escape and the close button are
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
        returnFocusTo={returnFocusTo ?? capturedTrigger}
        onKeyDown={handleKeyDown}
        // `relative` so the panel stacks above the absolutely positioned scrim without a
        // second z-index; the trap itself paints nothing.
        className={cn('relative flex flex-col', WRAPPER[side])}
      >
        <Surface
          ref={setPanel}
          level={3}
          radius="none"
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          aria-describedby={cn(description ? descriptionId : undefined, describedBy) || undefined}
          className={cn('flex flex-col overflow-hidden', PANEL[side], className)}
          style={{ ...PANEL_STYLE[side], ...style }}
          {...rest}
        >
          <header className="flex items-start justify-between gap-4 p-6 pb-4">
            <div className="flex flex-col gap-2">
              {/* `as="div"`: a heading is flow content and may not sit inside the default
                  <span>. VisuallyHidden rather than dropping the element, because the
                  dialog's name is computed from it. */}
              {titleHidden ? <VisuallyHidden as="div">{heading}</VisuallyHidden> : heading}
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
