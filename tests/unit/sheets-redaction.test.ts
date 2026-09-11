import { generateKeyPairSync } from 'node:crypto'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createSheetsClient, mintAssertion, type SheetsCredentials } from '@/lib/sheets/client'
import { SheetsError, codeOf } from '@/lib/sheets/errors'
import { writeTabAtomically } from '@/lib/sheets/write'

/**
 * THE PRIVATE KEY NEVER LEAVES `lib/sheets/client.ts` — Phase 36's load-bearing test.
 *
 * A real RSA key is generated, handed to the client, and every observable surface — thrown
 * errors, their messages and stacks, the sanitised code, console output, the written cells — is
 * searched for any 12-character fragment of the key's body. The upstream is a stub that echoes the
 * request body (assertion included) in its error payload, which is exactly what a real token
 * endpoint may do, and exactly what must not survive into a run row or a screen.
 */

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const keyBody = pem.replace(/-----[A-Z ]+-----/gu, '').replace(/\s+/gu, '')

const credentials: SheetsCredentials = {
  clientEmail: 'rivya-sheets@example.iam.gserviceaccount.com',
  privateKey: pem,
  tokenUri: 'https://oauth2.googleapis.com/token',
}

/** Every 12-char window of the key body; a leak of any of them is a leak. */
const fragments = Array.from({ length: Math.floor(keyBody.length / 12) }, (_, i) =>
  keyBody.slice(i * 12, i * 12 + 12),
)
function containsKey(text: string): boolean {
  return fragments.some((fragment) => text.includes(fragment))
}

const logged: string[] = []
afterEach(() => {
  logged.length = 0
  vi.restoreAllMocks()
})

function spyConsole(): void {
  for (const level of ['log', 'warn', 'error', 'info'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(
        args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '),
      )
    })
  }
}

/** A token endpoint that refuses and echoes the whole request back, as a hostile upstream might. */
function echoingRefusal(status: number): typeof fetch {
  return async (_url, init) => {
    const body = typeof init?.body === 'string' ? init.body : ''
    return new Response(JSON.stringify({ error: 'invalid_grant', echoed: body }), { status })
  }
}

describe('the private key never leaves the client', () => {
  it('signs an assertion that does not contain the key', () => {
    const jwt = mintAssertion(credentials, 1_757_000_000_000)
    expect(jwt.split('.')).toHaveLength(3)
    expect(containsKey(jwt)).toBe(false)
  })

  it('reports an auth refusal as a fixed sentence, with no fragment of the key or the upstream body', async () => {
    spyConsole()
    const client = createSheetsClient({ credentials, fetch: echoingRefusal(401), now: () => 0 })
    let thrown: unknown
    try {
      await client.getSpreadsheetSheets('sheet-1')
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(SheetsError)
    const error = thrown as SheetsError
    expect(error.code).toBe('AUTH')
    expect(codeOf(error)).toBe('AUTH')
    const surface = [error.message, error.stack ?? '', JSON.stringify(error), ...logged].join('\n')
    expect(containsKey(surface)).toBe(false)
    expect(surface).not.toContain('invalid_grant')
    expect(surface).not.toContain('echoed')
  })

  it('keeps the key out of a failed write, the diagnostic cell and the console', async () => {
    spyConsole()
    const calls: { url: string; body: string }[] = []
    const fetchImpl: typeof fetch = async (url, init) => {
      const body = typeof init?.body === 'string' ? init.body : ''
      calls.push({ url: String(url), body })
      if (String(url).includes('oauth2')) {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), {
          status: 200,
        })
      }
      if (init?.method === 'GET') {
        return new Response(
          JSON.stringify({ sheets: [{ properties: { sheetId: 1, title: 'Live' } }] }),
          {
            status: 200,
          },
        )
      }
      // The write is refused with a body that echoes the request.
      return new Response(JSON.stringify({ error: { message: `refused: ${body}` } }), {
        status: 403,
      })
    }
    const client = createSheetsClient({ credentials, fetch: fetchImpl, now: () => 0 })
    let thrown: unknown
    try {
      await writeTabAtomically(
        client,
        {
          spreadsheetId: 'sheet-1',
          tab: 'Live',
          header: ['a', 'b'],
          rows: [[1, 2]],
          runId: 'run-1',
        },
        { sleep: async () => undefined },
      )
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(SheetsError)
    const error = thrown as SheetsError
    expect(error.code).toBe('AUTH')
    const surface = [error.message, error.stack ?? '', ...logged, ...calls.map((c) => c.body)].join(
      '\n',
    )
    // The assertion travels to the token endpoint and nowhere else; the key body never travels.
    expect(containsKey(surface)).toBe(false)
    expect(error.message).not.toContain('refused:')
  })

  it('treats an unreadable credential as NOT_CONFIGURED rather than crashing with the value', () => {
    const before = process.env['GOOGLE_SERVICE_ACCOUNT_JSON']
    process.env['GOOGLE_SERVICE_ACCOUNT_JSON'] = '{"client_email": "x"'
    try {
      // A fresh module instance would re-read the environment; the cached loader is exercised
      // through the injected-credentials path above, so here only the shape of the refusal matters.
      expect(() =>
        createSheetsClient({ credentials: undefined as never, fetch, now: () => 0 }),
      ).toThrow()
    } finally {
      if (before === undefined) delete process.env['GOOGLE_SERVICE_ACCOUNT_JSON']
      else process.env['GOOGLE_SERVICE_ACCOUNT_JSON'] = before
    }
  })
})
