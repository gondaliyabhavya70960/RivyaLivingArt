import * as React from 'react'
import { cn } from '@/lib/ui/cn'

/**
 * Radio is a native <input type="radio"> with `appearance: none`. Native buys the whole
 * roving-focus keyboard model — arrow keys move and select inside a `name` group, Tab
 * enters and leaves it — which no div-based fake reproduces for free.
 *
 * 20px control inside a 44px hit box. §7.7 gives the radio `--rv-radius-pill` (the shape
 * is what distinguishes it from a checkbox at a glance); unchecked is `--rv-line-strong`
 * on `--rv-surface-raised`, checked is a `--rv-surface-accent` fill with an
 * `--rv-ink-on-accent` mark drawn as an SVG path.
 *
 * The root is a <label>, always — the same reason as Checkbox: only a label forwards the
 * clicks landing on the base.css `rv-hit-44` overlay to the control, and a replaced
 * element renders no ::before of its own.
 *
 * A group of these belongs in a <fieldset> with a visible <legend> wherever the group asks
 * a real question (§7.7). That wrapper is the consumer's — a radio does not invent one, and
 * every string here is a prop.
 *
 * `className` styles the row; `id`, `name`, `value`, `aria-*` and `data-*` spread onto the
 * <input>.
 */
export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Visible label beside the control. Content is always a prop, never a literal here. */
  label?: React.ReactNode
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { label, className, disabled, 'aria-invalid': ariaInvalid, ...rest },
  ref,
) {
  // Read from the ARIA attribute Field already wires, so there is no second source of
  // truth. The border never carries the error alone — ErrorText does (§7, WCAG 1.4.1).
  const invalid = ariaInvalid !== undefined && ariaInvalid !== false && ariaInvalid !== 'false'

  return (
    <label
      className={cn(
        'rv-hit-44 inline-flex min-h-11 items-center gap-3',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        className,
      )}
    >
      <span className="relative inline-flex size-5 shrink-0">
        <input
          ref={ref}
          type="radio"
          disabled={disabled}
          aria-invalid={ariaInvalid}
          className={cn(
            'peer size-5 appearance-none rounded-pill border bg-surface-raised',
            'checked:border-surface-accent checked:bg-surface-accent',
            // LIGHT (§4.2): colour and border only. The mark itself is instant
            // (--rv-duration-instant, §4.1) — selection must feel mechanical.
            'transition-[background-color,border-color] duration-[--rv-duration-fast] ease-standard',
            // Disabled is a full-opacity swap, never opacity-50: a checked-and-disabled
            // control keeps a legible mark instead of fading below the §2.6 exemption.
            'disabled:cursor-not-allowed disabled:border-line',
            'disabled:checked:border-ink-disabled disabled:checked:bg-ink-disabled',
            invalid ? 'border-state-danger' : 'border-line-strong',
          )}
          {...rest}
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={cn(
            'pointer-events-none absolute inset-0 opacity-0 peer-checked:opacity-100',
            'text-ink-on-accent peer-disabled:text-surface-raised',
          )}
        >
          {/* An SVG path, not a background image and not a font glyph (§7.7). */}
          <path d="M14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" fill="currentColor" />
        </svg>
      </span>
      {label === undefined ? null : (
        <span className={cn('text-sm font-medium', disabled ? 'text-ink-disabled' : 'text-ink')}>
          {label}
        </span>
      )}
    </label>
  )
})
