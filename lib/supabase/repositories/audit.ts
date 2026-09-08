import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, Json } from '../database.types'
import { toRepositoryError } from './support'

type Client = SupabaseClient<Database>

/**
 * The only write path into `audit_logs`.
 *
 * `audit_logs` has no insert policy for `authenticated` at all, so the client passed here is always
 * the service-role one. That is a design decision rather than a convenience: an insert policy would
 * let any signed-in staff member forge entries — including ones implicating somebody else, or a
 * wall of noise to bury their own.
 *
 * There is deliberately no update or delete function, and there never will be. Both privileges are
 * revoked on the table in migration 0012, so one written here would fail anyway; the absence is
 * what says so to a reader.
 */

export type AuditRow = {
  action: string
  result: 'SUCCESS' | 'DENIED' | 'ERROR'
  actor_user_id: string | null
  actor_role: Database['public']['Enums']['user_role'] | null
  entity_type: string | null
  entity_id: string | null
  summary: string | null
  before: Json | null
  after: Json | null
  request_id: string | null
  ip: string | null
  user_agent: string | null
}

export async function insertAuditLog(client: Client, row: AuditRow): Promise<void> {
  const { error } = await client.from('audit_logs').insert(row)
  if (error) throw toRepositoryError('audit log', 'insert', row.action, error)
}
