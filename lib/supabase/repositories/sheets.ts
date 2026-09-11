import type { SupabaseClient } from '@supabase/supabase-js'

import {
  exportDefinitionRowSchema,
  syncRunRowSchema,
  type ExportDefinitionInput,
  type ExportDefinitionRow,
  type RunStatus,
  type RunTrigger,
  type SheetsErrorCode,
  type SyncRunRow,
} from '@/lib/supabase/schemas/sheets'

import type { Database, Json } from '../database.types'
import { ConflictError } from '../errors'
import { parseRow, parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'sheets export'

const DEFINITION_COLUMNS =
  'id, slug, name, entity, scope_id, columns, filter, spreadsheet_id, tab_name, schedule, ' +
  'includes_pii, is_enabled, paused_at, paused_reason, consecutive_failures, last_run_at, ' +
  'last_status, created_at, created_by, updated_at, updated_by'
const RUN_COLUMNS =
  'id, definition_id, status, trigger, row_count, cell_count, attempts, error_code, ' +
  'duration_ms, started_at, finished_at, actor_id'

/**
 * Phase 36's two tables. Definitions are written as the PERSON (the table's policies require
 * `integrations.sheets.manage`); runs and the circuit-breaker state are written by the SERVICE
 * ROLE, because a run is the system's record of what happened and the breaker is the system's
 * judgement, not a person's edit.
 *
 * NOTHING HERE READS A SPREADSHEET. This module knows definitions and runs; the Sheets API is
 * `lib/sheets/`, and the only direction across it is outward.
 */

// --- definitions -------------------------------------------------------------------------------

export async function listDefinitions(client: Client): Promise<readonly ExportDefinitionRow[]> {
  const { data, error } = await client
    .from('sheets_export_definitions')
    .select(DEFINITION_COLUMNS)
    .order('name', { ascending: true })
    .limit(200)
  if (error !== null) throw toRepositoryError(ENTITY, 'list', 'definitions', error)
  return parseRows(ENTITY, exportDefinitionRowSchema, data ?? [])
}

export async function getDefinition(
  client: Client,
  id: string,
): Promise<ExportDefinitionRow | null> {
  const { data, error } = await client
    .from('sheets_export_definitions')
    .select(DEFINITION_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'get', id, error)
  return data === null ? null : parseRow(ENTITY, exportDefinitionRowSchema, data)
}

export async function getDefinitionBySlug(
  client: Client,
  slug: string,
): Promise<ExportDefinitionRow | null> {
  const { data, error } = await client
    .from('sheets_export_definitions')
    .select(DEFINITION_COLUMNS)
    .eq('slug', slug)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'get by slug', slug, error)
  return data === null ? null : parseRow(ENTITY, exportDefinitionRowSchema, data)
}

export async function createDefinition(
  client: Client,
  input: ExportDefinitionInput & { readonly actorUserId: string },
): Promise<ExportDefinitionRow> {
  const { data, error } = await client
    .from('sheets_export_definitions')
    .insert({
      slug: input.slug,
      name: input.name,
      entity: input.entity,
      scope_id: input.scopeId,
      columns: [...input.columns],
      filter: input.filter as Json,
      spreadsheet_id: input.spreadsheetId,
      tab_name: input.tabName,
      schedule: input.schedule,
      includes_pii: input.includesPii,
      created_by: input.actorUserId,
      updated_by: input.actorUserId,
    })
    .select(DEFINITION_COLUMNS)
    .single()
  if (error !== null) throw toRepositoryError(ENTITY, 'create', input.slug, error)
  return parseRow(ENTITY, exportDefinitionRowSchema, data)
}

export async function updateDefinition(
  client: Client,
  id: string,
  input: ExportDefinitionInput & { readonly actorUserId: string },
): Promise<ExportDefinitionRow> {
  const { data, error } = await client
    .from('sheets_export_definitions')
    .update({
      slug: input.slug,
      name: input.name,
      entity: input.entity,
      scope_id: input.scopeId,
      columns: [...input.columns],
      filter: input.filter as Json,
      spreadsheet_id: input.spreadsheetId,
      tab_name: input.tabName,
      schedule: input.schedule,
      includes_pii: input.includesPii,
      updated_by: input.actorUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(DEFINITION_COLUMNS)
    .single()
  if (error !== null) throw toRepositoryError(ENTITY, 'update', id, error)
  return parseRow(ENTITY, exportDefinitionRowSchema, data)
}

/** Pause or resume by hand — `integrations.sheets.manage`, judged again by RLS. */
export async function setDefinitionPaused(
  client: Client,
  id: string,
  input: { readonly paused: boolean; readonly reason: string | null; readonly actorUserId: string },
): Promise<void> {
  const { error } = await client
    .from('sheets_export_definitions')
    .update({
      paused_at: input.paused ? new Date().toISOString() : null,
      paused_reason: input.paused ? (input.reason ?? 'PAUSED') : null,
      consecutive_failures: input.paused ? undefined : 0,
      updated_by: input.actorUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error !== null) throw toRepositoryError(ENTITY, 'pause', id, error)
}

export async function setDefinitionEnabled(
  client: Client,
  id: string,
  input: { readonly enabled: boolean; readonly actorUserId: string },
): Promise<void> {
  const { error } = await client
    .from('sheets_export_definitions')
    .update({
      is_enabled: input.enabled,
      updated_by: input.actorUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error !== null) throw toRepositoryError(ENTITY, 'enable', id, error)
}

/** The system's record after a run: last run, last status, and the circuit breaker. */
export async function recordRunOutcome(
  admin: Client,
  id: string,
  input: {
    readonly lastRunAt: string
    readonly lastStatus: RunStatus
    readonly consecutiveFailures: number
    readonly pausedReason: SheetsErrorCode | null
  },
): Promise<void> {
  const { error } = await admin
    .from('sheets_export_definitions')
    .update({
      last_run_at: input.lastRunAt,
      last_status: input.lastStatus,
      consecutive_failures: input.consecutiveFailures,
      ...(input.pausedReason === null
        ? {}
        : { paused_at: input.lastRunAt, paused_reason: input.pausedReason }),
    })
    .eq('id', id)
  if (error !== null) throw toRepositoryError(ENTITY, 'outcome', id, error)
}

/** Enabled, unpaused definitions with a schedule other than MANUAL — the cron's candidates. */
export async function listScheduledDefinitions(
  admin: Client,
): Promise<readonly ExportDefinitionRow[]> {
  const { data, error } = await admin
    .from('sheets_export_definitions')
    .select(DEFINITION_COLUMNS)
    .eq('is_enabled', true)
    .is('paused_at', null)
    .neq('schedule', 'MANUAL')
    .limit(200)
  if (error !== null) throw toRepositoryError(ENTITY, 'scheduled', 'all', error)
  return parseRows(ENTITY, exportDefinitionRowSchema, data ?? [])
}

// --- runs ----------------------------------------------------------------------------------------

/**
 * Open a run. The partial unique index admits one RUNNING row per definition; a second attempt
 * comes back as `{ ok: false }` and the caller records SKIPPED rather than throwing.
 */
export async function startRun(
  admin: Client,
  input: {
    readonly definitionId: string
    readonly trigger: RunTrigger
    readonly actorId: string | null
  },
): Promise<{ readonly ok: true; readonly run: SyncRunRow } | { readonly ok: false }> {
  const { data, error } = await admin
    .from('sheets_sync_runs')
    .insert({
      definition_id: input.definitionId,
      status: 'RUNNING',
      trigger: input.trigger,
      actor_id: input.actorId,
    })
    .select(RUN_COLUMNS)
    .single()
  if (error !== null) {
    const mapped = toRepositoryError(ENTITY, 'start run', input.definitionId, error)
    if (mapped instanceof ConflictError) return { ok: false }
    throw mapped
  }
  return { ok: true, run: parseRow(ENTITY, syncRunRowSchema, data) }
}

export async function finishRun(
  admin: Client,
  id: string,
  input: {
    readonly status: Exclude<RunStatus, 'RUNNING'>
    readonly rowCount: number
    readonly cellCount: number
    readonly attempts: number
    readonly errorCode: SheetsErrorCode | null
    readonly durationMs: number
  },
): Promise<void> {
  const { error } = await admin
    .from('sheets_sync_runs')
    .update({
      status: input.status,
      row_count: input.rowCount,
      cell_count: input.cellCount,
      attempts: input.attempts,
      error_code: input.errorCode,
      duration_ms: input.durationMs,
      finished_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error !== null) throw toRepositoryError(ENTITY, 'finish run', id, error)
}

/** A run that never started — the conflict case, or a dry run — recorded whole in one write. */
export async function recordSkippedRun(
  admin: Client,
  input: {
    readonly definitionId: string
    readonly trigger: RunTrigger
    readonly actorId: string | null
    readonly errorCode: SheetsErrorCode
    readonly rowCount?: number
    readonly cellCount?: number
  },
): Promise<void> {
  const { error } = await admin.from('sheets_sync_runs').insert({
    definition_id: input.definitionId,
    status: 'SKIPPED',
    trigger: input.trigger,
    actor_id: input.actorId,
    error_code: input.errorCode,
    row_count: input.rowCount ?? 0,
    cell_count: input.cellCount ?? 0,
    finished_at: new Date().toISOString(),
  })
  if (error !== null) throw toRepositoryError(ENTITY, 'skip run', input.definitionId, error)
}

export async function listRuns(
  client: Client,
  definitionId: string,
  limit = 20,
): Promise<readonly SyncRunRow[]> {
  const { data, error } = await client
    .from('sheets_sync_runs')
    .select(RUN_COLUMNS)
    .eq('definition_id', definitionId)
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error !== null) throw toRepositoryError(ENTITY, 'runs', definitionId, error)
  return parseRows(ENTITY, syncRunRowSchema, data ?? [])
}

export async function listRecentRuns(client: Client, limit = 50): Promise<readonly SyncRunRow[]> {
  const { data, error } = await client
    .from('sheets_sync_runs')
    .select(RUN_COLUMNS)
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error !== null) throw toRepositoryError(ENTITY, 'recent runs', 'all', error)
  return parseRows(ENTITY, syncRunRowSchema, data ?? [])
}

/** The previous SUCCEEDED row count, for the >50 % change warning the history renders. */
export async function previousSucceededRowCount(
  client: Client,
  definitionId: string,
  beforeRunId: string,
): Promise<number | null> {
  const { data, error } = await client
    .from('sheets_sync_runs')
    .select('id, row_count')
    .eq('definition_id', definitionId)
    .eq('status', 'SUCCEEDED')
    .neq('id', beforeRunId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'previous count', definitionId, error)
  return data?.row_count ?? null
}
