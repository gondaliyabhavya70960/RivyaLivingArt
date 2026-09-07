import * as React from 'react'
import { cn } from '@/lib/ui/cn'

/**
 * Select is a native <select> with `appearance: none` and a token chevron. It is native
 * because a native picker on a 390px phone beats any custom listbox, and because the seeded
 * forms are short lists (DESIGN_SYSTEM §7.6). A field that needs search, grouping or
 * multi-select is a `Combobox` — a new component with its own registry row and the APG
 * combobox keyboard model, never a modified Select.
 *
 * There is one height: 44px, the touch minimum (§7). §7.5's 36px dense variant belongs to
 * Input in Studio tables; a shrunken <select> cannot take the base.css ::before hit overlay,
 * because a replaced element renders no pseudo-element, so it is deliberately not offered.
 *
 * The label lives outside the control: `Field` owns the id relationships (§7.4) and passes
 * `id`, `aria-describedby` and `aria-invalid` straight through here. Options are children —
 * this file contains no copy of its own.
 *
 * `className` styles the control's box (the wrapper that positions the chevron); everything
 * else — `id`, `name`, `aria-*`, `data-*` — spreads onto the <select> itself.
 */
export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, disabled, 'aria-invalid': ariaInvalid, ...rest },
  ref,
) {
  // Invalid is read from the ARIA attribute Field already wires, so there is no second
  // source of truth to drift. Border colour never carries the error alone: ErrorText does
  // (§7, WCAG 1.4.1).
  const invalid = ariaInvalid !== undefined && ariaInvalid !== false && ariaInvalid !== 'false'

  return (
    <span className={cn('relative block', className)}>
      <select
        ref={ref}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        className={cn(
          'peer w-full appearance-none rounded-sm border bg-surface-raised text-ink',
          'h-11 pr-11 pl-4 text-base',
          // LIGHT (§4.2): colour and border only, never a layout property.
          // duration-(--var) is the CSS-variable form; duration-[--var] emits a bare
          // `transition-duration: --rv-duration-fast`, which is invalid and silently
          // drops the transition. Do not "tidy" the parentheses into brackets.
          'transition-[color,background-color,border-color] duration-(--rv-duration-fast) ease-standard',
          'focus:border-ink-accent',
          // Full opacity, never opacity-50 — that drags the ratio below the §2.6 exemption.
          'disabled:cursor-not-allowed disabled:border-line disabled:text-ink-disabled',
          invalid ? 'border-state-danger' : 'border-line-strong',
        )}
        {...rest}
      >
        {children}
      </select>
      {/* Decorative: the native <select> announces its own role and value. 20px stroke
          icon in currentColor, stroke-width 1.5, no icon font and no sprite fetch (§7.2). */}
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(
          'pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2',
          'text-ink-secondary peer-disabled:text-ink-disabled',
        )}
      >
        <path d="M5 7.5 10 12.5 15 7.5" />
      </svg>
    </span>
  )
})
