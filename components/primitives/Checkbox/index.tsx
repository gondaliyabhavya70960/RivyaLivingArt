import * as React from 'react'
import { cn } from '@/lib/ui/cn'

/**
 * Checkbox is a native <input type="checkbox"> with `appearance: none`. Native is not a
 * shortcut: it is keyboard- and screen-reader-correct for free, and every state §7.7 asks
 * for is reachable with a `checked:` variant. 20px control, `--rv-radius-xs`, unchecked
 * `--rv-line-strong` on `--rv-surface-raised`, checked `--rv-surface-accent` with an
 * `--rv-ink-on-accent` mark drawn as an SVG path — not a background image, not a glyph.
 *
 * The root is a <label>, always. That is what makes the 44px hit box real: a bare <span>
 * overlay would swallow the click, and a replaced element like <input> renders no
 * ::before of its own. Wrapping in a label means the whole row — control, gap and text —
 * activates the control (§7.7), and the base.css `rv-hit-44` overlay it carries belongs to
 * an element that forwards its clicks.
 *
 * Pass `label` for the visible text. Omit it when a `Field` supplies the label and wires
 * `id` (§7.4); the empty wrapper contributes nothing to the accessible name.
 *
 * A checkbox is for a value saved with the form. A setting that applies the moment it is
 * flipped is a Switch (§7.8).
 *
 * `className` styles the row; `id`, `name`, `aria-*` and `data-*` spread onto the <input>.
 */
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Visible label beside the control. Content is always a prop, never a literal here. */
  label?: React.ReactNode
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
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
          type="checkbox"
          disabled={disabled}
          aria-invalid={ariaInvalid}
          className={cn(
            'peer size-5 appearance-none rounded-xs border bg-surface-raised',
            'checked:border-surface-accent checked:bg-surface-accent',
            // LIGHT (§4.2): colour and border only. The tick itself is instant
            // (--rv-duration-instant, §4.1) — a checkbox must feel mechanical.
            // duration-(--var) is the CSS-variable form; duration-[--var] emits a bare
            // `transition-duration: --rv-duration-fast`, which is invalid and silently
            // drops the transition. Do not "tidy" the parentheses into brackets.
            'transition-[background-color,border-color] duration-(--rv-duration-fast) ease-standard',
            // Disabled is a full-opacity swap, never opacity-50: a checked-and-disabled
            // box keeps a legible mark (surface-raised on ink-disabled, ≥ 4.3:1 in all
            // three schemes) instead of fading below the §2.6 exemption.
            'disabled:cursor-not-allowed disabled:border-line',
            'disabled:checked:border-ink-disabled disabled:checked:bg-ink-disabled',
            invalid ? 'border-state-danger' : 'border-line-strong',
          )}
          {...rest}
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            'pointer-events-none absolute inset-0 opacity-0 peer-checked:opacity-100',
            'text-ink-on-accent peer-disabled:text-surface-raised',
          )}
        >
          <path d="M5 10.5 8.5 14 15 6.5" />
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
