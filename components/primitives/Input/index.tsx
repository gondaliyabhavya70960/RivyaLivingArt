import * as React from 'react'
import { cn } from '@/lib/ui/cn'

/**
 * Input renders <input>. §7.5 fixes the box: 44px tall, --rv-surface-raised, a hairline
 * --rv-line-strong border (measured at 3:1 or better on every ground an input sits on,
 * §2.6/§2.7), --rv-radius-sm, --rv-space-4 inline padding.
 *
 * Block padding is the height. --rv-space-3 above and below a 16px line is exactly the
 * 44px box, and declaring both would clip the dense 36px one.
 *
 * A placeholder is never a label (§7). It is a format hint in --rv-ink-tertiary, and the
 * label lives in <Field>.
 */
export type InputSize = 'sm' | 'md'

/**
 * `sm` is the Studio dense-table box, and it is 36px only where there is a pointer.
 * Below --rv-bp-md it stays 44px at text-base, for two reasons that are not negotiable:
 * a control under 44px fails FEAT §48's touch minimum, and type under 16px makes iOS
 * Safari zoom the page on focus. An <input> is a replaced element and cannot carry the
 * ::before that `rv-hit-44` uses, so the height itself has to earn the hit box.
 */
const SIZE: Record<InputSize, string> = {
  sm: 'h-11 text-base md:h-9 md:text-sm',
  md: 'h-11 text-base',
}

/** aria-invalid is enumerated: only absent and 'false' mean valid. */
function isInvalid(value: React.AriaAttributes['aria-invalid']): boolean {
  return value !== undefined && value !== false && value !== 'false'
}

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Visual size. `sm` is the Studio dense-table box (§7.5), desktop only. */
  size?: InputSize
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', className, 'aria-invalid': ariaInvalid, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={ariaInvalid}
      className={cn(
        'w-full rounded-sm border border-line-strong bg-surface-raised px-4 text-ink',
        'placeholder:text-ink-tertiary',
        // LIGHT class (§4.2): colour and border only, never a layout property.
        'transition-[color,background-color,border-color] duration-[--rv-duration-fast] ease-standard',
        'focus:border-ink-accent',
        // Never opacity: 0.5 — that drags the contrast below the disabled exemption.
        'disabled:cursor-not-allowed disabled:border-line disabled:text-ink-disabled',
        SIZE[size],
        // The border is a reinforcement, not the affordance: Field also renders an
        // ErrorText with an icon and points aria-describedby at it (WCAG 1.4.1).
        isInvalid(ariaInvalid) && 'border-state-danger',
        className,
      )}
      {...rest}
    />
  )
})
