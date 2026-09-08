import * as React from 'react'
import { cn } from '@/lib/ui/cn'

/**
 * HelpText sits ABOVE the control (§7.4). That is the whole point of it: a format hint
 * read before the field is answered saves an error, one discovered underneath it does not.
 *
 * It is a paragraph, never a live region — help is not an interruption. The link to the
 * control is `aria-describedby` by id; <Field> owns that wiring, and a consumer using
 * HelpText on its own owns it instead. text-sm / --rv-ink-tertiary (§7.4).
 */
export type HelpTextProps = React.HTMLAttributes<HTMLParagraphElement>

export const HelpText = React.forwardRef<HTMLParagraphElement, HelpTextProps>(function HelpText(
  { className, children, ...rest },
  ref,
) {
  return (
    <p ref={ref} className={cn('text-sm text-ink-tertiary', className)} {...rest}>
      {children}
    </p>
  )
})
