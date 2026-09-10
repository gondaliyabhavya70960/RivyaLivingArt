import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research pipeline event'

export type ResearchPipelineEventRow =
  Database['public']['Tables']['research_pipeline_events']['Row']

/**
 * Append one pipeline event.
 *
 * SERVICE ROLE ONLY, LIKE `audit_logs` AND `activity_events`, and for the same reason: a signed-in
 * researcher able to insert here could write "the merchandiser confirmed this" naming somebody
 * else, into the record a person would read to check. Update and delete are revoked outright in
 * 0231, so even a policy added later by mistake could not rewrite one.
 *
 * `actor_kind` IS DERIVED FROM WHETHER THERE IS AN ACTOR, not passed in beside it. Two arguments
 * that must agree are two arguments that eventually will not, and the row-level CHECK would then
 * reject the write at the least useful moment. One argument, one truth: a stage move made by the
 * pipeline names nobody and is SYSTEM.
 */
export async function recordPipelineEvent(
  admin: Client,
  input: {
    readonly entityType: string
    readonly entityId: string
    readonly fromStage: Database['public']['Enums']['research_stage'] | null
    readonly toStage: Database['public']['Enums']['research_stage'] | null
    readonly actorUserId: string | null
    readonly reason: string | null
  },
): Promise<void> {
  const { error } = await admin.from('research_pipeline_events').insert({
    entity_type: input.entityType,
    entity_id: input.entityId,
    from_stage: input.fromStage,
    to_stage: input.toStage,
    actor_user_id: input.actorUserId,
    actor_kind: input.actorUserId === null ? 'SYSTEM' : 'STAFF',
    reason: input.reason,
  })
  if (error !== null) throw toRepositoryError(ENTITY, 'record', input.entityId, error)
}

/** Everything that ever happened to one row, newest first. */
export async function listPipelineEvents(
  client: Client,
  input: { readonly entityType: string; readonly entityId: string; readonly limit?: number },
): Promise<ResearchPipelineEventRow[]> {
  const { data, error } = await client
    .from('research_pipeline_events')
    .select('*')
    .eq('entity_type', input.entityType)
    .eq('entity_id', input.entityId)
    .order('occurred_at', { ascending: false })
    .limit(input.limit ?? 100)
  if (error) throw toRepositoryError(ENTITY, 'list', input.entityId, error)
  return (data ?? []) as unknown as ResearchPipelineEventRow[]
}
