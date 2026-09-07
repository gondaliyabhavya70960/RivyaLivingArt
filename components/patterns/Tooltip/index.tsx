'use client'

import * as React from 'react'
import { cn } from '@/lib/ui/cn'

/**
 * Tooltip is DESIGN_SYSTEM §11's tooltip row and registry RC-205: `role="tooltip"`
 * referenced by `aria-describedby` on the trigger, opening on hover after 400ms and on
 * focus immediately, dismissed by `Escape`, never focusable, never carrying an interactive
 * element.
 *
 * A TOOLTIP IS NOT AN ACCESSIBLE NAME. It is a DESCRIPTION — it supplements a name that
 * already exists, which is why the trigger is wired with `aria-describedby` and never with
 * `aria-labelledby`. A trigger whose only text is its tooltip is a bug IN THE CONSUMER and
 * this component cannot fix it: an icon-only control takes its name from `aria-label`
 * (`IconButton` makes that a compile error to forget), and the tooltip then adds detail on
 * top. If the words in the tooltip are the only way to know what the control does, they
 * belong in the label, or in visible `HelpText`, not here.
 *
 * §11: "a tooltip never carries information available nowhere else, and never contains an
 * interactive element. If it needs a link, it is a Popover, which is not yet a component in
 * this system." `content` is therefore typed `string` rather than `ReactNode` — the
 * strongest available enforcement, and it makes the second half of that sentence a type
 * error instead of a code review.
 *
 * WCAG 1.4.13 (content on hover or focus) has three requirements and each one is a line of
 * this file:
 *
 *   DISMISSIBLE — `Escape` closes it, and the listener is on the DOCUMENT rather than on
 *     the wrapper. A pointer user hovering the trigger has focus somewhere else entirely,
 *     so a wrapper-level key handler would never see their `Escape`. Once dismissed it
 *     stays dismissed until the pointer leaves or focus moves, so it cannot flash straight
 *     back while the pointer has not moved.
 *   HOVERABLE — the tooltip is rendered INSIDE the wrapper, so moving the pointer onto it
 *     does not fire the wrapper's `mouseleave` (that event ignores movement into
 *     descendants) even though the tooltip is painted outside the wrapper's box. The 100ms
 *     grace on leaving covers the gap the pointer crosses on the way there.
 *   PERSISTENT — nothing dismisses it on a timer.
 *
 * IT IS ALWAYS IN THE DOM, AND THE DESCRIPTION IS ALWAYS WIRED. Hiding it is a visual
 * state, not a mount: `aria-describedby` resolves through a hidden element by design (the
 * accessible-name spec includes nodes reached by an explicit reference even when they are
 * hidden), so a screen-reader user hears the description on focus whether or not a pointer
 * ever hovered. Mounting it only while open would make the description a race with the
 * hover timer.
 *
 * PLACEMENT IS NAIVE, DELIBERATELY. `top` or `bottom`, centred on the trigger, and that is
 * all: no collision detection, no flipping, no viewport measurement, because that is a
 * positioning engine and §11 does not ask for one and no dependency may be added for it.
 * The consequences are real and are the consumer's to avoid — near the top of the viewport
 * a `top` tooltip is clipped by the window, and inside any ancestor with `overflow: hidden`
 * it is clipped by that. `placement` is the escape hatch: pass `bottom` under a sticky
 * header. Do not read this component as collision-aware, because it is not.
 *
 * NOT FOR TOUCH (RC-205). There is no hover on a phone and a long-press is not a documented
 * gesture, so below 768px the same words belong in persistent `HelpText` next to the
 * control. This component does not silently do that for you; the consumer chooses.
 */

/** §11: hover opens after 400ms, focus opens at once, leaving grants a 100ms grace. */
const HOVER_DELAY_MS = 400
const LEAVE_GRACE_MS = 100

/**
 * `w-max` so the box is as wide as its words and no wider, capped at 256px so a long
 * sentence wraps instead of spanning the viewport. Elevation 2 (§6.2) written out rather
 * than composed from `Surface`, because a tooltip must be phrasing content: `Surface`
 * renders flow elements, and a <div> inside this <span> wrapper is invalid markup.
 */
const PANEL =
  'absolute left-1/2 w-max max-w-64 -translate-x-1/2 ' +
  'rounded-md border border-line-strong bg-surface-raised-2 rv-surface-raised-2 shadow-2 ' +
  'px-3 py-2 text-sm leading-tight text-ink'

const PLACEMENT = {
  top: 'bottom-full mb-2',
  bottom: 'top-full mt-2',
} as const

export type TooltipPlacement = keyof typeof PLACEMENT

/**
 * LIGHT (§4.2): a 120ms fade on paint properties only. `visibility` travels with the
 * opacity so a hidden tooltip is out of the accessible tree and out of the pointer's way,
 * and it is an inline style rather than a class so the hidden state is a real computed
 * value rather than something only a stylesheet knows.
 */
const HIDDEN: React.CSSProperties = { opacity: 0, visibility: 'hidden' }
const SHOWN: React.CSSProperties = { opacity: 1, visibility: 'visible' }

export interface TooltipProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'content'> {
  /**
   * The supplementary text. `string`, not `ReactNode`, so §11's "never contains an
   * interactive element" is enforced by the compiler. Copy comes from `global_content`.
   */
  content: string
  /** Which side of the trigger the tooltip is drawn on. No collision fallback — see above. */
  placement?: TooltipPlacement
  /**
   * The trigger: exactly one element, and one that is already focusable and already
   * named — a `Button`, an `IconButton`, a `TextLink`. It is cloned so that
   * `aria-describedby` lands on the control itself; a description on a wrapper would
   * describe nothing.
   */
  children: React.ReactElement<{ 'aria-describedby'?: string }>
}

/** `ref` and the rest props land on the wrapper, which is the element this component owns. */
export const Tooltip = React.forwardRef<HTMLSpanElement, TooltipProps>(function Tooltip(
  {
    content,
    placement = 'top',
    className,
    children,
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const id = React.useId()
  const [open, setOpen] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  // Set by Escape, cleared when the pointer leaves or focus moves: without it the tooltip
  // reopens on the very next hover timer and Escape reads as a 400ms delay.
  const dismissed = React.useRef(false)
  // Hover and focus are tracked separately because either alone is enough to keep the
  // tooltip open. Collapsing them into the one `open` flag loses the person who navigates
  // by keyboard AND owns a mouse: their pointer drifts off the control, `mouseleave` fires
  // while the control is still focused, and the tooltip they are reading disappears.
  const hovered = React.useRef(false)
  const focused = React.useRef(false)

  const clearTimer = React.useCallback(() => {
    if (timer.current === null) return
    clearTimeout(timer.current)
    timer.current = null
  }, [])

  // A pending timer outliving the component would call setState on an unmounted tree.
  React.useEffect(() => clearTimer, [clearTimer])

  React.useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      dismissed.current = true
      clearTimer()
      setOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, clearTimer])

  const describedTrigger = React.cloneElement(React.Children.only(children), {
    // Appended, never replaced: a control may already point at its own help text, and
    // dropping that to add a tooltip would trade a description for a description.
    'aria-describedby': cn(children.props['aria-describedby'], id),
  })

  return (
    <span
      ref={ref}
      className={cn('relative inline-flex', className)}
      onMouseEnter={(event) => {
        onMouseEnter?.(event)
        hovered.current = true
        clearTimer()
        if (dismissed.current) return
        timer.current = setTimeout(() => setOpen(true), HOVER_DELAY_MS)
      }}
      onMouseLeave={(event) => {
        onMouseLeave?.(event)
        hovered.current = false
        // A new hover may open it again — the latch only survives a pointer that has not
        // moved, which is what WCAG 1.4.13's "dismissible" asks for.
        dismissed.current = false
        if (focused.current) return
        clearTimer()
        timer.current = setTimeout(() => setOpen(false), LEAVE_GRACE_MS)
      }}
      // React's onFocus/onBlur are delegated from focusin/focusout, so they reach the
      // wrapper from the trigger inside it. Focus opens with no delay (§11): a keyboard
      // user has already committed to the control, and a delay reads as a fault.
      onFocus={(event) => {
        onFocus?.(event)
        focused.current = true
        clearTimer()
        if (dismissed.current) return
        setOpen(true)
      }}
      onBlur={(event) => {
        onBlur?.(event)
        focused.current = false
        dismissed.current = false
        if (hovered.current) return
        clearTimer()
        setOpen(false)
      }}
      {...rest}
    >
      {describedTrigger}
      <span
        id={id}
        role="tooltip"
        className={cn(
          PANEL,
          PLACEMENT[placement],
          // `duration-(--rv-...)` is Tailwind 4's custom-property syntax; the bracket form
          // emits `transition-duration: --rv-duration-fast`, which is not a valid value
          // and fails silently.
          'transition-[opacity,visibility] duration-(--rv-duration-fast) ease-standard',
          // The static branch §4.3 asks for. It is genuinely static here rather than
          // merely fast: the hidden state is a real `visibility`, so suppressing the
          // transition cannot strand the tooltip mid-fade the way a cancelled entrance
          // can strand a Reveal at opacity 0.
          'motion-reduce:transition-none',
        )}
        // §5.6: tooltips share the dropdown layer at 200. Not a Tailwind `z-` utility —
        // the layer is a token.
        style={{ ...(open ? SHOWN : HIDDEN), zIndex: 'var(--rv-z-dropdown)' }}
      >
        {content}
      </span>
    </span>
  )
})
