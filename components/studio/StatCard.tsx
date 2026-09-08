import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'

/**
 * One number on the dashboard — or an honest statement of why there is no number.
 *
 * THE WHOLE POINT IS THAT IT REFUSES TO RENDER A ZERO IT CANNOT SOURCE. Three states, and the
 * distinction is not cosmetic:
 *
 *   a number      — a query returned it.
 *   `unavailable` — the table does not exist yet. Shows the phase that creates it.
 *   `unreadable`  — the table exists and the count failed.
 *
 * Collapsing either of the latter into `0` asserts a business fact. "Open enquiries: 0" reads as
 * "nobody has enquired", and when the truth is "enquiries do not exist until Phase 20" that is a
 * fabrication — which D10 forbids, and which an owner would have no way to detect.
 *
 * `value` is therefore `number | null | undefined` with three meanings rather than a number with a
 * default, because a default is exactly how the zero would get back in.
 */
export function StatCard({
  label,
  value,
  unavailableFromPhase,
  unavailableLabel,
  unreadableLabel,
}: {
  /** Resolved copy. Never a literal at the call site. */
  label: string
  /** A count, `null` when the read failed, `undefined` when there was nothing to read. */
  value: number | null | undefined
  /** When set, the card is not available yet and this phase will make it so. */
  unavailableFromPhase?: number
  unavailableLabel: string
  unreadableLabel: string
}) {
  return (
    <Surface level={1} className="h-full p-4">
      <Stack gap={1}>
        <Text size="2xs" uppercase tone="tertiary">
          {label}
        </Text>

        {unavailableFromPhase !== undefined ? (
          <Text size="sm" tone="secondary">
            {unavailableLabel} {String(unavailableFromPhase).padStart(2, '0')}
          </Text>
        ) : value === null || value === undefined ? (
          <Text size="sm" tone="secondary">
            {unreadableLabel}
          </Text>
        ) : (
          // en-IN, so 1,00,000 groups the way every reader of this Studio expects.
          <Heading level={2} size="display-sm">
            {value.toLocaleString('en-IN')}
          </Heading>
        )}
      </Stack>
    </Surface>
  )
}
