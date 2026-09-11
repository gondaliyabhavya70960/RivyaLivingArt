/**
 * The fixed shape every environment check returns — Phase 38, ENVIRONMENT.md §7.1.
 *
 * `status` is one of five words, `code` one of a fixed set, `detail` only identifiers, counts,
 * booleans and timestamps. AN UPSTREAM ERROR MESSAGE IS NEVER RENDERED OR STORED, because upstream
 * messages quote request URLs and occasionally credentials; a check maps what it saw to a code.
 * `configured` is computed from the PRESENCE of the variable name, collapsed to a boolean inside
 * the runner — the length never leaves.
 */

export const CHECK_IDS = [
  'supabase_db',
  'supabase_auth',
  'cloudinary',
  'google_sheets',
  'vercel',
  'higgsfield',
  'migrations',
  'build',
] as const
export type CheckId = (typeof CHECK_IDS)[number]

export const CHECK_STATUSES = [
  'OK',
  'DEGRADED',
  'UNREACHABLE',
  'NOT_CONFIGURED',
  'UNKNOWN',
] as const
export type CheckStatus = (typeof CHECK_STATUSES)[number]

export const CHECK_CODES = [
  'OK',
  'NOT_CONFIGURED',
  'INVALID_CONFIG',
  'TIMEOUT',
  'AUTH',
  'HTTP_ERROR',
  'NETWORK',
  'INVALID_RESPONSE',
  'MISSING_FILE',
  'INVALID_FILE',
  'BEHIND',
  'AHEAD',
  'UNKNOWN',
] as const
export type CheckCode = (typeof CHECK_CODES)[number]

/** Identifiers, counts, booleans, timestamps. Never a value. */
export type CheckDetail = Readonly<Record<string, string | number | boolean>>

export interface CheckResult {
  readonly id: CheckId
  readonly configured: boolean
  readonly status: CheckStatus
  readonly latencyMs: number
  readonly checkedAt: string
  readonly code: CheckCode
  readonly detail: CheckDetail
}

/** What a probe reports; the runner adds `configured`, timing and the timestamp. */
export interface ProbeOutcome {
  readonly status: CheckStatus
  readonly code: CheckCode
  readonly detail?: CheckDetail
}

export interface CheckDeps {
  readonly fetch: typeof fetch
  readonly env: NodeJS.ProcessEnv
  readonly signal: AbortSignal
}

export interface EnvCheck {
  readonly id: CheckId
  /** Variable NAMES that must be present for the probe to run at all. */
  readonly requires: readonly string[]
  /** The channel a failure is logged on. */
  readonly channel: 'SYSTEM' | 'MEDIA' | 'SHEETS' | 'AUTH'
  probe(deps: CheckDeps): Promise<ProbeOutcome>
}

/** Map an HTTP status to a code and a status without ever reading the body. */
export function outcomeForHttp(status: number): ProbeOutcome {
  if (status >= 200 && status < 300) return { status: 'OK', code: 'OK' }
  if (status === 401 || status === 403) return { status: 'UNREACHABLE', code: 'AUTH' }
  if (status === 429 || status === 503) return { status: 'DEGRADED', code: 'HTTP_ERROR' }
  return { status: 'UNREACHABLE', code: 'HTTP_ERROR' }
}

/** A thrown error becomes a code: an abort is a timeout, everything else is the network. */
export function outcomeForError(error: unknown): ProbeOutcome {
  const name = error instanceof Error ? error.name : ''
  if (name === 'AbortError' || name === 'TimeoutError') {
    return { status: 'UNREACHABLE', code: 'TIMEOUT' }
  }
  return { status: 'UNREACHABLE', code: 'NETWORK' }
}
