import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { EmptyState, type EmptyReason } from '@/components/studio/EmptyState'

/**
 * The Studio's table.
 *
 * A REAL `<table>`, not a grid of divs. Screen readers announce row and column position from the
 * element, "navigate by table" works, and the browser's own find-in-page behaves. A div grid can be
 * made to do some of that with ARIA and every phase after this one would have to remember to.
 *
 * IT TAKES AN EMPTY REASON, NOT A BOOLEAN. Zero rows means one of three different things — nothing
 * created yet, everything filtered out, or the query failed — and a table that renders the same
 * "No results" for all three teaches people that their data has vanished when a filter is on. See
 * `EmptyState`.
 *
 * SORTING AND PAGINATION LIVE IN THE URL, not here. `searchParams` are the state (Phase 05's
 * FilterBar rule), so a sorted view can be linked, reloaded and navigated back to. That is why this
 * component takes rendered rows rather than owning data fetching: the page fetches, having read the
 * URL, and this renders.
 */
export type Column<Row> = {
  /** Stable id, also the `searchParams` key when this column is sortable. */
  readonly id: string
  /** Resolved copy. Never a literal at the call site. */
  readonly header: string
  readonly cell: (row: Row) => React.ReactNode
  /** Right-align numbers so digits line up; never for text. */
  readonly numeric?: boolean
}

export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  empty,
}: {
  /** Names the table for a screen reader. Required: an unnamed table in a list of tables is a riddle. */
  caption: string
  columns: readonly Column<Row>[]
  rows: readonly Row[]
  rowKey: (row: Row) => string
  empty: { reason: EmptyReason; heading: string; body: string }
}) {
  if (rows.length === 0) {
    return <EmptyState reason={empty.reason} heading={empty.heading} body={empty.body} />
  }

  return (
    <Surface level={1} className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        {/* Visible rather than hidden: it is the table's title, and a sighted reader benefits from
            knowing what they are looking at as much as anyone else. */}
        <caption className="px-4 pt-4 pb-2 text-left">
          <Text size="2xs" uppercase tone="tertiary">
            {caption}
          </Text>
        </caption>
        <thead>
          <tr className="border-line border-b">
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={`px-4 py-2 ${column.numeric === true ? 'text-right' : ''}`}
              >
                <Text as="span" size="2xs" uppercase tone="tertiary">
                  {column.header}
                </Text>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-line border-b last:border-b-0">
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={`px-4 py-3 align-top ${column.numeric === true ? 'text-right tabular-nums' : ''}`}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Surface>
  )
}
