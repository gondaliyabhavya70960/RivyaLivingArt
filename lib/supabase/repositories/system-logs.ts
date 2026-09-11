import type { SupabaseClient } from '@supabase/supabase-js'

import type { Role } from '@/lib/auth/permissions'

import type { Database, Json } from '../database.types'
import {
  systemLogRowSchema,
  workflowRunRowSchema,
  type LogChannel,
  type LogLevel,
  type SystemLogFilter,
  type SystemLogRow,
  type WorkflowRunRow,
} from '../schemas/system-logs'
import { parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'system log'
const COLUMNS =
  'id, level, channel, event, message, context, actor_id, actor_role, request_id, workflow_run_id, ' +
  'research_source_id, entity_type, entity_id, dedupe_key, occurrence_count, first_occurred_at, occurred_at'

/** Retention, by level (PHASE-31-38 Phase 38): 90 days for the noise, 400 for what mattered. */
export const RETENTION_DAYS: Readonly<Record<LogLevel, number>> = {
  INFO: 90,
  WARNING: 90,
  ERROR: 400,
  SECURITY: 400,
}

export interface SystemLogWrite {
  readonly level: LogLevel
  readonly channel: LogChannel
  readonly event: string
  readonly message: string
  readonly context: Readonly<Record<string, unknown>>
  readonly actorId: string | null
  readonly actorRole: Role | null
  readonly requestId: string | null
  readonly workflowRunId: string | null
  readonly researchSourceId: string | null
  readonly entityType: string | null
  readonly entityId: string | null
  readonly dedupeKey: string
}

/**
 * Write one line through `system_log_write()`. The dedupe lives in the function, so a repeat
 * within five minutes increments the existing row. Service role only; the caller has redacted.
 */
export async function writeSystemLog(admin: Client, input: SystemLogWrite): Promise<string> {
  /*
   * EVERY PARAMETER IS SENT, AS `null` RATHER THAN `undefined` — Phase 42, and this was a live bug
   * rather than a tidy-up.
   *
   * `system_log_write` takes thirteen parameters and declares a default for NONE of them
   * (`pronargdefaults = 0`). PostgREST resolves an RPC by matching the JSON keys it receives against
   * a function signature, and `supabase-js` drops keys whose value is `undefined` before
   * serialising. So the seven optional arguments vanished from the request, six keys arrived, no
   * overload matched, and PostgREST answered:
   *
   *     PGRST202 — Searched for the function public.system_log_write with parameters
   *     p_channel, p_context, p_dedupe_key, p_event, p_level, p_message … no matches
   *
   * `logSystem` catches every error and prints only the error's NAME, so the failure showed up as
   * one unexplained line — `[system-log] write failed (ValidationError)` — and NOT ONE ROW HAS EVER
   * BEEN WRITTEN TO `system_logs` BY THE APPLICATION since Phase 38. CSP violations, scraper
   * warnings, retention runs: all of it went nowhere, while the Studio's log page showed an empty
   * table that read as "nothing has gone wrong".
   *
   * Found by running the e2e suite for the first time and reading the dev server's output, which is
   * the only place the line appears.
   *
   * `null` is also the honest value: the column is nullable and the absence is a fact worth
   * recording, not an argument to leave out.
   */
  const { data, error } = await admin.rpc('system_log_write', {
    p_level: input.level,
    p_channel: input.channel,
    p_event: input.event,
    p_message: input.message,
    p_context: input.context as Json,
    p_actor_id: input.actorId ?? null,
    p_actor_role: input.actorRole ?? null,
    p_request_id: input.requestId ?? null,
    p_workflow_run_id: input.workflowRunId ?? null,
    p_research_source_id: input.researchSourceId ?? null,
    p_entity_type: input.entityType ?? null,
    p_entity_id: input.entityId ?? null,
    p_dedupe_key: input.dedupeKey,
  })
  if (error !== null) throw toRepositoryError(ENTITY, 'write', input.event, error)
  return String(data)
}

/** The page's read, under the session's own policy (owner, admin). */
export async function listSystemLogs(
  client: Client,
  filter: SystemLogFilter = {},
): Promise<readonly SystemLogRow[]> {
  let query = client
    .from('system_logs')
    .select(COLUMNS)
    .order('occurred_at', { ascending: false })
    .limit(filter.limit ?? 100)
  if (filter.from !== undefined) query = query.gte('occurred_at', filter.from)
  if (filter.to !== undefined) query = query.lte('occurred_at', filter.to)
  if (filter.level !== undefined) query = query.eq('level', filter.level)
  if (filter.channel !== undefined) query = query.eq('channel', filter.channel)
  if (filter.actorId !== undefined) query = query.eq('actor_id', filter.actorId)
  if (filter.workflowRunId !== undefined) query = query.eq('workflow_run_id', filter.workflowRunId)
  if (filter.researchSourceId !== undefined) {
    query = query.eq('research_source_id', filter.researchSourceId)
  }
  if (filter.entityType !== undefined) query = query.eq('entity_type', filter.entityType)
  if (filter.entityId !== undefined) query = query.eq('entity_id', filter.entityId)
  if (filter.event !== undefined) {
    // PostgREST pattern characters escaped: a filter is a substring, never a pattern.
    const escaped = filter.event.replace(/[%_\\]/gu, (char) => `\\${char}`)
    query = query.ilike('event', `%${escaped}%`)
  }
  const { data, error } = await query
  if (error !== null) throw toRepositoryError(ENTITY, 'list', 'filter', error)
  return parseRows(ENTITY, systemLogRowSchema, data ?? [])
}

export interface PurgeOutcome {
  readonly infoWarning: number
  readonly errorSecurity: number
}

/** The retention cron's delete, by level and age of the FIRST occurrence. Service role only. */
export async function purgeSystemLogs(admin: Client, now: Date): Promise<PurgeOutcome> {
  const cutoff = (days: number): string => new Date(now.getTime() - days * 86_400_000).toISOString()
  const short = await admin
    .from('system_logs')
    .delete({ count: 'exact' })
    .in('level', ['INFO', 'WARNING'])
    .lt('first_occurred_at', cutoff(RETENTION_DAYS.INFO))
  if (short.error !== null) throw toRepositoryError(ENTITY, 'purge', 'info', short.error)
  const long = await admin
    .from('system_logs')
    .delete({ count: 'exact' })
    .in('level', ['ERROR', 'SECURITY'])
    .lt('first_occurred_at', cutoff(RETENTION_DAYS.ERROR))
  if (long.error !== null) throw toRepositoryError(ENTITY, 'purge', 'error', long.error)
  return { infoWarning: short.count ?? 0, errorSecurity: long.count ?? 0 }
}

/* --- workflow_runs_v ------------------------------------------------------------------------- */

/**
 * The view is not in the generated `Database` type (the generator emits tables, not views), so the
 * client is retyped for the one call, the same way `source-health.ts` reads its view. The Zod
 * schema is the row's definition; the cast is confined here.
 */
type WorkflowDatabase = {
  readonly public: {
    readonly Tables: Database['public']['Tables']
    readonly Views: {
      readonly workflow_runs_v: { readonly Row: WorkflowRunRow; readonly Relationships: [] }
    }
    readonly Functions: Database['public']['Functions']
    readonly Enums: Database['public']['Enums']
    readonly CompositeTypes: Database['public']['CompositeTypes']
  }
}

export async function listWorkflowRuns(
  client: Client,
  limit = 100,
): Promise<readonly WorkflowRunRow[]> {
  const viewClient = client as unknown as SupabaseClient<WorkflowDatabase>
  const { data, error } = await viewClient
    .from('workflow_runs_v')
    .select('kind, id, scope, status, started_at, finished_at')
    .order('started_at', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (error !== null) throw toRepositoryError('workflow run', 'list', 'view', error)
  return parseRows('workflow run', workflowRunRowSchema, data ?? [])
}
