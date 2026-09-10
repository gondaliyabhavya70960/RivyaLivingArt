'use client'

import { useProgress } from '@react-three/drei'
import * as React from 'react'

import { interpolate } from '@/lib/cms/strings'

/**
 * Real progress, not a spinner (PERFORMANCE.md §4.3).
 *
 * ANNOUNCED AT 0, 50 AND 100 ONLY. `aria-live="polite"` on a number that changes sixty times a
 * second is a screen reader reading digits for the whole download; three milestones say
 * "started", "halfway", "done" and nothing in between. The bar itself moves continuously.
 */
export function LoadingProgress({ template }: { readonly template: string }): React.ReactElement {
  const progress = useProgress((state) => state.progress)
  const percent = Math.max(0, Math.min(100, Math.round(progress)))
  const milestone = percent >= 100 ? 100 : percent >= 50 ? 50 : 0

  return (
    <div
      data-viewer-progress=""
      className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4"
    >
      <p
        aria-live="polite"
        className="rounded-sm bg-(--rv-3d-surface) px-3 py-1 text-sm text-(--rv-3d-ink) self-start"
      >
        {interpolate(template, { percent: String(milestone) })}
      </p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1 w-full overflow-hidden rounded-pill bg-(--rv-3d-progress-track)"
      >
        <div
          className="h-full bg-(--rv-3d-progress-fill) transition-[width] duration-(--rv-duration-fast)"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
