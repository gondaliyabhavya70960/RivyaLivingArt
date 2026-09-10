'use client'

import * as React from 'react'

import { Button } from '@/components/primitives/Button'

/**
 * The poster, with either the way in or the reason there is none.
 *
 * NO `three` HERE. This is what a page shows BEFORE the viewer exists and AFTER it has failed, so
 * it must cost the page nothing: it is the one file under `components/three/**` the island imports
 * statically, and `tests/unit/model-policy.test.ts` checks that it stays engine-free.
 *
 * THE POSTER IS A CHILD, NOT A PROP. It is rendered by the server (`BlockImage`, with a real
 * srcset and the LCP-eligible markup every hero gets) and handed across the client boundary as
 * markup; this component never builds an image URL.
 */
export function PosterFallback({
  poster,
  reason,
  action,
}: {
  readonly poster: React.ReactNode
  /** Shown over the poster after a failure. Null while the viewer is merely not yet requested. */
  readonly reason: string | null
  readonly action: { readonly label: string; readonly onClick: () => void } | null
}): React.ReactElement {
  return (
    <div
      data-model-poster=""
      data-model-state={reason === null ? 'idle' : 'failed'}
      className="relative"
    >
      {poster}
      {action === null ? null : (
        <div className="absolute inset-x-0 bottom-0 flex justify-center p-4">
          <Button variant="primary" onClick={action.onClick} data-model-inspect="">
            {action.label}
          </Button>
        </div>
      )}
      {reason === null ? null : (
        <p
          role="status"
          data-model-reason=""
          className="absolute inset-x-4 bottom-4 rounded-sm bg-(--rv-3d-surface) px-3 py-2 text-sm text-(--rv-3d-ink)"
        >
          {reason}
        </p>
      )}
    </div>
  )
}
