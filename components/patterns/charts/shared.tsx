import type { ReactNode } from 'react'

/**
 * What every chart in `components/patterns/` shares, and the rule it enforces.
 *
 * NO CHART LIBRARY. These are inline SVG drawn from tokens — `fill="currentColor"` on elements
 * whose colour comes from a Tailwind text-colour utility, so the token layer decides every colour
 * and `scripts/design/check-tokens.mjs` has nothing to find. No runtime dependency, no client
 * bundle, no shape the data does not have.
 *
 * EVERY CHART IS `role="img"` WITH A LABEL, AND EVERY CHART RENDERS ITS DATA AS A TABLE TOO.
 * FEAT §48. The SVG is decorative for a screen reader; the table beside it (in a disclosure, so
 * it does not dominate visually) is the accessible form, and it is the same numbers — the table is
 * rendered from the same array the bars are, so the two cannot disagree.
 */

export interface ChartDatum {
  readonly label: string
  readonly value: number
}

export function ChartFrame({
  label,
  tableCaption,
  columns,
  rows,
  children,
  testId,
}: {
  /** The accessible name of the picture, in the reader's words. */
  readonly label: string
  readonly tableCaption: string
  readonly columns: readonly [string, string]
  readonly rows: readonly ChartDatum[]
  readonly children: ReactNode
  readonly testId?: string
}) {
  return (
    <figure className="flex flex-col gap-2" data-chart={testId ?? ''}>
      <div role="img" aria-label={label}>
        {children}
      </div>
      <details className="text-ink-secondary text-xs">
        <summary className="cursor-pointer">{tableCaption}</summary>
        <table className="mt-2 w-full text-left">
          <caption className="sr-only">{tableCaption}</caption>
          <thead>
            <tr>
              <th scope="col">{columns[0]}</th>
              <th scope="col" className="text-right">
                {columns[1]}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td className="text-right tabular-nums">{String(row.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
