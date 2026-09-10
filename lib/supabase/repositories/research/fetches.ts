import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research fetch'

export type ResearchFetchRow = Database['public']['Tables']['research_fetches']['Row']

const FETCH_COLUMNS =
  'id, run_id, source_id, work_item_id, url, final_url, http_status, robots_decision, ' +
  'content_hash, bytes, duration_ms, storage_key, fetched_at, error'

/**
 * Record one attempt — including the attempts that were refused before any packet left.
 *
 * A `DISALLOWED` ROW IS THE MOST IMPORTANT ROW THIS TABLE HOLDS. Without it, "robots said no so we
 * did not fetch" and "we never looked at that URL" are indistinguishable, and the first is the one
 * that demonstrates the rules were honoured. The row-level constraint refuses a DISALLOWED row
 * carrying a status, a hash or a storage key, so a bug cannot record a refusal that also somehow
 * came back with a page.
 */
export async function recordFetch(
  admin: Client,
  input: {
    readonly runId: string | null
    readonly sourceId: string
    readonly workItemId: string | null
    readonly url: string
    readonly finalUrl: string | null
    readonly httpStatus: number | null
    readonly robotsDecision: 'ALLOWED' | 'DISALLOWED' | 'NO_ROBOTS' | 'ERROR'
    readonly contentHash: string | null
    readonly bytes: number | null
    readonly durationMs: number | null
    readonly storageKey: string | null
    readonly error: string | null
  },
): Promise<string> {
  const { data, error } = await admin
    .from('research_fetches')
    .insert({
      run_id: input.runId,
      source_id: input.sourceId,
      work_item_id: input.workItemId,
      url: input.url,
      final_url: input.finalUrl,
      http_status: input.httpStatus,
      robots_decision: input.robotsDecision,
      content_hash: input.contentHash,
      bytes: input.bytes,
      duration_ms: input.durationMs,
      storage_key: input.storageKey,
      error: input.error,
    })
    .select('id')
    .single()
  if (error !== null) throw toRepositoryError(ENTITY, 'record', input.url, error)
  return data.id
}

export async function listFetchesForRun(
  client: Client,
  runId: string,
  limit = 100,
): Promise<ResearchFetchRow[]> {
  const { data, error } = await client
    .from('research_fetches')
    .select(FETCH_COLUMNS)
    .eq('run_id', runId)
    .order('fetched_at', { ascending: false })
    .limit(limit)
  if (error) throw toRepositoryError(ENTITY, 'list', runId, error)
  return (data ?? []) as unknown as ResearchFetchRow[]
}

/**
 * Snapshots older than the retention window, oldest first.
 *
 * IT RETURNS THE KEYS AND DOES NOT DELETE THEM. The pruner deletes the OBJECT first and clears the
 * row second, in that order — the other way round loses the key and leaves the object orphaned in
 * the bucket forever, which is the failure mode that turns a retention policy into a slowly
 * growing bill nobody can explain.
 */
export async function listExpiredSnapshots(
  admin: Client,
  before: Date,
  limit = 500,
): Promise<Array<{ id: string; storage_key: string }>> {
  const { data, error } = await admin
    .from('research_fetches')
    .select('id, storage_key')
    .not('storage_key', 'is', null)
    .lt('fetched_at', before.toISOString())
    .order('fetched_at', { ascending: true })
    .limit(limit)
  if (error) throw toRepositoryError(ENTITY, 'list', 'expired', error)
  return (data ?? []).filter(
    (row): row is { id: string; storage_key: string } => row.storage_key !== null,
  )
}

/** Forget a snapshot's key once its object is gone. The fetch row itself is history and stays. */
export async function clearSnapshotKey(admin: Client, id: string): Promise<void> {
  const { error } = await admin.from('research_fetches').update({ storage_key: null }).eq('id', id)
  if (error) throw toRepositoryError(ENTITY, 'prune', id, error)
}
