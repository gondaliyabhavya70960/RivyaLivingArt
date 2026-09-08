import 'server-only'

import { createAdminClient } from '../supabase/admin'
import { createClient } from '../supabase/server'
import {
  insertActivityEvent,
  listActivityEvents,
  type ActivityEvent,
} from '../supabase/repositories/activity'
import { redact } from './redact'
import type { Role } from '../auth/permissions'
import type { Json } from '../supabase/database.types'

/**
 * The Studio activity feed: who changed what, for people.
 *
 * THREE LOGS, AND THIS IS THE ONE PEOPLE READ. `audit_logs` answers "was this allowed" and holds
 * denials, so it is owner/admin only. `system_logs` (Phase 41) answers "what did the machine do".
 * This one is visible to every staff role, which is precisely why it must never accumulate what
 * those two hold: a DENIED row here would tell a viewer who tried to do what, and an exception
 * message here would leak internals to everyone with a login.
 *
 * A CONTROLLED VOCABULARY, NOT FREE TEXT. `ActivityAction` is a union, so the feed can be filtered,
 * counted and translated. A feed whose `action` column is arbitrary strings becomes unqueryable
 * within a phase or two — every consumer ends up matching on prose — and that is the failure the
 * phase document names as "a firehose nobody reads".
 *
 * IT NEVER THROWS INTO THE CALLER. Like writeAudit, a failure to record must not fail the thing
 * being recorded: an activity outage that turns every successful publish into a 500 is a far worse
 * outcome than a missing feed row, and the row is recoverable from `audit_logs` while the outage is
 * not. Unlike writeAudit, the swallow here is genuinely cheap — nothing is enforced by this table.
 */

/**
 * Every action the feed can record.
 *
 * Extended by the phase that adds the surface, not by call sites inventing strings. `entity.verb`,
 * matching `audit_logs.action`, so the two logs can be read side by side for one record.
 */
export const ACTIVITY_ACTIONS = [
  'staff.invited',
  'staff.role-changed',
  'staff.status-changed',
  'preferences.updated',
] as const

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number]

export type ActivityEntry = {
  action: ActivityAction
  actorId: string | null
  actorRole: Role | null
  entityType?: string
  entityId?: string
  /**
   * The record's name AS IT IS NOW. Stored rather than joined, because the feed must still read
   * sensibly after the thing is renamed or deleted — a join would show today's name, or nothing.
   *
   * `null` is accepted as well as absent, because the column is nullable and callers usually have
   * a `string | null` from the record itself. Forcing every one of them to write `?? undefined` to
   * satisfy a narrower type would be ceremony that says nothing.
   */
  entityLabel?: string | null
  summary?: string | null
  metadata?: Record<string, unknown>
}

export async function logActivity(entry: ActivityEntry): Promise<void> {
  try {
    // Service role: the table has no authenticated insert policy. See the repository header.
    const admin = createAdminClient()
    await insertActivityEvent(admin, {
      actor_id: entry.actorId,
      actor_role: entry.actorRole,
      action: entry.action,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      entity_label: entry.entityLabel ?? null,
      summary: entry.summary ?? null,
      // Through redact() even though this is meant to be innocuous: `metadata` is the field a
      // future caller will reach for when they have "just a bit of context to attach", and the
      // whole table is readable by every staff role.
      metadata: (entry.metadata === undefined ? {} : redact(entry.metadata)) as Json,
    })
  } catch {
    // Deliberately swallowed. See the header: recording must never fail the thing being recorded.
  }
}

/**
 * Read the feed as the signed-in staff member.
 *
 * The cookie-bound client, so `activity.read` and RLS decide what comes back rather than this
 * function. Returns [] on failure rather than throwing: the feed is one panel on a dashboard, and
 * a panel that cannot load should not take the page down with it.
 */
export async function readActivityFeed(
  options: { limit?: number; entityType?: string } = {},
): Promise<{ events: ActivityEvent[]; failed: boolean }> {
  try {
    const supabase = await createClient()
    return { events: await listActivityEvents(supabase, options), failed: false }
  } catch {
    // `failed` is returned rather than swallowed into an empty list, because "nothing has happened
    // yet" and "the feed could not be read" are different things to show somebody, and showing the
    // first when the second is true is the interface telling a lie it cannot be corrected from.
    return { events: [], failed: true }
  }
}
