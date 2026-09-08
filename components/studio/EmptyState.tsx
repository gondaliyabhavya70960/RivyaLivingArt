import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'

/**
 * What a surface shows when it has nothing to show.
 *
 * THREE EMPTINESSES, AND CONFLATING THEM IS THE BUG. A table with no rows can mean:
 *
 *   `empty`       — nothing has been created yet. An invitation.
 *   `filtered`    — things exist, this filter excludes them. Telling someone "no products" when
 *                   they have a status filter on is how people conclude their data is gone.
 *   `unreadable`  — the query failed. Showing "nothing yet" here is the interface asserting a
 *                   business fact that is not true, and it cannot be corrected from, because the
 *                   reader has no way to tell it apart from a real zero.
 *
 * The `reason` prop makes the caller choose. A single "No results" component would let all three
 * collapse into the most reassuring one, which is the least honest one.
 *
 * NEVER "COMING SOON" — SEED §55. A surface that is not built says which phase builds it (that is
 * StudioPage's stub notice); a surface that is built and empty says so plainly.
 */
export type EmptyReason = 'empty' | 'filtered' | 'unreadable'

export function EmptyState({
  reason,
  heading,
  body,
  action,
}: {
  reason: EmptyReason
  /** Resolved copy, from components/studio/strings.ts. Never a literal at the call site. */
  heading: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <Surface level={1} className="p-8">
      <Stack gap={2} className="max-w-prose">
        <Heading level={2} size="display-xs">
          {heading}
        </Heading>
        {/* `unreadable` is not a quieter tone than the others: a failed read is the one case the
            reader must not skim past, because everything else on the page is still rendering
            normally around it. */}
        <Text tone={reason === 'unreadable' ? 'primary' : 'secondary'}>{body}</Text>
        {action}
      </Stack>
    </Surface>
  )
}
