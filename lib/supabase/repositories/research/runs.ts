import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research run'

export type ResearchRunRow = Database['public']['Tables']['research_runs']['Row']
export type ResearchRunStatus = Database['public']['Enums']['research_run_status']

const RUN_COLUMNS =
  'id, job_id, source_id, status, trigger, requested_by, queued_at, started_at, finished_at, ' +
  'stats, error_summary, is_dry_run'

export async function listResearchRuns(client: Client, limit = 25): Promise<ResearchRunRow[]> {
  const { data, error } = await client
    .from('research_runs')
    .select(RUN_COLUMNS)
    .order('queued_at', { ascending: false })
    .limit(limit)
  if (error) throw toRepositoryError(ENTITY, 'list', 'recent', error)
  return (data ?? []) as unknown as ResearchRunRow[]
}

export async function getResearchRun(client: Client, id: string): Promise<ResearchRunRow | null> {
  const { data, error } = await client
    .from('research_runs')
    .select(RUN_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw toRepositoryError(ENTITY, 'get', id, error)
  return (data ?? null) as unknown as ResearchRunRow | null
}

/** Runs still owed work. Read at the top of every tick. */
export async function listActiveRuns(admin: Client): Promise<ResearchRunRow[]> {
  const { data, error } = await admin
    .from('research_runs')
    .select(RUN_COLUMNS)
    .in('status', ['QUEUED', 'RUNNING'])
    .order('queued_at', { ascending: true })
  if (error) throw toRepositoryError(ENTITY, 'list', 'active', error)
  return (data ?? []) as unknown as ResearchRunRow[]
}

/**
 * Is this job already running?
 *
 * OVERLAP PREVENTION, AND IT IS A READ BECAUSE THE ALTERNATIVE IS WORSE. A unique partial index on
 * `(job_id) where status in ('QUEUED','RUNNING')` would be stronger, and was considered — but it
 * would make a legitimate second run of a job whose first run is genuinely stuck impossible to
 * create without editing the first, which turns a recoverable operational problem into a database
 * one. The cost of the read is a duplicate run in the rare interleaving where two ticks promote
 * the same job; the work items are unique per `(run_id, url)` so the duplicate costs a second
 * fetch of the same page at worst, which the source's own delay still paces.
 */
export async function hasActiveRunForJob(admin: Client, jobId: string): Promise<boolean> {
  const { data, error } = await admin
    .from('research_runs')
    .select('id')
    .eq('job_id', jobId)
    .in('status', ['QUEUED', 'RUNNING'])
    .limit(1)
  if (error) throw toRepositoryError(ENTITY, 'check', jobId, error)
  return (data ?? []).length > 0
}

export async function createResearchRun(
  client: Client,
  input: {
    readonly jobId: string | null
    readonly sourceId: string
    readonly trigger: Database['public']['Enums']['research_trigger']
    readonly requestedBy: string | null
    readonly isDryRun: boolean
  },
): Promise<string> {
  const { data, error } = await client
    .from('research_runs')
    .insert({
      job_id: input.jobId,
      source_id: input.sourceId,
      trigger: input.trigger,
      requested_by: input.requestedBy,
      is_dry_run: input.isDryRun,
    })
    .select('id')
    .single()
  if (error) throw toRepositoryError(ENTITY, 'create', input.sourceId, error)
  return data.id
}

export async function markRunRunning(admin: Client, id: string): Promise<void> {
  const { error } = await admin
    .from('research_runs')
    .update({ status: 'RUNNING', started_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'QUEUED')
  if (error) throw toRepositoryError(ENTITY, 'start', id, error)
}

export async function finishResearchRun(
  admin: Client,
  id: string,
  input: {
    readonly status: ResearchRunStatus
    readonly stats: Record<string, number>
    readonly errorSummary: string | null
  },
): Promise<void> {
  const { error } = await admin
    .from('research_runs')
    .update({
      status: input.status,
      finished_at: new Date().toISOString(),
      stats: input.stats as never,
      error_summary: input.errorSummary,
    })
    .eq('id', id)
  if (error) throw toRepositoryError(ENTITY, 'finish', id, error)
}

/** Accumulate counters onto a run that is still going. */
export async function updateRunStats(
  admin: Client,
  id: string,
  stats: Record<string, number>,
): Promise<void> {
  const { error } = await admin
    .from('research_runs')
    .update({ stats: stats as never })
    .eq('id', id)
  if (error) throw toRepositoryError(ENTITY, 'stats', id, error)
}

/**
 * Cancel a run.
 *
 * IT DOES NOT STOP AN IN-FLIGHT FETCH, and pretending otherwise would be the lie. What it does is
 * set a status the lease function refuses to hand out work under and the drain loop re-reads
 * between items. So the effect is: at most one more page is fetched, and then nothing. The `.in`
 * guard makes cancelling a finished run a no-op rather than a status that contradicts its own
 * `finished_at`.
 */
export async function cancelResearchRun(client: Client, id: string): Promise<void> {
  const { error } = await client
    .from('research_runs')
    .update({ status: 'CANCELLED', finished_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['QUEUED', 'RUNNING'])
  if (error) throw toRepositoryError(ENTITY, 'cancel', id, error)
}

/** Just the status, for the between-items cancellation check. One column, on purpose. */
export async function readRunStatus(admin: Client, id: string): Promise<ResearchRunStatus | null> {
  const { data, error } = await admin
    .from('research_runs')
    .select('status')
    .eq('id', id)
    .maybeSingle()
  if (error) throw toRepositoryError(ENTITY, 'status', id, error)
  return (data?.status ?? null) as ResearchRunStatus | null
}
