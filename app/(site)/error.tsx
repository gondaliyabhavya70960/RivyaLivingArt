'use client'

import type * as React from 'react'

import { ErrorSurface } from '@/components/patterns/ErrorSurface'
import { useSiteErrorCopy } from '@/components/patterns/SiteErrorCopy'

/**
 * A public page that threw (SEED §46).
 *
 * A CLIENT COMPONENT BECAUSE NEXT REQUIRES IT. `reset` is a callback, so an error boundary cannot
 * be a Server Component — which is also why its copy arrives through `SiteErrorCopyProvider`
 * rather than from a query. See that file for why one small island was the right price.
 *
 * NO MEDIA, DELIBERATELY. If media delivery is what failed, a 500 page with an image is a 500 page
 * that fails too. `ErrorSurface` is tokens and type only.
 *
 * IT NEVER RENDERS `error.message`. Next replaces the message with a digest in production but not
 * in development, so the real text is visible while you build and one deploy away from a visitor's
 * screen. The digest is what correlates this page with a server log, and it is the only part a
 * reader can act on.
 *
 * `reset()` RE-RUNS THE RENDER; it does not reload the page. That is the right primary action for
 * a transient failure — a query that timed out succeeds on the second attempt without the visitor
 * losing their place — and it is why the label is "Try Again" rather than "Reload".
 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}): React.ReactElement {
  const copy = useSiteErrorCopy()

  const actions = [
    ...(copy.tryAgain === null ? [] : [{ label: copy.tryAgain, onClick: reset }]),
    ...(copy.returnHome === null ? [] : [{ label: copy.returnHome, href: '/' }]),
  ]

  return (
    <ErrorSurface
      heading={copy.heading}
      body={copy.body}
      actions={actions}
      reference={error.digest ?? null}
      referenceLabel={copy.referenceLabel}
    />
  )
}
