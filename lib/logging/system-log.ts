import { createHash } from 'node:crypto'

import type { Role } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeSystemLog } from '@/lib/supabase/repositories/system-logs'
import type { LogChannel, LogLevel } from '@/lib/supabase/schemas/system-logs'

import { redact, redactString } from './redact'

/**
 * `logSystem()` - Phase 38. The third log's one entry point.
 *
 * WHAT GOES HERE AND WHAT DOES NOT. A background job, an integration call, a cron tick, a workflow
 * run: the machine's own account of what it did. A privileged human act and every denial go to
 * `writeAudit()`; a human act worth a feed goes to `logActivity()`. The three are never merged, and
 * `scripts/logging/check-log-separation.mjs` fails the build on a module that sends one event to
 * both this and the audit log.
 *
 * REDACTED BEFORE IT LEAVES THIS FUNCTION. The message and every context value pass through
 * `lib/logging/redact.ts` (keys, known values and shapes), so a check module or a workflow that
 * wrote carelessly still cannot put a secret in the table.
 *
 * NEVER THROWS, NEVER BLOCKS THE CALLER'S WORK. A log that can take a workflow down is a second
 * failure mode with no upside. A write that fails is reported on the console, redacted, and
 * forgotten. Where the service role is not configured (a unit test, a script without an
 * environment) nothing is written and one note per process says so.
 */

export interface SystemLogEntry {
  readonly level: LogLevel
  readonly channel: LogChannel
  /** `^[a-z][a-z0-9_.-]{1,99}$`: a name, dotted by convention (`sheets.run.failed`). */
  readonly event: string
  readonly message: string
  readonly context?: Readonly<Record<string, unknown>>
  readonly actorId?: string | null
  readonly actorRole?: Role | null
  readonly requestId?: string | null
  readonly workflowRunId?: string | null
  readonly researchSourceId?: string | null
  readonly entityType?: string | null
  readonly entityId?: string | null
  /** Defaults to channel:event:hash(message, entity, workflow). Repeats within 5 min collapse. */
  readonly dedupeKey?: string
}

export function dedupeKeyFor(entry: SystemLogEntry): string {
  const digest = createHash('sha256')
    .update(
      [entry.message, entry.entityType ?? '', entry.entityId ?? '', entry.workflowRunId ?? ''].join(
        ' ',
      ),
    )
    .digest('hex')
    .slice(0, 16)
  return `${entry.channel}:${entry.event}:${digest}`
}

let warnedUnconfigured = false

function serviceRoleConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return typeof url === 'string' && url.length > 0 && typeof key === 'string' && key.length > 0
}

export async function logSystem(entry: SystemLogEntry): Promise<void> {
  const message = redactString(entry.message).slice(0, 2000)
  const context = redact(entry.context ?? {}) as Record<string, unknown>
  const dedupeKey = (entry.dedupeKey ?? dedupeKeyFor(entry)).slice(0, 300)

  if (!serviceRoleConfigured()) {
    // A unit test or a script without an environment. One note per process, and no echo of the
    // line: the callers that matter here (warnScraper above all) already print their own.
    if (!warnedUnconfigured) {
      warnedUnconfigured = true
      console.warn('[system-log] service role not configured; nothing is written to system_logs')
    }
    return
  }

  try {
    await writeSystemLog(createAdminClient(), {
      level: entry.level,
      channel: entry.channel,
      event: entry.event,
      message,
      context,
      actorId: entry.actorId ?? null,
      actorRole: entry.actorRole ?? null,
      requestId: entry.requestId ?? null,
      workflowRunId: entry.workflowRunId ?? null,
      researchSourceId: entry.researchSourceId ?? null,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      dedupeKey,
    })
  } catch (error) {
    const name = error instanceof Error ? error.name : 'Error'
    console.error(`[system-log] write failed (${name}) for ${entry.channel} ${entry.event}`)
  }
}
