import 'server-only'

import { createSign } from 'node:crypto'

import { z } from 'zod'

import { SheetsError, errorForStatus } from './errors'
import { RetryableUpstream, isRetryableStatus, parseRetryAfter } from './retry'

/**
 * The Google Sheets client — Phase 36. A service-account JWT minted with `node:crypto`, exchanged
 * for an access token, and three calls against the Sheets REST API. No SDK, no Drive scope.
 *
 * THE PRIVATE KEY IS READ HERE AND GOES NOWHERE. `loadCredentialsFromEnv()` parses
 * `GOOGLE_SERVICE_ACCOUNT_JSON` once and keeps the parsed object in module memory; the key is
 * handed to `createSign` and to nothing else. It is never returned from a function another module
 * can reach, never logged, never placed in an error, never written to a column.
 * `tests/unit/sheets-redaction.test.ts` injects a fake key through `createSheetsClient` and searches
 * every error, every run row and every log line for a fragment of it.
 *
 * THE SCOPE IS `spreadsheets` ONLY. The integration cannot list, open or share anything it was not
 * explicitly given; sharing the sheet with the service-account email is the admin's step.
 *
 * ONE READ, AND IT IS OF STRUCTURE, NOT CELLS. `getSpreadsheetSheets` fetches the sheet ids and
 * titles the atomic swap needs. No call here reads a cell value, and `scripts/sheets/check-no-read.mjs`
 * fails the build on one.
 */

export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'
const TOKEN_TTL_SECONDS = 3600
const TOKEN_REFRESH_MARGIN_MS = 60_000

const credentialsSchema = z.object({
  client_email: z.string().email(),
  private_key: z.string().min(1),
  token_uri: z.string().url().default('https://oauth2.googleapis.com/token'),
})

export interface SheetsCredentials {
  readonly clientEmail: string
  readonly privateKey: string
  readonly tokenUri: string
}

let cached: SheetsCredentials | null | undefined

/** The service account from the environment, parsed once; null when the variable is absent or unreadable. */
export function loadCredentialsFromEnv(): SheetsCredentials | null {
  if (cached !== undefined) return cached
  const raw = process.env['GOOGLE_SERVICE_ACCOUNT_JSON']
  if (raw === undefined || raw.trim() === '') {
    cached = null
    return cached
  }
  try {
    const parsed = credentialsSchema.parse(JSON.parse(raw))
    cached = {
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
      tokenUri: parsed.token_uri,
    }
  } catch {
    // Unreadable JSON is NOT_CONFIGURED, not a crash: the page says so and nothing else degrades.
    cached = null
  }
  return cached
}

/** For display: the identity an admin shares the spreadsheet with. Null when not configured. */
export function serviceAccountEmail(): string | null {
  return loadCredentialsFromEnv()?.clientEmail ?? null
}

/** The default destination. An identifier, not a secret; a definition may override it. */
export function defaultSpreadsheetId(): string | null {
  const raw = process.env['GOOGLE_SHEETS_SPREADSHEET_ID']
  return raw === undefined || raw.trim() === '' ? null : raw.trim()
}

export interface SheetProperties {
  readonly sheetId: number
  readonly title: string
}

export interface SheetsClient {
  readonly email: string
  /** Sheet ids and titles — structure, never cells. */
  getSpreadsheetSheets(spreadsheetId: string): Promise<readonly SheetProperties[]>
  /** Write a block of values at an A1 range. RAW input: nothing is parsed as a formula. */
  putValues(
    spreadsheetId: string,
    rangeA1: string,
    values: readonly (readonly (string | number | null)[])[],
  ): Promise<void>
  /** One `spreadsheets.batchUpdate` request: add, clear, delete, rename. */
  batchUpdate(spreadsheetId: string, requests: readonly Record<string, unknown>[]): Promise<void>
}

export interface SheetsClientOptions {
  readonly credentials?: SheetsCredentials
  readonly fetch?: typeof fetch
  readonly now?: () => number
}

const base64url = (input: Buffer | string): string => Buffer.from(input).toString('base64url')

/** The assertion Google exchanges for an access token. Signed RS256 with the service-account key. */
export function mintAssertion(credentials: SheetsCredentials, nowMs: number): string {
  const iat = Math.floor(nowMs / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(
    JSON.stringify({
      iss: credentials.clientEmail,
      scope: SHEETS_SCOPE,
      aud: credentials.tokenUri,
      iat,
      exp: iat + TOKEN_TTL_SECONDS,
    }),
  )
  const input = `${header}.${claims}`
  const signature = createSign('RSA-SHA256')
    .update(input)
    .end()
    .sign(credentials.privateKey, 'base64url')
  return `${input}.${signature}`
}

/**
 * Throw the right thing for a non-2xx status: a retryable marker for 429/5xx, a fixed-code error
 * for everything else. The response body is NOT read into the error.
 */
function refuse(response: Response, nowMs: number): never {
  if (isRetryableStatus(response.status)) {
    throw new RetryableUpstream(
      response.status,
      parseRetryAfter(response.headers.get('retry-after'), nowMs),
    )
  }
  throw errorForStatus(response.status)
}

export function createSheetsClient(options: SheetsClientOptions = {}): SheetsClient {
  const loaded = options.credentials ?? loadCredentialsFromEnv()
  if (loaded === null) throw new SheetsError('NOT_CONFIGURED')
  // A separate binding: narrowing does not survive into the hoisted function declarations below.
  const credentials: SheetsCredentials = loaded
  const fetchImpl = options.fetch ?? fetch
  const now = options.now ?? Date.now

  let token: { readonly value: string; readonly expiresAt: number } | null = null

  async function accessToken(): Promise<string> {
    const at = now()
    if (token !== null && token.expiresAt - TOKEN_REFRESH_MARGIN_MS > at) return token.value
    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: mintAssertion(credentials, at),
    })
    const response = await fetchImpl(credentials.tokenUri, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!response.ok) refuse(response, at)
    const parsed = z
      .object({
        access_token: z.string().min(1),
        expires_in: z.number().int().positive().optional(),
      })
      .safeParse(await response.json())
    if (!parsed.success) throw new SheetsError('AUTH', response.status)
    token = {
      value: parsed.data.access_token,
      expiresAt: at + (parsed.data.expires_in ?? TOKEN_TTL_SECONDS) * 1000,
    }
    return token.value
  }

  async function request(
    method: 'GET' | 'PUT' | 'POST',
    url: string,
    body?: unknown,
  ): Promise<unknown> {
    const bearer = await accessToken()
    const response = await fetchImpl(url, {
      method,
      headers: {
        authorization: `Bearer ${bearer}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    if (!response.ok) refuse(response, now())
    if (method === 'GET') return await response.json()
    return null
  }

  return {
    email: credentials.clientEmail,

    async getSpreadsheetSheets(spreadsheetId) {
      const url = `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}?fields=${encodeURIComponent('sheets.properties(sheetId,title)')}`
      const parsed = z
        .object({
          sheets: z
            .array(z.object({ properties: z.object({ sheetId: z.number(), title: z.string() }) }))
            .default([]),
        })
        .safeParse(await request('GET', url))
      if (!parsed.success) throw new SheetsError('WRITE')
      return parsed.data.sheets.map((sheet) => sheet.properties)
    },

    async putValues(spreadsheetId, rangeA1, values) {
      const url =
        `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(rangeA1)}` +
        '?valueInputOption=RAW'
      await request('PUT', url, { range: rangeA1, majorDimension: 'ROWS', values })
    },

    async batchUpdate(spreadsheetId, requests) {
      const url = `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}:batchUpdate`
      await request('POST', url, { requests })
    },
  }
}
