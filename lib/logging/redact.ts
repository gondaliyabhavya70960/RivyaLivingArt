/**
 * Redaction for anything written to a log or shown on a system surface — Phase 04, extended by
 * Phase 38 into the one redactor the environment page, the documentation browser and every log
 * write share.
 *
 * DATA_MODEL.md §4 names this path: `audit_logs.before` and `.after` pass through it, and
 * `system_logs.context`, every environment check result and every documentation render now do
 * too. It lives outside lib/auth deliberately — it is pure, it has no business importing
 * `server-only`, and a redactor that cannot be unit-tested is a redactor nobody has checked.
 *
 * THREE LAYERS, ALL REPLACING WITH THE SAME FIXED TOKEN — never a prefix, a suffix, a length or a
 * hash, because D8's "never a value, prefix or length" is taken literally:
 *
 *   1. BY KEY. Any object key naming a secret or a person (`token`, `password`, `phone`, …) or a
 *      D8 server-only variable (`CLOUDINARY_API_SECRET`, …) loses its value, at any depth.
 *   2. BY VALUE. The current VALUE of every D8 server-only variable, wherever it appears inside a
 *      string — an error message quoting a connection string, a URL carrying a key — is replaced.
 *      This is what the sentinel test in `env-checks-no-secrets.test.ts` exercises: set each
 *      variable to a unique sentinel, render every surface, and fail on any fragment of it.
 *   3. BY SHAPE. Strings that look like a JWT, a PEM private-key block, a Cloudinary URL with
 *      credentials, a `postgres://user:pass@` connection string or a bearer token are replaced
 *      whether or not the value is known — the shape is the tell.
 *
 * A security log that accumulates secrets is a second copy of the thing it protects, kept for
 * longer and read by more people.
 */

/** The D8 server-only variables, by name. Their values are stripped wherever they appear. */
export const SERVER_ONLY_VARIABLES = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'GOOGLE_SERVICE_ACCOUNT_JSON',
  'GOOGLE_SHEETS_SPREADSHEET_ID',
  'SCRAPER_USER_AGENT',
  'REVALIDATE_SECRET',
  'CRON_SECRET',
  /*
   * PHASE 41 ADDED THE TWO SALTS. Neither is a credential to a service, and both are exactly as
   * dangerous as one for the thing they protect: `ip_hash` is an HMAC over an address, and the
   * address space is four billion values — minutes of work against a leaked salt. A salt in a log
   * turns every hashed address in `inquiries` and `rate_limit_buckets` back into an IP.
   */
  'IP_HASH_SALT',
  'RATE_LIMIT_SALT',
  /*
   * AMENDMENT A43 ADDED THE BOOTSTRAP PASSWORD. It is the credential to the one account that can
   * do everything the Studio can do, and it lives in an environment that a deploy log, a CI job and
   * a local shell all have in scope — which is precisely the set of places a stray `context: { env }`
   * would carry it into `system_logs`. The other three bootstrap variables are NOT here: an address,
   * a role name and a display name are not secrets, and stripping the role would make the
   * environment page unable to say what it is configured to create.
   */
  'STUDIO_ADMIN_PASSWORD',
] as const

/**
 * Keys whose values never reach a log, at any depth.
 *
 * An allowlist would be safer still, but it cannot be written once for arbitrary entity shapes.
 * This denylist is the practical form, and it is deliberately broad.
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
  'credential',
  'private',
  'phone',
  'email',
  'message',
  'note',
  'address',
  /*
   * PHASE 41 WIDENED THIS TO THE REST OF THE PERSONAL-DATA SET. `inquiries` is the only place this
   * product holds personal data (`lib/inquiries/pii.ts`), and its columns are what a log line about
   * an enquiry would otherwise carry: a name, a city, the configurator's free-text answers, and the
   * hashed address. `ip_hash` is included even though it is already a hash — a hash beside a
   * timestamp and a route is still a way to follow one visitor through a log file.
   */
  'name',
  'city',
  'answers',
  'ip_hash',
  'ip',
  'user_agent',
  'useragent',
  'referrer',
]

/**
 * Keys a log legitimately carries whose NAME contains a needle above: an error code is not a
 * key, a metric key and a dedupe key are identifiers. A `message` inside a blob stays redacted
 * (it is an enquiry's free text as often as not); the system log's own message column never
 * passes through this by-key layer — `logSystem()` scrubs it as a string.
 */
const KEPT_KEYS = new Set([
  'error_code',
  'metric_key',
  'dedupe_key',
  /*
   * PHASE 41'S ADDITIONS FORCED THESE. `name` is a needle now, and half the log lines in this
   * product legitimately carry one: a block type's name, a metric's, a source's, a column's. The
   * rule that separates them is whether the value could be a PERSON — so the specific
   * machine-name keys are kept and the bare `name` stays redacted, which is the safe default when
   * a new one is added and nobody updates this list.
   */
  'block_name',
  'metric_name',
  'source_name',
  'column_name',
  'table_name',
  'file_name',
  'event_name',
  'rule_name',
  'field_name',
  'step_name',
])

export const REDACTED = '[redacted]'

const SHAPES: readonly RegExp[] = [
  // A JWT: three base64url segments, the first starting with `eyJ` ({"alg" …).
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/gu,
  // A PEM private-key block, whole.
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gu,
  // The same block with its newlines escaped, as it sits inside a JSON string.
  /-----BEGIN [A-Z ]*PRIVATE KEY-----(?:\\n|[^-])*?-----END [A-Z ]*PRIVATE KEY-----/gu,
  // A Cloudinary URL carrying credentials.
  /cloudinary:\/\/[^\s@'"]+@[^\s'"]+/giu,
  // A connection string with a password.
  /postgres(?:ql)?:\/\/[^\s/@'"]+:[^\s@'"]+@[^\s'"]+/giu,
  // A bearer token in a header or a sentence.
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gu,
]

const MIN_VALUE_LENGTH = 6

function serverOnlyValues(): readonly string[] {
  const values: string[] = []
  for (const name of SERVER_ONLY_VARIABLES) {
    const value = process.env[name]
    if (typeof value === 'string' && value.length >= MIN_VALUE_LENGTH) values.push(value)
  }
  // Longest first, so a value that contains another is replaced whole.
  return values.sort((a, b) => b.length - a.length)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

/** Layers 2 and 3 over one string: known values, then shapes. */
export function redactString(value: string): string {
  let out = value
  for (const secret of serverOnlyValues()) {
    if (!out.includes(secret)) continue
    out = out.replace(new RegExp(escapeRegExp(secret), 'gu'), REDACTED)
  }
  for (const shape of SHAPES) out = out.replace(shape, REDACTED)
  return out
}

function isRedactedKey(key: string): boolean {
  if (KEPT_KEYS.has(key)) return false
  if ((SERVER_ONLY_VARIABLES as readonly string[]).includes(key.toUpperCase())) return true
  const lowered = key.toLowerCase()
  return REDACTED_KEYS.some((needle) => lowered.includes(needle))
}

/** Recursively strip anything whose key looks like a secret or personal data, and scrub strings. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[too deep]'
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return redactString(value)
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1))
  if (typeof value !== 'object') return value

  const out: Record<string, unknown> = {}
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    out[key] = isRedactedKey(key) ? REDACTED : redact(inner, depth + 1)
  }
  return out
}

/** The same, for callers that hold an object and want the same type back. */
export function redactDeep<T extends Record<string, unknown>>(value: T): T {
  return redact(value) as T
}
