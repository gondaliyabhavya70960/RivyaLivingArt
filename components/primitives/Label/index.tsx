import * as React from 'react'
import { cn } from '@/lib/ui/cn'

/**
 * Label is the `label` type role (§3.5): body family, text-sm, weight 500,
 * --rv-ink-primary. It is a real <label>, so the association is `htmlFor` and nothing
 * else — a placeholder is never a label (§7).
 *
 * A required field is marked with the WORD, never an asterisk alone (§7.4). The word is
 * content, so it arrives as a prop from `global_content` rather than as a literal here
 * (§2 rule 2), and it renders INSIDE the <label> so it lands in the control's accessible
 * name instead of sitting beside it as decoration. The leading space text node is load
 * bearing: without it the name computes as "Full nameRequired".
 */
export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  /** Marks the field required. The marker renders only when `requiredLabel` is supplied. */
  required?: boolean
  /** The word rendered as the marker, e.g. "Required". Never invented by this component. */
  requiredLabel?: string
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { required = false, requiredLabel, className, children, ...rest },
  ref,
) {
  return (
    <label ref={ref} className={cn('text-sm font-medium text-ink', className)} {...rest}>
      {children}
      {required && requiredLabel ? (
        <>
          {' '}
          <span className="ml-2 font-normal text-ink-tertiary">{requiredLabel}</span>
        </>
      ) : null}
    </label>
  )
})
