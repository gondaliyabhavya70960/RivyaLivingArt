import * as React from 'react'
import { cn } from '@/lib/ui/cn'

/**
 * ErrorText is the message under an invalid control (§7.4): text-sm, --rv-state-danger,
 * `role="alert"` so it is announced the moment it appears, and an icon.
 *
 * The icon is not decoration. WCAG 1.4.1 forbids colour as the only carrier of meaning,
 * and a red border plus red text is exactly that; the glyph and the sentence are what
 * actually say "this is wrong". It is `aria-hidden`, so the control's accessible
 * description stays the message and nothing else.
 */
export type ErrorTextProps = React.HTMLAttributes<HTMLParagraphElement>

export const ErrorText = React.forwardRef<HTMLParagraphElement, ErrorTextProps>(function ErrorText(
  { className, children, ...rest },
  ref,
) {
  return (
    <p
      ref={ref}
      role="alert"
      className={cn('flex items-start gap-2 text-sm text-state-danger', className)}
      {...rest}
    >
      <svg
        className="mt-0.5 size-4 shrink-0"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <circle cx="10" cy="10" r="7.25" />
        <path d="M10 6.25v4.25" strokeLinecap="round" />
        <path d="M10 13.5h.01" strokeLinecap="round" />
      </svg>
      <span>{children}</span>
    </p>
  )
})
