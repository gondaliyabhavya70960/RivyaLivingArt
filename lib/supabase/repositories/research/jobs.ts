import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research job'

export type ResearchJobRow = Database['public']['Tables']['research_jobs']['Row']

const JOB_COLUMNS =
  'id, source_id, job_type, name, scope, cron_expression, next_run_at, is_enabled, max_urls, ' +
  'status, created_at, updated_at, updated_by'

export async function listResearchJobs(client: Client): Promise<ResearchJobRow[]> {
  const { data, error } = await client
    .from('research_jobs')
    .select(JOB_COLUMNS)
    .order('name', { ascending: true })
  if (error) throw toRepositoryError(ENTITY, 'list', 'all', error)
  return (data ?? []) as unknown as ResearchJobRow[]
}

export async function getResearchJob(client: Client, id: string): Promise<ResearchJobRow | null> {
  const { data, error } = await client
    .from('research_jobs')
    .select(JOB_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw toRepositoryError(ENTITY, 'get', id, error)
  return (data ?? null) as unknown as ResearchJobRow | null
}

/**
 * Jobs whose time has come.
 *
 * THE SOURCE GATE IS A JOIN, NOT A SECOND QUERY. A due job on a disabled or unapproved source must
 * not be promoted into a run at all: creating the run and refusing to drain it would leave a
 * QUEUED row that never moves and a dashboard reporting work that will never happen. Filtering
 * here means an unapproved source produces no runs rather than stuck ones.
 */
export async function listDueJobs(admin: Client): Promise<ResearchJobRow[]> {
  const { data, error } = await admin
    .from('research_jobs')
    .select(`${JOB_COLUMNS}, research_sources!inner(is_enabled, policy_status)`)
    .eq('is_enabled', true)
    .lte('next_run_at', new Date().toISOString())
    .eq('research_sources.is_enabled', true)
    .eq('research_sources.policy_status', 'APPROVED')
    .order('next_run_at', { ascending: true })
  if (error) throw toRepositoryError(ENTITY, 'list', 'due', error)
  return (data ?? []) as unknown as ResearchJobRow[]
}

export async function setJobNextRunAt(
  admin: Client,
  id: string,
  nextRunAt: Date | null,
): Promise<void> {
  const { error } = await admin
    .from('research_jobs')
    .update({ next_run_at: nextRunAt?.toISOString() ?? null })
    .eq('id', id)
  if (error) throw toRepositoryError(ENTITY, 'schedule', id, error)
}

export async function createResearchJob(
  client: Client,
  input: {
    readonly sourceId: string
    readonly jobType: Database['public']['Enums']['research_job_type']
    readonly name: string
    readonly scope: Record<string, unknown>
    readonly cronExpression: string | null
    readonly maxUrls: number | null
    readonly actorId: string
  },
): Promise<string> {
  const { data, error } = await client
    .from('research_jobs')
    .insert({
      source_id: input.sourceId,
      job_type: input.jobType,
      name: input.name,
      scope: input.scope as never,
      cron_expression: input.cronExpression,
      max_urls: input.maxUrls,
      updated_by: input.actorId,
    })
    .select('id')
    .single()
  if (error) throw toRepositoryError(ENTITY, 'create', input.name, error)
  return data.id
}
