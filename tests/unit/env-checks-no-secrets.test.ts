import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SERVER_ONLY_VARIABLES } from '@/lib/logging/redact'
import {
  CHECK_CODES,
  CHECK_STATUSES,
  ENV_CHECKS,
  type CheckResult,
  type EnvCheck,
} from '@/lib/ops/env-checks'
import { runCheck, runEnvironmentChecks } from '@/lib/ops/environment'

/**
 * No secret reaches the environment page — Phase 38's load-bearing test.
 *
 * EVERY D8 SERVER-ONLY VARIABLE IS SET TO A UNIQUE SENTINEL, every check is run against a stubbed
 * network that ECHOES the request (URL, headers and body) back as its error, every result is
 * serialised, and the test fails if any sentinel or any four-character fragment of one appears.
 * The stub is the adversary: a check that put a credential in a URL or leaked an upstream body
 * into its result would be caught here, not in production.
 *
 * The suite also proves the shape: five statuses, a fixed code set, `configured` a boolean and
 * never a length, and NOT_CONFIGURED without a probe when a name is absent.
 */

const saved = new Map<string, string | undefined>()
const sentinels = new Map<string, string>()

beforeEach(() => {
  for (const name of SERVER_ONLY_VARIABLES) {
    saved.set(name, process.env[name])
    const sentinel = `SENTINEL${name.replace(/_/gu, '')}${Math.random().toString(36).slice(2, 10)}`
    sentinels.set(name, sentinel)
    process.env[name] =
      name === 'GOOGLE_SERVICE_ACCOUNT_JSON'
        ? JSON.stringify({
            client_email: 'rivya@example.iam.gserviceaccount.com',
            private_key: `-----BEGIN PRIVATE KEY-----\n${sentinel}\n-----END PRIVATE KEY-----\n`,
            token_uri: 'https://oauth2.googleapis.com/token',
          })
        : sentinel
  }
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-for-the-test'
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'rivya-test'
})

afterEach(() => {
  for (const name of SERVER_ONLY_VARIABLES) {
    const value = saved.get(name)
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

/** A network that answers 500 with everything it was sent — the worst upstream there is. */
const echoingFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const headers = JSON.stringify(init?.headers ?? {})
  const body = typeof init?.body === 'string' ? init.body : ''
  return new Response(`echo ${url} ${headers} ${body}`, { status: 500 })
}

function fragments(): string[] {
  const out: string[] = []
  for (const sentinel of sentinels.values()) {
    for (let i = 0; i + 4 <= sentinel.length; i += 4) out.push(sentinel.slice(i, i + 4))
  }
  return out
}

function leaks(text: string): string[] {
  return [...sentinels.values(), ...fragments()].filter((fragment) => text.includes(fragment))
}

describe('the environment checks', () => {
  it('never surface a sentinel or a fragment of one, whatever the upstream echoes', async () => {
    const results = await runEnvironmentChecks({
      fetch: echoingFetch,
      log: false,
      timeoutMs: 2_000,
    })
    const serialised = JSON.stringify(results)
    expect(leaks(serialised)).toEqual([])
    for (const result of results) {
      expect(CHECK_STATUSES).toContain(result.status)
      expect(CHECK_CODES).toContain(result.code)
      expect(typeof result.configured).toBe('boolean')
      for (const value of Object.values(result.detail)) {
        expect(['string', 'number', 'boolean']).toContain(typeof value)
      }
    }
  })

  it('reports NOT_CONFIGURED without probing when a required name is absent', async () => {
    delete process.env.CLOUDINARY_API_SECRET
    let probed = false
    const spying: typeof fetch = async (...args) => {
      probed = true
      return echoingFetch(...args)
    }
    const cloudinary = ENV_CHECKS.find((check) => check.id === 'cloudinary')
    expect(cloudinary).toBeDefined()
    const result = await runCheck(cloudinary as EnvCheck, { fetch: spying, log: false })
    expect(result).toMatchObject({
      configured: false,
      status: 'NOT_CONFIGURED',
      code: 'NOT_CONFIGURED',
    })
    expect(probed).toBe(false)
  })

  it('maps an upstream refusal to a fixed code and never its text', async () => {
    const refusing: typeof fetch = async () =>
      new Response(`denied for ${sentinels.get('CLOUDINARY_API_KEY') ?? ''} at /usage?key=leak`, {
        status: 401,
      })
    const cloudinary = ENV_CHECKS.find((check) => check.id === 'cloudinary') as EnvCheck
    const result = await runCheck(cloudinary, { fetch: refusing, log: false })
    expect(result.status).toBe('UNREACHABLE')
    expect(result.code).toBe('AUTH')
    expect(leaks(JSON.stringify(result))).toEqual([])
  })

  it('times out a hanging probe into UNREACHABLE/TIMEOUT', async () => {
    const hanging: typeof fetch = () => new Promise(() => undefined)
    const auth = ENV_CHECKS.find((check) => check.id === 'supabase_auth') as EnvCheck
    const result = await runCheck(auth, { fetch: hanging, log: false, timeoutMs: 50 })
    expect(result.status).toBe('UNREACHABLE')
    expect(result.code).toBe('TIMEOUT')
  })

  it('fails when a check tries to return a value (the demonstration the phase document asks for)', async () => {
    const leaky: EnvCheck = {
      id: 'cloudinary',
      requires: ['CLOUDINARY_API_SECRET'],
      channel: 'MEDIA',
      async probe() {
        return {
          status: 'OK',
          code: 'OK',
          // A careless check: the first four characters of the secret "for debugging".
          detail: { hint: (process.env.CLOUDINARY_API_SECRET ?? '').slice(0, 4) },
        }
      },
    }
    const result: CheckResult = await runCheck(leaky, { fetch: echoingFetch, log: false })
    // The runner's redactor cannot know four characters are a secret; the TEST is the guard.
    expect(leaks(JSON.stringify(result)).length).toBeGreaterThan(0)
  })
})
