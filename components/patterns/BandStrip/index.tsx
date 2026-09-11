import { ChartFrame, type ChartDatum } from '@/components/patterns/charts/shared'

/**
 * RC-319 `BandStrip` — one horizontal strip cut into bands, each band's width proportional to its
 * count. The edges are printed between the segments so a reader sees the rule's output, not only
 * its effect.
 */
export interface BandDatum extends ChartDatum {
  readonly from: string
  readonly to: string
}

export function BandStrip({
  label,
  tableCaption,
  columns,
  bands,
  testId,
}: {
  readonly label: string
  readonly tableCaption: string
  readonly columns: readonly [string, string]
  readonly bands: readonly BandDatum[]
  readonly testId?: string
}) {
  const total = Math.max(
    1,
    bands.reduce((sum, band) => sum + band.value, 0),
  )
  const width = 480
  const height = 44
  // Segment starts, computed once before render rather than accumulated inside the map.
  const starts = bands.reduce<number[]>((acc, band, index) => {
    const previous =
      index === 0 ? 0 : (acc[index - 1] ?? 0) + (width * (bands[index - 1]?.value ?? 0)) / total
    acc.push(previous)
    return acc
  }, [])
  return (
    <ChartFrame
      label={label}
      tableCaption={tableCaption}
      columns={columns}
      rows={bands}
      testId={testId}
    >
      <svg
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        className="h-auto w-full"
        aria-hidden="true"
      >
        {bands.map((band, index) => {
          const w = (width * band.value) / total
          const start = starts[index] ?? 0
          return (
            <g key={band.label} data-band={band.label}>
              <rect
                x={start}
                y={0}
                width={w}
                height={24}
                className={index % 2 === 0 ? 'fill-ink-accent' : 'fill-ink-secondary'}
              />
              <text x={start + 4} y={40} className="fill-ink-secondary text-xs">
                {band.from}
              </text>
            </g>
          )
        })}
      </svg>
    </ChartFrame>
  )
}
