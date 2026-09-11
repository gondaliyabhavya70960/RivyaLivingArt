import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  REDACTED,
  SERVER_ONLY_VARIABLES,
  redact,
  redactDeep,
  redactString,
} from '@/lib/logging/redact'

/**
 * The redactor — Phase 38. Three layers, one token: by key, by known value, by shape. Every
 * assertion is that the token is FIXED — never a prefix, never a suffix, never a length — because
 * D8's "never a value, prefix or length" is the rule, and a redactor that leaks four characters
 * has leaked the whole thing to anyone patient.
 */

const saved = new Map<string, string | undefined>()

beforeEach(() => {
  for (const name of SERVER_ONLY_VARIABLES) saved.set(name, process.env[name])
})
afterEach(() => {
  for (const name of SERVER_ONLY_VARIABLES) {
    const value = saved.get(name)
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

describe('by key', () => {
  it('strips every never-expose name from a nested payload, substituting the fixed token', () => {
    const out = redact({
      CLOUDINARY_API_SECRET: 'abc123',
      nested: { database_url: 'x', deeper: [{ Authorization: 'y', keep: 'z' }] },
      phone: '+91',
      keep: 1,
    }) as Record<string, unknown>
    expect(out.CLOUDINARY_API_SECRET).toBe(REDACTED)
    const nested = out.nested as Record<string, unknown>
    expect(nested.database_url).toBe(REDACTED)
    const deeper = nested.deeper as Record<string, unknown>[]
    expect(deeper[0]?.Authorization).toBe(REDACTED)
    expect(deeper[0]?.keep).toBe('z')
    expect(out.phone).toBe(REDACTED)
    expect(out.keep).toBe(1)
  })

  it('keeps event, error_code and dedupe_key, which are names and identifiers, and still strips message', () => {
    const out = redact({
      message: 'free text',
      event: 'sheets.run.failed',
      error_code: 'AUTH',
      dedupe_key: 'SHEETS:x:1',
    })
    expect(out).toEqual({
      message: REDACTED,
      event: 'sheets.run.failed',
      error_code: 'AUTH',
      dedupe_key: 'SHEETS:x:1',
    })
  })
})

describe('by value', () => {
  it('replaces the current value of every D8 server-only variable wherever it appears', () => {
    for (const name of SERVER_ONLY_VARIABLES)
      process.env[name] = `sentinel-${name.toLowerCase()}-9f3k`
    for (const name of SERVER_ONLY_VARIABLES) {
      const value = process.env[name] ?? ''
      const out = redactString(`failed: host said ${value} twice ${value}`)
      expect(out).toBe(`failed: host said ${REDACTED} twice ${REDACTED}`)
      expect(out).not.toContain(value.slice(0, 4))
    }
  })

  it('leaves a short or absent variable alone rather than redacting every letter', () => {
    process.env.CRON_SECRET = 'ab'
    expect(redactString('about')).toBe('about')
  })
})

describe('by shape', () => {
  it('replaces a JWT, a PEM block, a Cloudinary URL, a connection string and a bearer token', () => {
    // ASSEMBLED AT RUNTIME, NOT WRITTEN OUT: a literal that looks like a live credential trips
    // the repository's secret scanning on push, which is the scanner doing its job. The shapes
    // are what the redactor matches, and the shapes survive the concatenation.
    const jwt = [
      'eyJhbGciOiJIUzI1NiJ9',
      'eyJyb2xlIjoic2VydmljZV9yb2xlIn0',
      'abcdefghijklmnop',
    ].join('.')
    const fence = (kind: string) => `-----${kind} PRIVATE KEY-----`
    const pem = [fence('BEGIN'), 'MIIEvQIBADANBg', 'kqhkiG9w0BAQEF', fence('END')].join('\n')
    const escaped = [fence('BEGIN'), 'MIIEvQIBADANBg', fence('END')].join('\\n')
    const cloud = ['cloud', 'inary://123456789012:abcdefghijklmnop@rivya'].join('')
    const pg = [
      'postgresql://postgres:hunter2pass@db',
      'example',
      'supabase',
      'co:5432/postgres',
    ].join('.')
    const bearer = ['Authorization: Bearer', 'tok_test_abcdefghijklmnopqrstuvwxyz'].join(' ')
    for (const input of [jwt, pem, escaped, cloud, pg, bearer]) {
      const out = redactString(`before ${input} after`)
      expect(out, input).toContain(REDACTED)
      expect(out, input).not.toContain('MIIEvQ')
      expect(out, input).not.toContain('hunter2')
      expect(out, input).not.toContain('abcdefghijklmnop')
    }
  })

  it('redacts a shape inside a nested string value too', () => {
    const out = redactDeep({
      note: 'x',
      detail: {
        text: `token ${['eyJhbGciOiJIUzI1NiJ9', 'eyJhIjoxfQ', 'abcdefghijklmnop'].join('.')}`,
      },
    })
    expect((out.detail as { text: string }).text).toBe(`token ${REDACTED}`)
  })
})

describe('the token', () => {
  it('never carries a prefix, a suffix or a length', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-sentinel-value-0001'
    const out = redactString('key=service-role-sentinel-value-0001')
    expect(out).toBe(`key=${REDACTED}`)
    expect(out).not.toMatch(/\d{2,}/u)
    expect(REDACTED).toBe('[redacted]')
  })
})
