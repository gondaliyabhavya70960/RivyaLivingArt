import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { writeAudit } from '@/lib/auth/audit'
import type { Role } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/logging/activity'
import { logSystem } from '@/lib/logging/system-log'
import type { Database } from '@/lib/supabase/database.types'
import {
  finishRun,
  getDefinition,
  recordRunOutcome,
  recordSkippedRun,
  startRun,
} from '@/lib/supabase/repositories/sheets'
import type {
  ExportDefinitionRow,
  RunStatus,
  RunTrigger,
  SheetsErrorCode,
} from '@/lib/supabase/schemas/sheets'

import { buildRows } from './builders'
import { createSheetsClient, defaultSpreadsheetId, type SheetsClient } from './client'
import { cellCount } from './definitions'
import { SheetsError, codeOf } from './errors'
import type { RetryOptions } from './retry'
import { writeTabAtomically } from './write'

type Client = SupabaseClient<Database>

/**
 * One run, end to end — Phase 36.
 *
 *   open a RUNNING row (one per definition; a second attempt records SKIPPED) → build the rows
 *   through the repositories → write the staging tab and swap it in → record the outcome, and
 *   the circuit breaker: three consecutive failures pause the definition.
 *
 * WHAT A RUN RECORDS IS A CODE, NEVER A BODY. `SheetsError` carries a fixed code and the HTTP
 * status; an unknown error becomes WRITE. The message an operator sees is the fixed sentence for
 * that code, and `sheets-redaction.test.ts` proves nothing the upstream said survives into it.
 *
 * THE FLAG IS THE CALLER'S TO CHECK, and every caller does: the Server Action, the CLI and the
 * cron each ask `isEnabled('google_sheets')` first and refuse with FLAG_OFF without touching a run
 * row. Passing it in keeps this module free of the request-scoped flag reader, so the CLI can run.
 */

export const CIRCUIT_BREAKER_FAILURES = 3

export interface RunRequest {
  readonly definitionId: string
  readonly trigger: RunTrigger
  readonly actor: { readonly userId: string | null; readonly role: Role | null }
  readonly dryRun?: boolean
  readonly flagEnabled: boolean
  /** Injected by tests; production builds one from the environment. */
  readonly client?: SheetsClient
  readonly retry?: RetryOptions
}

export interface RunSummary {
  readonly definitionId: string
  readonly slug: string
  readonly runId: string | null
  readonly status: RunStatus
  readonly errorCode: SheetsErrorCode | null
  readonly rowCount: number
  readonly cellCount: number
  readonly attempts: number
  readonly durationMs: number
  readonly paused: boolean
}

function summary(
  definition: ExportDefinitionRow,
  partial: Partial<RunSummary> & { readonly status: RunStatus },
): RunSummary {
  return {
    definitionId: definition.id,
    slug: definition.slug,
    runId: null,
    errorCode: null,
    rowCount: 0,
    cellCount: 0,
    attempts: 0,
    durationMs: 0,
    paused: false,
    ...partial,
  }
}

export async function runDefinition(admin: Client, request: RunRequest): Promise<RunSummary> {
  const definition = await getDefinition(admin, request.definitionId)
  if (definition === null) throw new SheetsError('WRITE')
  if (!request.flagEnabled) throw new SheetsError('FLAG_OFF')
  if (!definition.is_enabled) throw new SheetsError('DISABLED')
  if (definition.paused_at !== null) throw new SheetsError('PAUSED')

  const opened = await startRun(admin, {
    definitionId: definition.id,
    trigger: request.trigger,
    actorId: request.actor.userId,
  })
  if (!opened.ok) {
    await recordSkippedRun(admin, {
      definitionId: definition.id,
      trigger: request.trigger,
      actorId: request.actor.userId,
      errorCode: 'RUNNING',
    })
    return summary(definition, { status: 'SKIPPED', errorCode: 'RUNNING' })
  }
  const run = opened.run
  const startedAt = Date.now()

  const fail = async (code: SheetsErrorCode, attempts: number): Promise<RunSummary> => {
    const durationMs = Date.now() - startedAt
    await finishRun(admin, run.id, {
      status: 'FAILED',
      rowCount: 0,
      cellCount: 0,
      attempts,
      errorCode: code,
      durationMs,
    })
    const failures = definition.consecutive_failures + 1
    const paused = failures >= CIRCUIT_BREAKER_FAILURES
    await recordRunOutcome(admin, definition.id, {
      lastRunAt: new Date().toISOString(),
      lastStatus: 'FAILED',
      consecutiveFailures: failures,
      pausedReason: paused ? code : null,
    })
    await logSystem({
      level: 'ERROR',
      channel: 'SHEETS',
      event: 'sheets.run.failed',
      message: `Sheets export ${definition.slug} failed with ${code}`,
      context: { code, attempts, duration_ms: durationMs, definition: definition.slug },
      actorId: request.actor.userId,
      actorRole: request.actor.role,
      workflowRunId: run.id,
      entityType: 'sheets_export_definition',
      entityId: definition.id,
    })
    await logActivity({
      action: 'sheets.run.failed',
      actorId: request.actor.userId,
      actorRole: request.actor.role,
      entityType: 'sheets_export_definition',
      entityId: definition.id,
      entityLabel: definition.slug,
      summary: paused ? `${code}; paused after ${String(failures)} failures` : code,
      metadata: { code, attempts, paused },
    })
    return summary(definition, {
      runId: run.id,
      status: 'FAILED',
      errorCode: code,
      attempts,
      durationMs,
      paused,
    })
  }

  let built
  try {
    built = await buildRows(admin, definition)
  } catch (error) {
    return fail(codeOf(error), 0)
  }
  const rowCount = built.rows.length
  const cells = cellCount(definition.columns, rowCount)

  if (request.dryRun === true) {
    const durationMs = Date.now() - startedAt
    await finishRun(admin, run.id, {
      status: 'SKIPPED',
      rowCount,
      cellCount: cells,
      attempts: 0,
      errorCode: 'DRY_RUN',
      durationMs,
    })
    return summary(definition, {
      runId: run.id,
      status: 'SKIPPED',
      errorCode: 'DRY_RUN',
      rowCount,
      cellCount: cells,
      durationMs,
    })
  }

  const spreadsheetId = definition.spreadsheet_id ?? defaultSpreadsheetId()
  let client: SheetsClient
  try {
    client = request.client ?? createSheetsClient()
    if (spreadsheetId === null) throw new SheetsError('NOT_CONFIGURED')
  } catch (error) {
    return fail(codeOf(error), 0)
  }

  let attempts = 0
  try {
    const written = await writeTabAtomically(
      client,
      {
        spreadsheetId,
        tab: definition.tab_name,
        header: built.header,
        rows: built.rows,
        runId: run.id,
      },
      request.retry ?? {},
    )
    attempts = written.attempts
  } catch (error) {
    return fail(codeOf(error), attempts)
  }

  const durationMs = Date.now() - startedAt
  await finishRun(admin, run.id, {
    status: 'SUCCEEDED',
    rowCount,
    cellCount: cells,
    attempts,
    errorCode: null,
    durationMs,
  })
  await recordRunOutcome(admin, definition.id, {
    lastRunAt: new Date().toISOString(),
    lastStatus: 'SUCCEEDED',
    consecutiveFailures: 0,
    pausedReason: null,
  })

  if (definition.includes_pii) {
    // EVERY PII RUN IS AUDITED, naming the actor (or the schedule), the row count and the
    // destination. The spreadsheet id is an identifier, not a secret, and it is the address the
    // audit exists to record.
    await writeAudit({
      action: 'sheets.export.pii',
      result: 'SUCCESS',
      ...(request.actor.userId === null ? {} : { actorUserId: request.actor.userId }),
      ...(request.actor.role === null ? {} : { actorRole: request.actor.role }),
      entityType: 'sheets_export_definition',
      entityId: definition.id,
      summary: `${String(rowCount)} enquiry rows with personal data written to spreadsheet ${spreadsheetId}, tab ${definition.tab_name}, by ${request.trigger}`,
    })
  }
  await logActivity({
    action: 'sheets.run.succeeded',
    actorId: request.actor.userId,
    actorRole: request.actor.role,
    entityType: 'sheets_export_definition',
    entityId: definition.id,
    entityLabel: definition.slug,
    summary: `${String(rowCount)} rows, ${String(cells)} cells`,
    metadata: { rowCount, cellCount: cells, attempts, trigger: request.trigger },
  })

  return summary(definition, {
    runId: run.id,
    status: 'SUCCEEDED',
    rowCount,
    cellCount: cells,
    attempts,
    durationMs,
  })
}
