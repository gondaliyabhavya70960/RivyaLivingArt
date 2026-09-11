import type { SupabaseClient } from '@supabase/supabase-js'

import type { ChangeField, Materiality } from '@/lib/scraper/analytics/materiality'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research change'

export type ChangeRow = Database['public']['Tables']['research_changes']['Row']

const CHANGE_COLUMNS =
  'id, research_product_id, source_id, field, change_kind, materiality, before, after, ' +
  'version_before_id, version_after_id, run_id, snapshot_before_key, snapshot_after_key, ' +
  'detected_at, decided_action, decided_by, decided_at'

/**
 * What the detector found, and what the queue asks of it.
 *
 * NOTHING HERE WRITES A DECISION ON ITS OWN ACCOUNT. `decided_action` is stamped by
 * `lib/scraper/workflows/review-actions.ts`, always after the append-only action row it summarises,
 * and `markDecided` below is the only function that touches those three columns. The ordering is
 * amendment A29's: the log is the record and the change row is its index, so a crash between the
 * two leaves an audited decision the queue still shows as undecided, which is the safe direction.
 *
 * READS RUN AS THE SESSION. `research_changes` has a staff-select policy and no write policy at
 * all, so a read through a session client is judged by RLS exactly as the explorer's is; only the
 * detector's writes take the admin client.
 */

export interface DetectedChange {
  readonly productId: string
  readonly sourceId: string
  readonly field: ChangeField
  readonly changeKind: 'ADDED' | 'REMOVED' | 'MODIFIED'
  readonly materiality: Materiality
  readonly before: unknown
  readonly after: unknown
  readonly versionBeforeId: string | null
  readonly versionAfterId: string
  readonly runId: string | null
  readonly snapshotBeforeKey: string | null
  readonly snapshotAfterKey: string | null
}

/**
 * Record what a detection pass found, replacing what an earlier pass said about the same movement.
 *
 * UPSERT ON (product, field, version_after), WHICH IS WHAT MAKES DETECTION RE-RUNNABLE. Two things
 * re-run it: a retried cron slice, and a re-classification after somebody edits a threshold. In
 * both cases the right outcome is the same row with a possibly different `materiality`, not a
 * second row for a movement that happened once.
 *
 * THE DECISION IS NOT AMONG THE COLUMNS WRITTEN, and that is the important half. A merchandiser who
 * shortlisted a change on Tuesday must not find it undecided on Wednesday because the cron
 * re-detected the same version pair.
 */
export async function recordChanges(
  admin: Client,
  changes: readonly DetectedChange[],
): Promise<number> {
  if (changes.length === 0) return 0

  const { error } = await admin.from('research_changes').upsert(
    changes.map((change) => ({
      research_product_id: change.productId,
      source_id: change.sourceId,
      field: change.field,
      change_kind: change.changeKind,
      materiality: change.materiality,
      before: change.before as never,
      after: change.after as never,
      version_before_id: change.versionBeforeId,
      version_after_id: change.versionAfterId,
      run_id: change.runId,
      snapshot_before_key: change.snapshotBeforeKey,
      snapshot_after_key: change.snapshotAfterKey,
    })),
    { onConflict: 'research_product_id,field,version_after_id' },
  )
  if (error !== null) throw toRepositoryError(ENTITY, 'record', changes[0]?.productId ?? '', error)
  return changes.length
}

export interface ChangeFilter {
  readonly sourceId?: string
  readonly field?: ChangeField
  readonly materiality?: Materiality
  readonly decided?: 'DECIDED' | 'UNDECIDED'
  /** Only changes detected within this many days. */
  readonly withinDays?: number
  readonly limit?: number
}

/** The queue's page size. A hundred rows is what somebody works through in a sitting. */
export const CHANGES_PAGE_SIZE = 100

/**
 * The review queue.
 *
 * `NOISE` IS EXCLUDED UNLESS ASKED FOR BY NAME, and that is the default the whole three-level
 * classification exists to produce. A person who wants to audit what the classifier called noise
 * can filter to it; nobody sees it by accident.
 */
export async function listChanges(
  client: Client,
  filter: ChangeFilter = {},
): Promise<readonly ChangeRow[]> {
  let query = client
    .from('research_changes')
    .select(CHANGE_COLUMNS)
    .order('detected_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(filter.limit ?? CHANGES_PAGE_SIZE)

  if (filter.materiality !== undefined) query = query.eq('materiality', filter.materiality)
  else query = query.neq('materiality', 'NOISE')

  if (filter.sourceId !== undefined) query = query.eq('source_id', filter.sourceId)
  if (filter.field !== undefined) query = query.eq('field', filter.field)
  if (filter.decided === 'UNDECIDED') query = query.is('decided_action', null)
  if (filter.decided === 'DECIDED') query = query.not('decided_action', 'is', null)
  if (filter.withinDays !== undefined) {
    const since = new Date(Date.now() - filter.withinDays * 24 * 60 * 60 * 1000)
    query = query.gte('detected_at', since.toISOString())
  }

  const { data, error } = await query
  if (error !== null) throw toRepositoryError(ENTITY, 'list', 'queue', error)
  return (data ?? []) as unknown as ChangeRow[]
}

export async function getChange(client: Client, id: string): Promise<ChangeRow | null> {
  const { data, error } = await client
    .from('research_changes')
    .select(CHANGE_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'get', id, error)
  return (data ?? null) as unknown as ChangeRow | null
}

export async function listChangesForProduct(
  client: Client,
  productId: string,
): Promise<readonly ChangeRow[]> {
  const { data, error } = await client
    .from('research_changes')
    .select(CHANGE_COLUMNS)
    .eq('research_product_id', productId)
    .order('detected_at', { ascending: false })
    .limit(200)
  if (error !== null) throw toRepositoryError(ENTITY, 'list', productId, error)
  return (data ?? []) as unknown as ChangeRow[]
}

/**
 * Stamp the queue's copy of a decision.
 *
 * CALLED ONLY BY `review-actions.ts`, ALWAYS AFTER THE ACTION ROW IS WRITTEN. Passing null for the
 * action is how a reversal clears the stamp: the log keeps both the decision and its reversal, and
 * the queue returns the row to somebody's attention.
 */
export async function markDecided(
  admin: Client,
  input: {
    readonly changeId: string
    readonly action: string | null
    readonly actorUserId: string | null
  },
): Promise<void> {
  const decided = input.action !== null
  const { error } = await admin
    .from('research_changes')
    .update({
      decided_action: input.action,
      decided_by: decided ? input.actorUserId : null,
      decided_at: decided ? new Date().toISOString() : null,
    })
    .eq('id', input.changeId)
  if (error !== null) throw toRepositoryError(ENTITY, 'decide', input.changeId, error)
}

export interface ChangeTally {
  readonly sourceId: string
  readonly field: string
  readonly count: number
}

/**
 * Material changes by source and field, for the digest and the dashboard.
 *
 * COUNTED IN TYPESCRIPT OVER A BOUNDED READ RATHER THAN BY A DATABASE `group by`, for the reason
 * `tallyIssues` gives: PostgREST cannot express `group by` without a view or an RPC, and a view
 * added for one dashboard tile is a schema object that outlives the tile. The bound is what keeps
 * it honest, and the digest records the window it counted.
 */
export async function tallyMaterialChanges(
  client: Client,
  since: Date,
  limit = 5_000,
): Promise<readonly ChangeTally[]> {
  const { data, error } = await client
    .from('research_changes')
    .select('source_id, field')
    .eq('materiality', 'MATERIAL')
    .gte('detected_at', since.toISOString())
    .limit(limit)
  if (error !== null) throw toRepositoryError(ENTITY, 'tally', 'material', error)

  const counts = new Map<string, ChangeTally>()
  for (const row of data ?? []) {
    const key = `${row.source_id} ${row.field}`
    const existing = counts.get(key)
    if (existing === undefined) {
      counts.set(key, { sourceId: row.source_id, field: row.field, count: 1 })
    } else {
      counts.set(key, { ...existing, count: existing.count + 1 })
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)
}

/**
 * The oldest change nobody has decided.
 *
 * THE SINGLE MOST USEFUL NUMBER ON THE DASHBOARD, because it is the one that makes a stalled queue
 * visible. A count of undecided changes can sit at forty for a month and look like steady state;
 * "the oldest undecided change is from 3 August" cannot be read as anything but a backlog.
 */
export async function oldestUndecided(client: Client): Promise<ChangeRow | null> {
  const { data, error } = await client
    .from('research_changes')
    .select(CHANGE_COLUMNS)
    .is('decided_action', null)
    .neq('materiality', 'NOISE')
    .order('detected_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'oldest', 'undecided', error)
  return (data ?? null) as unknown as ChangeRow | null
}

export async function countUndecided(client: Client): Promise<number> {
  const { count, error } = await client
    .from('research_changes')
    .select('id', { count: 'exact', head: true })
    .is('decided_action', null)
    .neq('materiality', 'NOISE')
  if (error !== null) throw toRepositoryError(ENTITY, 'count', 'undecided', error)
  return count ?? 0
}
