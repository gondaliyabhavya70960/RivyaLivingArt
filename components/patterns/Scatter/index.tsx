import { ChartFrame } from '@/components/patterns/charts/shared'

/**
 * RC-320 `Scatter` — points on two axes. The accessible table lists every point's pair, because a
 * scatter has no honest one-column summary.
 */
export interface ScatterDatum {
  readonly id: string
  readonly x: number
  readonly y: number
}

export function Scatter({
  label,
  tableCaption,
  axisLabels,
  points,
  testId,
}: {
  readonly label: string
  readonly tableCaption: string
  readonly axisLabels: readonly [string, string]
  readonly points: readonly ScatterDatum[]
  readonly testId?: string
}) {
  const width = 480
  const height = 240
  const pad = 28
  const maxX = Math.max(1, ...points.map((point) => point.x))
  const maxY = Math.max(1, ...points.map((point) => point.y))
  const rows = points.map((point) => ({
    label: `${String(point.x)} × ${String(point.y)}`,
    value: point.y,
  }))
  return (
    <ChartFrame
      label={label}
      tableCaption={tableCaption}
      columns={axisLabels}
      rows={rows}
      testId={testId}
    >
      <svg
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        className="h-auto w-full"
        aria-hidden="true"
      >
        <line
          x1={pad}
          y1={height - pad}
          x2={width}
          y2={height - pad}
          className="stroke-ink-tertiary"
        />
        <line x1={pad} y1={0} x2={pad} y2={height - pad} className="stroke-ink-tertiary" />
        {points.map((point) => (
          <circle
            key={point.id}
            cx={pad + ((width - pad) * point.x) / maxX}
            cy={height - pad - ((height - pad) * point.y) / maxY}
            r={3}
            className="fill-ink-accent"
            data-point={point.id}
          />
        ))}
        <text x={width - 4} y={height - 8} textAnchor="end" className="fill-ink-secondary text-xs">
          {axisLabels[0]}
        </text>
        <text x={pad + 4} y={10} className="fill-ink-secondary text-xs">
          {axisLabels[1]}
        </text>
      </svg>
    </ChartFrame>
  )
}
