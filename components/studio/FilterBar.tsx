import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'

/**
 * Filters, with the URL as the state.
 *
 * `searchParams` ARE THE STATE. Not a convention worth restating in every phase — a consequence.
 * Because the filter lives in the URL, a filtered view can be linked to a colleague, survives a
 * reload, is reachable with the back button, and can be rendered entirely on the server. Client
 * state buys an instant update and loses all four, and the loss is invisible until somebody pastes
 * a link that opens on the wrong data.
 *
 * IT SUBMITS WITH GET, so the browser builds the query string. That is why it works without
 * JavaScript, and why there is no `onChange` anywhere in this file: this is a form, and a form
 * already knows how to put its fields into a URL.
 */
export function FilterBar({
  label,
  action,
  children,
  applyLabel,
  activeCount,
  activeLabel,
}: {
  /** Names the form for a screen reader. Resolved copy. */
  label: string
  /** The path to submit to — the current route. */
  action: string
  children: React.ReactNode
  applyLabel: string
  /** How many filters are on. Shown so "no results" is never mistaken for "no data". */
  activeCount?: number
  activeLabel?: string
}) {
  return (
    <form method="get" action={action} aria-label={label}>
      <Stack gap={2}>
        <div className="flex flex-wrap items-end gap-3">
          {children}
          <button type="submit" className="rounded-sm underline underline-offset-4">
            <Text as="span" size="sm">
              {applyLabel}
            </Text>
          </button>
        </div>

        {/* The count is not decoration. An empty table under an active filter is the single most
            common way somebody concludes their records have been deleted. */}
        {activeCount !== undefined && activeCount > 0 && activeLabel !== undefined && (
          <Text size="xs" tone="tertiary">
            {activeLabel} {activeCount}
          </Text>
        )}
      </Stack>
    </form>
  )
}
