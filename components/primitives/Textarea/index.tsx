import * as React from 'react'
import { cn } from '@/lib/ui/cn'

/**
 * Textarea is Input's box with §7.5's three differences: min-height 7.5rem, vertical
 * resize only (horizontal resize breaks the --rv-measure-prose measure), and
 * `field-sizing: content` where the browser supports it, so the box grows with the answer
 * instead of forcing a scroll inside a scroll.
 *
 * Height is not fixed, so the block padding is declared: --rv-space-3 block,
 * --rv-space-4 inline. Type never drops below --rv-text-base — 16px is what stops iOS
 * Safari zooming the page on focus.
 */

/** aria-invalid is enumerated: only absent and 'false' mean valid. */
function isInvalid(value: React.AriaAttributes['aria-invalid']): boolean {
  return value !== undefined && value !== false && value !== 'false'
}

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, 'aria-invalid': ariaInvalid, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={ariaInvalid}
      className={cn(
        'w-full min-h-30 resize-y field-sizing-content rounded-sm border border-line-strong',
        'bg-surface-raised px-4 py-3 text-base text-ink placeholder:text-ink-tertiary',
        // LIGHT class (§4.2): colour and border only, never a layout property.
        // duration-(--var) is the CSS-variable form; duration-[--var] emits a bare
        // `transition-duration: --rv-duration-fast`, which is invalid and silently
        // drops the transition. Do not "tidy" the parentheses into brackets.
        'transition-[color,background-color,border-color] duration-(--rv-duration-fast) ease-standard',
        'focus:border-ink-accent',
        // Never opacity: 0.5 — that drags the contrast below the disabled exemption.
        'disabled:cursor-not-allowed disabled:border-line disabled:text-ink-disabled',
        // The border is a reinforcement, not the affordance: Field also renders an
        // ErrorText with an icon and points aria-describedby at it (WCAG 1.4.1).
        isInvalid(ariaInvalid) && 'border-state-danger',
        className,
      )}
      {...rest}
    />
  )
})
