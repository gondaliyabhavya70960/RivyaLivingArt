/**
 * Redaction for anything written to a log.
 *
 * DATA_MODEL.md §4 names this path: `audit_logs.before` and `.after` pass through it, and Phase 38
 * routes `system_logs` through it too. It lives outside lib/auth deliberately — it is pure, it has
 * no business importing `server-only`, and a redactor that cannot be unit-tested is a redactor
 * nobody has checked.
 *
 * A security log that accumulates secrets is a second copy of the thing it protects, kept for
 * longer and read by more people.
 */

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
