import 'server-only'

import { createAdminClient } from '../supabase/admin'
import { insertAuditLog } from '../supabase/repositories/audit'
import { redact } from '../logging/redact'
import type { Role } from './permissions'
import type { Json } from '../supabase/database.types'

/**
 * The audit writer.
 *
 * It writes through the SERVICE-ROLE client, and that is a security decision rather than a
 * convenience. `audit_logs` has no insert policy for `authenticated` at all, so a signed-in staff
 * member cannot write entries — not their own, and not ones implicating somebody else. The only
 * path into the table is this function.
 *
 * NEVER LET A FAILED AUDIT WRITE BLOCK A DENIAL. writeAudit swallows its own errors: a denial that
 * throws before it can be recorded must still deny. The alternative — an audit outage that turns
 * every permission check into a 500 — is a worse failure than an unrecorded row, and the row is
 * recoverable from application logs while the outage is not.
 */

export type AuditResult = 'SUCCESS' | 'DENIED' | 'ERROR'

/**
 * "This error already wrote its own audit row."
 *
 * WHY THIS EXISTS. A refusal used to land TWICE: once as the `DENIED` row written by whoever
 * recognised the refusal and could name the record, and again as the `ERROR` row written by
 * `withPermission()` catching the same throw on its way out. Two rows for one event is not a
 * cosmetic problem in a security log — it inflates every count taken from the table, and the two
 * rows disagree, because only one of them knows what was actually refused and why.
 *
 * The alternative fixes are worse. Having the wrapper suppress `ERROR` for particular error CLASSES
 * couples it to every domain that might refuse something. Having it suppress rows that "look like"
 * a recent DENIED means querying the log on the error path, in the one code path that must not
 * depend on the log being reachable.
 *
 * So the thrower states the fact, once, at the point where it is known for certain. An unmarked
 * error is an unrecorded one, which is the safe default: the failure mode of forgetting to mark is
 * a duplicate row, not a missing one.
 *
 * A registered symbol rather than a property name, so it cannot collide with a field on somebody
 * else's error object and is not carried across a structured-clone or a JSON round trip — an error
 * that crossed a serialisation boundary has left the process that wrote the row, and its claim to
 * have written one should not survive with it.
 */
const AUDIT_RECORDED: unique symbol = Symbol.for('rivya.audit.recorded') as never

/** Say that this error's audit row is already written. Returns the error, so it can be thrown inline. */
export function markAudited<E>(error: E): E {
  if (typeof error === 'object' && error !== null) {
    Object.defineProperty(error, AUDIT_RECORDED, {
      value: true,
      enumerable: false,
      configurable: true,
    })
  }
  return error
}

/** Has this error already been recorded by whoever threw it? */
export function isAudited(error: unknown): boolean {
  return typeof error === 'object' && error !== null && AUDIT_RECORDED in error
}

export type AuditEntry = {
  action: string
  result: AuditResult
  actorUserId?: string
  actorRole?: Role
  entityType?: string
  entityId?: string
  summary?: string
  before?: unknown
  after?: unknown
  requestId?: string
  ip?: string
  userAgent?: string
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    const admin = createAdminClient()
    await insertAuditLog(admin, {
      action: entry.action,
      result: entry.result,
      actor_user_id: entry.actorUserId ?? null,
      actor_role: entry.actorRole ?? null,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      summary: entry.summary ?? null,
      before: entry.before === undefined ? null : (redact(entry.before) as Json),
      after: entry.after === undefined ? null : (redact(entry.after) as Json),
      request_id: entry.requestId ?? null,
      ip: entry.ip ?? null,
      user_agent: entry.userAgent ?? null,
    })
  } catch {
    // Deliberately swallowed. See the header: a denial that cannot be logged must still deny.
  }
}

/** Wrap a mutation so both outcomes are recorded. Prefer withPermission() in require.ts, which
 *  does this and checks the permission; this is for mutations that are already gated. */
export async function withAudit<T>(
  entry: Omit<AuditEntry, 'result'>,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    const result = await fn()
    await writeAudit({ ...entry, result: 'SUCCESS' })
    return result
  } catch (error) {
    // An error that already recorded itself gets no second row — see markAudited above.
    if (!isAudited(error)) {
      await writeAudit({
        ...entry,
        result: 'ERROR',
        summary: error instanceof Error ? error.message : 'unknown error',
      })
    }
    throw error
  }
}
