import { ChartFrame, type ChartDatum } from '@/components/patterns/charts/shared'

/**
 * RC-321 `Sparkline` — a single line over an ordered series. Renders a single point, not a line,
 * when the series has fewer than two entries: a trend through one value is a projection, and this
 * phase never projects.
 */
export function Sparkline({
  label,
  tableCaption,
  columns,
  data,
  testId,
}: {
  readonly label: string
  readonly tableCaption: string
  readonly columns: readonly [string, string]
  readonly data: readonly ChartDatum[]
  readonly testId?: string
}) {
  const width = 240
  const height = 48
  const max = Math.max(1, ...data.map((datum) => datum.value))
  const min = Math.min(0, ...data.map((datum) => datum.value))
  const span = Math.max(1, max - min)
  const step = data.length <= 1 ? 0 : width / (data.length - 1)
  const coords = data.map((datum, index) => ({
    x: index * step,
    y: height - ((datum.value - min) / span) * height,
  }))
  return (
    <ChartFrame
      label={label}
      tableCaption={tableCaption}
      columns={columns}
      rows={data}
      testId={testId}
    >
      <svg
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        className="h-12 w-full"
        aria-hidden="true"
      >
        {coords.length >= 2 ? (
          <polyline
            points={coords.map((point) => `${String(point.x)},${String(point.y)}`).join(' ')}
            fill="none"
            className="stroke-ink-accent"
            strokeWidth={2}
          />
        ) : null}
        {coords.map((point, index) => (
          <circle
            key={data[index]?.label ?? index}
            cx={point.x}
            cy={point.y}
            r={2.5}
            className="fill-ink-accent"
          />
        ))}
      </svg>
    </ChartFrame>
  )
}
