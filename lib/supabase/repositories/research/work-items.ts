import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research work item'

export type ResearchWorkItemRow = Database['public']['Tables']['research_work_items']['Row']

const ITEM_COLUMNS =
  'id, run_id, source_id, url, depth, state, lease_until, attempts, not_before_at, last_error, ' +
  'created_at'

/**
 * Queue URLs for a run.
 *
 * `ignoreDuplicates` RATHER THAN A PRE-READ. A discovery run finds the same product linked from
 * three category pages, and the unique index on `(run_id, url)` is what makes that one work item
 * instead of three. Checking first would be both slower and wrong — two invocations can pass the
 * check simultaneously — so the constraint decides and the upsert is told to expect it.
 */
export async function enqueueWorkItems(
  admin: Client,
  input: {
    readonly runId: string
    readonly sourceId: string
    readonly urls: readonly string[]
    readonly depth: number
    readonly notBefore: Date
  },
): Promise<number> {
  if (input.urls.length === 0) return 0

  const rows = input.urls.map((url) => ({
    run_id: input.runId,
    source_id: input.sourceId,
    url,
    depth: input.depth,
    not_before_at: input.notBefore.toISOString(),
  }))

  const { data, error } = await admin
    .from('research_work_items')
    .upsert(rows, { onConflict: 'run_id,url', ignoreDuplicates: true })
    .select('id')
  if (error) throw toRepositoryError(ENTITY, 'enqueue', input.runId, error)
  return (data ?? []).length
}

/**
 * Claim up to `limit` due items for one source.
 *
 * AN RPC, BECAUSE `for update skip locked` IS THE CONCURRENCY DESIGN and PostgREST cannot express
 * it. See `research_lease_work_items` in migration 0232: the function also re-checks the source's
 * own gates in the same statement, so there is no window between deciding a source may be fetched
 * and claiming its work.
 */
export async function leaseWorkItems(
  admin: Client,
  input: {
    readonly sourceId: string
    readonly limit: number
    readonly leaseSeconds: number
  },
): Promise<ResearchWorkItemRow[]> {
  const { data, error } = await admin.rpc('research_lease_work_items', {
    p_source_id: input.sourceId,
    p_limit: input.limit,
    p_lease_seconds: input.leaseSeconds,
  })
  if (error) throw toRepositoryError(ENTITY, 'lease', input.sourceId, error)
  return (data ?? []) as unknown as ResearchWorkItemRow[]
}

/** Return items whose holder died. Called once at the top of every tick. */
export async function reclaimExpiredLeases(admin: Client): Promise<number> {
  const { data, error } = await admin.rpc('research_reclaim_expired_leases')
  if (error) throw toRepositoryError(ENTITY, 'reclaim', 'expired', error)
  return typeof data === 'number' ? data : 0
}

/**
 * Release one item with its outcome.
 *
 * A RETRYABLE FAILURE GOES BACK TO `PENDING` WITH A LATER `not_before_at`; an exhausted one is
 * `FAILED` with the reason. Both write `last_error`, including the retryable case, so an operator
 * looking at a queue that is making no progress can see WHY without waiting for the attempts to
 * run out.
 */
export async function releaseWorkItem(
  admin: Client,
  input: {
    readonly id: string
    readonly state: 'DONE' | 'FAILED' | 'SKIPPED' | 'PENDING'
    readonly notBefore: Date | null
    readonly error: string | null
  },
): Promise<void> {
  const { error } = await admin
    .from('research_work_items')
    .update({
      state: input.state,
      lease_until: null,
      not_before_at: (input.notBefore ?? new Date()).toISOString(),
      last_error: input.error,
    })
    .eq('id', input.id)
  if (error) throw toRepositoryError(ENTITY, 'release', input.id, error)
}

export async function listWorkItems(
  client: Client,
  runId: string,
  limit = 200,
): Promise<ResearchWorkItemRow[]> {
  const { data, error } = await client
    .from('research_work_items')
    .select(ITEM_COLUMNS)
    .eq('run_id', runId)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw toRepositoryError(ENTITY, 'list', runId, error)
  return (data ?? []) as unknown as ResearchWorkItemRow[]
}

/** Queue depth by state, for the dashboard and for deciding whether a run is finished. */
export async function countWorkItemsByState(
  client: Client,
  runId: string,
): Promise<Record<string, number>> {
  const { data, error } = await client
    .from('research_work_items')
    .select('state')
    .eq('run_id', runId)
  if (error) throw toRepositoryError(ENTITY, 'count', runId, error)

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const key = String(row.state)
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

/** Queue depth across every active run — one number for the dashboard's headline. */
export async function countPendingWorkItems(client: Client): Promise<number> {
  const { count, error } = await client
    .from('research_work_items')
    .select('id', { count: 'exact', head: true })
    .eq('state', 'PENDING')
  if (error) throw toRepositoryError(ENTITY, 'count', 'pending', error)
  return count ?? 0
}

/** Reset every FAILED item on a run so an operator can try again after fixing a source. */
export async function retryFailedWorkItems(client: Client, runId: string): Promise<void> {
  const { error } = await client
    .from('research_work_items')
    .update({
      state: 'PENDING',
      attempts: 0,
      lease_until: null,
      not_before_at: new Date().toISOString(),
    })
    .eq('run_id', runId)
    .eq('state', 'FAILED')
  if (error) throw toRepositoryError(ENTITY, 'retry', runId, error)
}
