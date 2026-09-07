import * as React from 'react'
import { cn } from '@/lib/ui/cn'

/**
 * Badge is the status pill of §2.9: a soft state surface, a hairline border in the state
 * colour, and the status WORD in --rv-ink-primary. All three, always.
 *
 * THE WORD IS NOT OPTIONAL. WCAG 1.4.1 forbids colour as the only carrier of meaning, and
 * a green pill with nothing in it is exactly that. §2.9 says it plainly — "removing the
 * word is not a permitted variant" — so `children` is a required prop and a badge with no
 * content does not compile.
 *
 * The word itself is never written here (§2 rule 2). `DRAFT`, `REVIEW`, `APPROVED`,
 * `PUBLISHED`, `ARCHIVED` and the owner-verification states are enum values; their human
 * labels come from `global_content`, and the mapping from enum to `tone` belongs to the
 * caller that knows which enum it is holding.
 *
 * NO FILLED VARIANT. §2.9 mentions one for `PUBLISHED`, but §2.6-§2.9 measure no ink
 * against a state colour used as a fill, and rule 3 of §2 is that an unmeasured pairing is
 * not a permitted pairing. It stays unbuilt until the ratio exists rather than guessed.
 *
 * The ink is --rv-ink-primary on every tone: 14.82-17.50 against the soft surfaces (§2.9).
 * The border is the state colour, which is what separates two adjacent pills and what
 * carries the state at a glance for a sighted user without carrying it alone.
 */
export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const TONE: Record<BadgeTone, string> = {
  // DRAFT, ARCHIVED and NOT_REQUIRED (§2.9): a raised surface and a control-grade line,
  // because there is no such thing as a neutral hue in this palette.
  neutral: 'bg-surface-raised-2 border-line-strong',
  success: 'bg-state-success-soft border-state-success',
  warning: 'bg-state-warning-soft border-state-warning',
  danger: 'bg-state-danger-soft border-state-danger',
  info: 'bg-state-info-soft border-state-info',
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  /** The status word. Required: state may never be carried by colour alone (§2.9). */
  children: React.ReactNode
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { tone = 'neutral', className, children, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(
        // Not interactive, so no 44px hit box: §7's touch minimum governs controls, and a
        // status pill is read, not pressed. A pill that can be clicked is a filter chip.
        'inline-flex items-center gap-1 rounded-pill border px-3 py-1',
        'text-xs leading-(--rv-leading-xs) font-medium text-ink',
        TONE[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  )
})
