import * as React from 'react'
import { cn } from '@/lib/ui/cn'
import { Spinner } from '@/components/primitives/Spinner'

/**
 * Button renders <button>. A control that navigates is an <a>, and that is TextLink.
 * There is deliberately no `as` prop blurring the two (DESIGN_SYSTEM §7.1).
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'quiet' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

/**
 * PRIMARY IS AN INVERSE FILL, NOT AN ACCENT FILL (amendment A46).
 *
 * The reference draws its loudest button as the maximum-contrast inversion of whatever ground it
 * sits on: filled obsidian with ivory text on a light page, filled ivory with obsidian text over
 * the dark hero. Those look like two variants and are one rule — `--rv-surface-inverse` already
 * means "the opposite ground" in every scheme, and `--rv-ink-inverse` is the ink that reads on
 * it. Expressed that way the button needs no knowledge of its scheme and no `onDark` prop, and
 * it inverts correctly on all five schemes including the two added with this amendment.
 *
 * It also frees the champagne accent fill, which was doing double duty as "the loud button" and
 * "the brand accent"; the accent now marks emphasis (eyebrows, highlight runs, rules) and the
 * primary button carries weight. Contrast on the four pairs this introduces, computed:
 * bone-on-ocean 13.53:1 (BONE), mineral-on-obsidian 17.55:1 (MINERAL, SAND),
 * obsidian-on-bone 18.80:1 (DEEP, INK) — every one far past AA.
 */
const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-surface-inverse text-ink-inverse hover:brightness-125',
  secondary: 'bg-transparent text-ink border border-line-strong hover:bg-surface-raised',
  ghost: 'bg-transparent text-ink-secondary hover:text-ink hover:bg-surface-raised',
  quiet: 'bg-surface-raised-2 text-ink hover:brightness-110',
  danger: 'bg-transparent text-state-danger border border-state-danger hover:bg-state-danger-soft',
}

/**
 * `sm` is 36px tall, below the 44px touch minimum, so it earns its hit box from a
 * ::before overlay (the `rv-hit-44` utility in base.css) rather than by growing.
 */
const SIZE: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-sm rv-hit-44',
  md: 'h-11 px-6 text-base',
  lg: 'h-13 px-8 text-base',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Swaps the label for a Spinner, fixes the width, and sets aria-busy. */
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, disabled, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      // A loading button stays focusable and keeps its accessible name; it is disabled
      // so it cannot be re-submitted, and aria-busy tells assistive tech why.
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      className={cn(
        // PILL, NOT `rounded-sm` (amendment A46). Every control the reference offers is
        // `rounded-full` while its surfaces stay near-square at 0/2/4/8px — the roundness is
        // confined to things you press, which is what makes a pressable thing legible as one.
        // --rv-radius-pill (999px) already existed and had no consumer.
        'relative inline-flex items-center justify-center gap-2 rounded-pill',
        'font-medium whitespace-nowrap',
        // Parentheses, not brackets. In Tailwind 4 `duration-[--rv-duration-fast]` is an
        // arbitrary VALUE and compiles to `transition-duration: --rv-duration-fast`, which is
        // invalid CSS the browser drops — leaving no transition at all, silently.
        // `duration-(--rv-duration-fast)` is the variable reference and compiles to `var(...)`.
        'transition-[color,background-color,border-color] duration-(--rv-duration-fast) ease-standard',
        // Never opacity: 0.5 — that drags the contrast ratio below the disabled exemption.
        'disabled:cursor-not-allowed disabled:text-ink-disabled disabled:border-line',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <>
          <Spinner size="sm" />
          {/* The label stays in the accessible tree so the name does not change mid-action. */}
          <span className="sr-only">{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  )
})
