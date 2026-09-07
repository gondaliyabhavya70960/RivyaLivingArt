import * as React from 'react'
import { cn } from '@/lib/ui/cn'

/**
 * Spinner is decorative by default: the surrounding control owns the accessible
 * status (Button sets aria-busy). Pass a `label` only when the spinner is the sole
 * indication that something is happening.
 */
export interface SpinnerProps {
  size?: 'sm' | 'md'
  label?: string
  className?: string
}

const SIZE = { sm: 'size-4', md: 'size-6' } as const

export function Spinner({ size = 'md', label, className }: SpinnerProps) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-hidden={label ? undefined : true}
      className={cn('inline-flex items-center', className)}
    >
      <svg
        className={cn('animate-spin', SIZE[size])}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <circle cx="12" cy="12" r="9" className="opacity-25" />
        <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  )
}
