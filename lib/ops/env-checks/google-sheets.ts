import { loadCredentialsFromEnv, mintAssertion } from '@/lib/sheets/client'

import { outcomeForError, outcomeForHttp, type EnvCheck } from './types'

/**
 * Token mint only — no spreadsheet read. The service-account EMAIL is an identity and is reported;
 * the private key inside the JSON and the spreadsheet id are not (ENVIRONMENT §7.4).
 */
export const googleSheets: EnvCheck = {
  id: 'google_sheets',
  requires: ['GOOGLE_SERVICE_ACCOUNT_JSON'],
  channel: 'SHEETS',
  async probe({ fetch, signal }) {
    const credentials = loadCredentialsFromEnv()
    if (credentials === null) return { status: 'NOT_CONFIGURED', code: 'INVALID_CONFIG' }
    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: mintAssertion(credentials, Date.now()),
    })
    try {
      const response = await fetch(credentials.tokenUri, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal,
      })
      const outcome =
        response.status === 400
          ? { status: 'UNREACHABLE' as const, code: 'AUTH' as const }
          : outcomeForHttp(response.status)
      return { ...outcome, detail: { service_account_email: credentials.clientEmail } }
    } catch (error) {
      return outcomeForError(error)
    }
  },
}
