import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { StudioActionLink } from '@/components/studio/StudioAction'

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
 *
 * PHASE B GAVE IT A NEXT STEP — §3.5: "Empty states are honest but not actionable. Correct copy.
 * Weak next step." A zero-product catalogue that only says it is empty makes the reader go and find
 * the route themselves, on a phone, through a fifty-leaf tree.
 *
 * ONE CTA, AND THE TYPE IS WHAT ENFORCES IT. `actionHref` and `actionLabel` arrive as a pair or not
 * at all, and there is no second pair — a screen with two primary actions has none, which is §8's
 * checklist rule stated from the other side. The free-form `action` node stays for the caller that
 * genuinely needs a form (a submit cannot be a link), and a caller passing both gets the typed CTA:
 * it is the one this component can reason about.
 *
 * NO CTA ON `unreadable`, EVER, AND IT IS NOT A STYLE CHOICE. A failed query means nobody knows
 * whether the list is empty; "Create the first one" under a read that did not complete invites a
 * duplicate of something already there. The rule is enforced here rather than left to each caller,
 * because the caller is exactly who is least likely to be thinking about it.
 */
export type EmptyReason = 'empty' | 'filtered' | 'unreadable'

export function EmptyState({
  reason,
  heading,
  body,
  action,
  actionHref,
  actionLabel,
}: {
  reason: EmptyReason
  /** Resolved copy, from components/studio/strings.ts. Never a literal at the call site. */
  heading: string
  body: string
  /** A form, or anything a link cannot be. Ignored when `actionHref` is given. */
  action?: React.ReactNode
  /** The one next step. A Studio route the manifest already declares — never a new one. */
  actionHref?: string
  actionLabel?: string
}) {
  /*
   * The pair, or nothing. A half-configured CTA — an href with no words, or words that go nowhere —
   * is a control a reader cannot use, and it would render without complaint.
   */
  const cta =
    reason !== 'unreadable' && actionHref !== undefined && actionLabel !== undefined ? (
      <StudioActionLink href={actionHref} label={actionLabel} tone="primary" />
    ) : null
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
        {/* One or the other, never both: two next steps is the same defect as none. */}
        {cta ?? (reason === 'unreadable' ? null : action)}
      </Stack>
    </Surface>
  )
}
