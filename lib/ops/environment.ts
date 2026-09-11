import { logSystem } from '@/lib/logging/system-log'
import { redact } from '@/lib/logging/redact'

import { ENV_CHECKS, type CheckDetail, type CheckResult, type EnvCheck } from './env-checks'

/**
 * The check runner — Phase 38. Every check in parallel, each under a 3-second timeout, each
 * result passed through the redactor before it is returned, each failure logged on its channel.
 *
 * `configured` IS PRESENCE, COLLAPSED TO A BOOLEAN HERE. A check declares the variable NAMES it
 * needs; the runner asks whether each is present and non-empty and keeps only the answer — the
 * length never leaves this function, and a check that is not configured is never probed, so a
 * missing variable is `NOT_CONFIGURED`, not an error trace.
 */

export const CHECK_TIMEOUT_MS = 3_000

export interface RunOptions {
  readonly checks?: readonly EnvCheck[]
  readonly env?: NodeJS.ProcessEnv
  readonly fetch?: typeof fetch
  readonly timeoutMs?: number
  readonly now?: () => number
  readonly log?: boolean
}

function isPresent(env: NodeJS.ProcessEnv, name: string): boolean {
  const value = env[name]
  return typeof value === 'string' && value.length > 0
}

function cleanDetail(detail: CheckDetail | undefined): CheckDetail {
  const out: Record<string, string | number | boolean> = {}
  const redacted = redact(detail ?? {}) as Record<string, unknown>
  for (const [key, value] of Object.entries(redacted)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value
    }
  }
  return out
}

export async function runCheck(check: EnvCheck, options: RunOptions = {}): Promise<CheckResult> {
  const env = options.env ?? process.env
  const now = options.now ?? Date.now
  const started = now()
  const checkedAt = new Date(started).toISOString()
  const configured = check.requires.every((name) => isPresent(env, name))

  if (!configured) {
    return {
      id: check.id,
      configured: false,
      status: 'NOT_CONFIGURED',
      latencyMs: 0,
      checkedAt,
      code: 'NOT_CONFIGURED',
      detail: {},
    }
  }

  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? CHECK_TIMEOUT_MS
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let outcome
  try {
    outcome = await Promise.race([
      check.probe({ fetch: options.fetch ?? fetch, env, signal: controller.signal }),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          const error = new Error('timed out')
          error.name = 'TimeoutError'
          reject(error)
        })
      }),
    ])
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    outcome = {
      status: 'UNREACHABLE' as const,
      code:
        name === 'TimeoutError' || name === 'AbortError'
          ? ('TIMEOUT' as const)
          : ('UNKNOWN' as const),
    }
  } finally {
    clearTimeout(timer)
  }

  const result: CheckResult = {
    id: check.id,
    configured: true,
    status: outcome.status,
    latencyMs: Math.max(0, now() - started),
    checkedAt,
    code: outcome.code,
    detail: cleanDetail(outcome.detail),
  }

  if (options.log !== false && (result.status === 'UNREACHABLE' || result.status === 'DEGRADED')) {
    await logSystem({
      level: result.status === 'UNREACHABLE' ? 'ERROR' : 'WARNING',
      channel: check.channel,
      event: `environment.check.${result.status.toLowerCase()}`,
      message: `Environment check ${check.id} reported ${result.status} (${result.code})`,
      context: { check: check.id, code: result.code, latency_ms: result.latencyMs },
      entityType: 'environment_check',
    })
  }

  return result
}

export async function runEnvironmentChecks(
  options: RunOptions = {},
): Promise<readonly CheckResult[]> {
  const checks = options.checks ?? ENV_CHECKS
  return Promise.all(checks.map((check) => runCheck(check, options)))
}

/** The worst status across the checks, for the dashboard card and the page heading. */
export function worstStatus(results: readonly CheckResult[]): CheckResult['status'] {
  const order: CheckResult['status'][] = [
    'UNREACHABLE',
    'DEGRADED',
    'UNKNOWN',
    'NOT_CONFIGURED',
    'OK',
  ]
  for (const status of order) if (results.some((result) => result.status === status)) return status
  return 'OK'
}
