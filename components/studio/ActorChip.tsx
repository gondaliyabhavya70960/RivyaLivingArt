import { Text } from '@/components/primitives/Text'
import type { Role } from '@/lib/auth/permissions'

/**
 * Who did it.
 *
 * A NULL ACTOR IS NOT "UNKNOWN". Both logs record an actor that can legitimately be absent, and the
 * two cases mean different things: the seed runner and migrations write with no session at all
 * (DATA_MODEL §1.6 makes `updated_by IS NULL` mean exactly that), and a denial can be recorded
 * before any session resolves. Rendering either as "Unknown" invites someone to go looking for a
 * person who does not exist.
 *
 * IT SHOWS A ROLE, NOT AN EMAIL. `activity_events` stores the role held AT THE TIME and no address,
 * and that is the right amount: the feed is readable by every staff role, so it should not become a
 * directory of everybody's email. A name, when there is one, comes from the caller.
 */
export function ActorChip({
  role,
  name,
}: {
  /** The role held when the action happened, or null for a system write. */
  role: Role | null
  /** A display name, when the caller has one to hand. */
  name?: string | null
}) {
  if (role === null && (name === null || name === undefined)) {
    return (
      <Text as="span" size="xs" tone="tertiary">
        System
      </Text>
    )
  }

  return (
    <Text as="span" size="xs" tone="tertiary">
      {name ?? role}
      {name !== null && name !== undefined && role !== null ? ` · ${role}` : ''}
    </Text>
  )
}
