import 'server-only'

import { createAdminClient } from '../supabase/admin'
import type { Role } from './permissions'

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

/**
 * Keys whose values never reach the log, at any depth.
 *
 * An allowlist would be safer still, but it cannot be written once for arbitrary entity shapes.
 * This denylist is the practical form, and it is deliberately broad: a security log that
 * accumulates secrets is a second copy of the thing it protects, held for longer and read by more
 * people.
 */
const REDACTED_KEYS = [
  'password',
  'token',
  'secret',
  'key',
  'authorization',
  'cookie',
  'session',
  'jwt',
  'apikey',
  'api_key',
  'service_role',
  'anon_key',
  'phone',
  'email',
  'message',
  'note',
  'address',
]

const REDACTED = '[redacted]'

/** Recursively strip anything whose key looks like a secret or personal data. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[too deep]'
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1))
  if (typeof value !== 'object') return value

  const out: Record<string, unknown> = {}
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    const lowered = key.toLowerCase()
    out[key] = REDACTED_KEYS.some((needle) => lowered.includes(needle))
      ? REDACTED
      : redact(inner, depth + 1)
  }
  return out
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('audit_logs').insert({
      action: entry.action,
      result: entry.result,
      actor_user_id: entry.actorUserId ?? null,
      actor_role: entry.actorRole ?? null,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      summary: entry.summary ?? null,
      before: entry.before === undefined ? null : (redact(entry.before) as never),
      after: entry.after === undefined ? null : (redact(entry.after) as never),
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
    await writeAudit({
      ...entry,
      result: 'ERROR',
      summary: error instanceof Error ? error.message : 'unknown error',
    })
    throw error
  }
}
