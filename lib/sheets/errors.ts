import type { SheetsErrorCode } from '@/lib/supabase/schemas/sheets'

/**
 * Every failure the Sheets integration can report, as a FIXED code with a FIXED sentence.
 *
 * THE MESSAGE NEVER CARRIES THE UPSTREAM BODY. A Google error payload can echo the request URL,
 * the spreadsheet id and — in the token exchange — fragments of the assertion; persisting or
 * displaying it would be the leak `sheets-redaction.test.ts` exists to catch. So an error here
 * knows the HTTP status it came from and nothing else the upstream said.
 */

export const SHEETS_ERROR_MESSAGES: Readonly<Record<SheetsErrorCode, string>> = {
  NOT_CONFIGURED:
    'The Google service account or the spreadsheet id is not configured in this environment.',
  FLAG_OFF: 'The google_sheets flag is off. Nothing is written while it is off.',
  AUTH: 'Google refused the credentials or the spreadsheet is not shared with the service account. Share the spreadsheet with the service-account email shown on the Sheets page.',
  QUOTA: 'Google rate-limited the request. The run retried and gave up.',
  UPSTREAM: 'Google answered with a server error. The run retried and gave up.',
  WRITE: 'The tab could not be written. The previous tab is untouched.',
  NO_SCOPE: 'This definition needs a scope (a comparison set) before it can run.',
  INVALID_COLUMNS: 'The definition names a column outside the entity’s allowlist.',
  PAUSED: 'This definition is paused after repeated failures. Resume it to run again.',
  DISABLED: 'This definition is disabled.',
  RUNNING: 'A run for this definition is already in progress.',
  FORBIDDEN: 'You do not hold the permission this export needs.',
  DRY_RUN: 'Dry run: rows were built and counted; nothing was written.',
}

export class SheetsError extends Error {
  constructor(
    readonly code: SheetsErrorCode,
    readonly status: number | null = null,
  ) {
    super(
      status === null
        ? SHEETS_ERROR_MESSAGES[code]
        : `${SHEETS_ERROR_MESSAGES[code]} (HTTP ${String(status)})`,
    )
    this.name = 'SheetsError'
  }
}

export class SheetsAuthError extends SheetsError {
  constructor(status: number) {
    super('AUTH', status)
    this.name = 'SheetsAuthError'
  }
}

export class SheetsQuotaError extends SheetsError {
  constructor(status: number) {
    super('QUOTA', status)
    this.name = 'SheetsQuotaError'
  }
}

export class SheetsWriteError extends SheetsError {
  constructor(status: number | null) {
    super('WRITE', status)
    this.name = 'SheetsWriteError'
  }
}

/** The code a final (post-retry) HTTP status maps to. */
export function codeForStatus(status: number): SheetsErrorCode {
  if (status === 401 || status === 403) return 'AUTH'
  if (status === 429) return 'QUOTA'
  if (status >= 500 && status <= 599) return 'UPSTREAM'
  return 'WRITE'
}

export function errorForStatus(status: number): SheetsError {
  const code = codeForStatus(status)
  if (code === 'AUTH') return new SheetsAuthError(status)
  if (code === 'QUOTA') return new SheetsQuotaError(status)
  if (code === 'UPSTREAM') return new SheetsError('UPSTREAM', status)
  return new SheetsWriteError(status)
}

/** Any thrown value, reduced to a code. Unknown errors are WRITE: something failed, we do not say what. */
export function codeOf(error: unknown): SheetsErrorCode {
  return error instanceof SheetsError ? error.code : 'WRITE'
}
