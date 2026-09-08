import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import type { Database, Json } from '../database.types'
import { ROLES } from '../../auth/permissions'
import { parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'activity event'

/**
 * Reads and the single write path for `activity_events`.
 *
 * TWO CLIENTS, TWO POLICIES, DELIBERATELY. `insertActivityEvent` is always handed the service-role
 * client — the table has no `authenticated` insert policy, for the same reason `audit_logs` has
 * none: a staff member who can insert here can write "editor published X" naming a colleague, and
 * the feed is the record people actually read. `listActivityEvents` is always handed the
 * cookie-bound one, so `activity.read` is what decides visibility rather than this function.
 *
 * There is no update and no delete, and there never will be. Both are revoked on the table in
 * migration 0020, so one written here would fail; the absence is what tells a reader that.
 */

export type ActivityInsert = {
  actor_id: string | null
  actor_role: Database['public']['Enums']['user_role'] | null
  action: string
  entity_type: string | null
  entity_id: string | null
  entity_label: string | null
  summary: string | null
  metadata: Json
}

export const activityEventSchema = z.object({
  id: z.uuid(),
  occurred_at: z.iso.datetime({ offset: true }),
  actor_id: z.uuid().nullable(),
  actor_role: z.enum(ROLES).nullable(),
  action: z.string(),
  entity_type: z.string().nullable(),
  entity_id: z.uuid().nullable(),
  entity_label: z.string().nullable(),
  summary: z.string().nullable(),
})

export type ActivityEvent = z.infer<typeof activityEventSchema>

const COLUMNS =
  'id, occurred_at, actor_id, actor_role, action, entity_type, entity_id, entity_label, summary'

export async function insertActivityEvent(client: Client, row: ActivityInsert): Promise<void> {
  const { error } = await client.from('activity_events').insert(row)
  if (error) throw toRepositoryError(ENTITY, 'insert', row.action, error)
}

/**
 * The feed. Newest first, capped.
 *
 * The cap is an argument with a default rather than a constant, and it is enforced here rather than
 * left to the caller: an uncapped feed query against a table that only ever grows is a page that
 * gets slower every week and is never noticed, because it degrades rather than breaks.
 */
export async function listActivityEvents(
  client: Client,
  options: { limit?: number; entityType?: string; actorId?: string } = {},
): Promise<ActivityEvent[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200)

  let query = client
    .from('activity_events')
    .select(COLUMNS)
    .order('occurred_at', { ascending: false })
    .limit(limit)

  if (options.entityType !== undefined) query = query.eq('entity_type', options.entityType)
  if (options.actorId !== undefined) query = query.eq('actor_id', options.actorId)

  const { data, error } = await query
  if (error) throw toRepositoryError(ENTITY, 'list', 'feed', error)
  return parseRows(ENTITY, activityEventSchema, data ?? [])
}
