'use client'

import * as React from 'react'
import { cn } from '@/lib/ui/cn'

/**
 * Switch is the one control here that is not a native input, because a checkbox cannot
 * express a setting that applies the moment it is flipped — which is the only thing a
 * Switch is for (§7.8): Studio feature flags, `is_visible`, `is_enabled`. Anything with a
 * save step is a Checkbox.
 *
 * <button role="switch"> also gets Space *and* Enter for free — a native button fires
 * click on both — so there is no key handler in this file to get wrong.
 *
 * Geometry (§7.8): a 44 × 24px track at `--rv-radius-pill` inside a 44px hit box (the
 * base.css `rv-hit-44` overlay; a <button> renders the ::before that a replaced element
 * would not), with a 20px thumb inset by the hairline border, so the travel is exactly
 * 20px — `translate-x-5`, no arbitrary value.
 *
 * On and off are carried by the thumb position *and* the state word beside the track,
 * never by the track colour alone (WCAG 1.4.1). Both words are required props: this file
 * contains no copy.
 *
 * The only motion is the thumb transform (LIGHT, 120ms). `motion-reduce:transition-none`
 * is the static branch §4.3 asks for — the thumb is simply already there — not a faster
 * animation, and there is no entrance to skip, so no `useReducedMotion` subscription is
 * needed.
 *
 * `className` styles the row; `id`, `aria-label`, `aria-describedby` and `data-*` spread
 * onto the <button>, which is also what `ref` points at.
 */
export interface SwitchProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'type' | 'role' | 'aria-checked' | 'value' | 'defaultValue'
> {
  /** Controlled state. Omit for an uncontrolled switch seeded by `defaultChecked`. */
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  /** The word shown beside the track while the setting is on. */
  onLabel: string
  /** The word shown beside the track while the setting is off. */
  offLabel: string
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  {
    checked,
    defaultChecked = false,
    onCheckedChange,
    onLabel,
    offLabel,
    className,
    disabled,
    onClick,
    ...rest
  },
  ref,
) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultChecked)
  const isControlled = checked !== undefined
  const on = isControlled ? checked : uncontrolled

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    onClick?.(event)
    if (event.defaultPrevented) return
    // A controlled switch never moves on its own: the owner of the setting decides,
    // which is what makes an immediately-applied setting honest about failure.
    if (!isControlled) setUncontrolled(!on)
    onCheckedChange?.(!on)
  }

  // One class per property, resolved here rather than by stacking utilities that would
  // then fight over the cascade: Tailwind orders by its own stylesheet, not by the order
  // classes appear in a string, so "disabled" must win by being the only tone emitted.
  const trackTone = disabled
    ? 'cursor-not-allowed border-line bg-surface-raised'
    : on
      ? 'border-surface-accent bg-surface-accent'
      : 'border-line-strong bg-surface-raised'

  const thumbTone = disabled ? 'bg-ink-disabled' : on ? 'bg-ink-on-accent' : 'bg-line-strong'

  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          'rv-hit-44 relative inline-flex h-6 w-11 shrink-0 items-center rounded-pill border',
          // LIGHT (§4.2): colour and border only on the track, no layout property.
          'transition-[background-color,border-color] duration-[--rv-duration-fast] ease-standard',
          trackTone,
        )}
        {...rest}
      >
        <span
          aria-hidden="true"
          className={cn(
            'ml-px size-5 rounded-pill',
            'transition-transform duration-[--rv-duration-fast] ease-standard',
            'motion-reduce:transition-none',
            on ? 'translate-x-5' : 'translate-x-0',
            thumbTone,
          )}
        />
      </button>
      {/* Outside the button on purpose: the state word must not become the accessible
          name, which would change under the user mid-interaction. aria-checked carries
          the state to assistive tech; this span carries it to everyone else. */}
      <span className={cn('text-sm', disabled ? 'text-ink-disabled' : 'text-ink-secondary')}>
        {on ? onLabel : offLabel}
      </span>
    </span>
  )
})
