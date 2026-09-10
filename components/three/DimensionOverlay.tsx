'use client'

import * as React from 'react'

import { DIMENSION_UNIT, dimensionEntries } from '@/lib/catalog/dimensions'
import type { DimensionKey } from '@/lib/catalog/dimensions'

/**
 * Owner-entered measurements beside the model. Exactly `products.dimensions`, nothing derived.
 *
 * THIS COMPONENT CANNOT SEE THE MODEL, and that is a property the unit suite asserts on the source:
 * no `three` import, no bounds, no scene. A bounding box is a fact about a file; a dimension is a
 * fact about a product, and only the owner supplies the second (D10). When the product has none,
 * the toggle that opens this panel is not rendered at all.
 */
export function DimensionOverlay({
  dimensions,
  heading,
  labels,
}: {
  readonly dimensions: unknown
  readonly heading: string
  readonly labels: Readonly<Partial<Record<DimensionKey, string>>>
}): React.ReactElement | null {
  const rows = dimensionEntries(dimensions).flatMap((entry) => {
    const label = labels[entry.key]
    if (label === undefined) return []
    const unit = DIMENSION_UNIT[entry.key]
    return [
      {
        key: entry.key,
        label,
        value: unit === null ? String(entry.value) : `${entry.value} ${unit}`,
      },
    ]
  })
  if (rows.length === 0) return null

  return (
    <section
      data-viewer-dimensions=""
      aria-label={heading}
      className="absolute top-4 right-4 max-w-56 rounded-sm bg-(--rv-3d-surface) p-3 text-(--rv-3d-ink)"
    >
      <h3 className="mb-2 text-xs tracking-wide uppercase text-(--rv-3d-ink-muted)">{heading}</h3>
      <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm">
        {rows.map((row) => (
          <React.Fragment key={row.key}>
            <dt className="text-(--rv-3d-ink-muted)">{row.label}</dt>
            <dd className="text-right tabular-nums">{row.value}</dd>
          </React.Fragment>
        ))}
      </dl>
    </section>
  )
}
