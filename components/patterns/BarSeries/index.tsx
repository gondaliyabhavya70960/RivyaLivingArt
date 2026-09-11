import { ChartFrame, type ChartDatum } from '@/components/patterns/charts/shared'

/**
 * RC-318 `BarSeries` — horizontal bars, one per label, every label drawn even at zero.
 *
 * A distribution that renders only the buckets with rows changes shape as it fills, and the shape
 * is what a person is reading. So the caller passes the full bucket list and this draws all of it.
 */
export function BarSeries({
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
  const max = Math.max(1, ...data.map((datum) => datum.value))
  const rowHeight = 18
  const gap = 6
  const labelWidth = 120
  const width = 480
  const height = data.length * (rowHeight + gap)
  return (
    <ChartFrame
      label={label}
      tableCaption={tableCaption}
      columns={columns}
      rows={data}
      testId={testId}
    >
      <svg
        viewBox={`0 0 ${String(width)} ${String(Math.max(height, rowHeight))}`}
        className="text-ink-accent h-auto w-full"
        aria-hidden="true"
      >
        {data.map((datum, index) => {
          const y = index * (rowHeight + gap)
          const barWidth = ((width - labelWidth - 48) * datum.value) / max
          return (
            <g key={datum.label} data-bar={datum.label}>
              <text x={0} y={y + rowHeight - 5} className="fill-ink-secondary text-xs">
                {datum.label}
              </text>
              <rect
                x={labelWidth}
                y={y}
                width={Math.max(0, barWidth)}
                height={rowHeight}
                rx={2}
                fill="currentColor"
              />
              <text
                x={labelWidth + Math.max(0, barWidth) + 6}
                y={y + rowHeight - 5}
                className="fill-ink text-xs tabular-nums"
              >
                {String(datum.value)}
              </text>
            </g>
          )
        })}
      </svg>
    </ChartFrame>
  )
}
