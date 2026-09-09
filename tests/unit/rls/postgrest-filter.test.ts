import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { containsValue, escapeLikePattern } from '@/lib/supabase/filter'

/**
 * The two escaping layers a Studio search term crosses, checked at both ends.
 *
 * THIS FILE IS IN THE `rls` PROJECT BECAUSE HALF OF IT NEEDS POSTGRES, and that half is the half
 * worth having. Asserting that `containsValue('50%')` returns a particular string only proves the
 * function does what I wrote; it does not prove that what I wrote is what `ilike` needs. So the
 * escaped pattern is handed to a real server and the match is observed.
 *
 * The PostgREST layer cannot be asserted the same way — there is no PostgREST in this repository's
 * local stack — so it is modelled instead, by `unquote()` below, which implements the documented
 * rule and nothing else. That is honest about what is proven: layer 2 is verified, layer 1 is
 * verified against a written-down specification of the grammar rather than against the parser.
 *
 * These do not touch the fixture and take no advisory lock — every query here is a scalar
 * expression against no table at all.
 */

const HAVE_DB = process.env.DATABASE_URL !== undefined
const describeDb = HAVE_DB ? describe : describe.skip

/**
 * PostgREST's rule for a double-quoted filter value: the quotes delimit, and inside them a
 * backslash escapes the next character. Reserved characters (`,` `(` `)`) carry no meaning.
 */
function unquote(value: string): string {
  if (!value.startsWith('"') || !value.endsWith('"')) {
    throw new Error(`not a quoted value: ${value}`)
  }
  return value.slice(1, -1).replace(/\\(.)/g, '$1')
}

describe('escapeLikePattern', () => {
  it('escapes the three characters LIKE treats as special', () => {
    expect(escapeLikePattern('50%')).toBe('50\\%')
    expect(escapeLikePattern('a_b')).toBe('a\\_b')
    expect(escapeLikePattern('a\\b')).toBe('a\\\\b')
  })

  it('leaves an ordinary term untouched', () => {
    expect(escapeLikePattern('Aarohi')).toBe('Aarohi')
  })
})

describe('containsValue', () => {
  it('wraps the pattern in quotes so a comma cannot split the or() list', () => {
    // The defect this exists for: unquoted, the comma ends the first condition and "small" is
    // parsed as a second one, which is not a condition at all — PostgREST answers 400.
    expect(containsValue('blue, small')).toBe('"%blue, small%"')
    expect(unquote(containsValue('blue, small'))).toBe('%blue, small%')
  })

  it('survives a closing parenthesis, which would otherwise end the group early', () => {
    expect(unquote(containsValue('chair (oak)'))).toBe('%chair (oak)%')
  })

  it('escapes a quote and a backslash for the transport layer', () => {
    expect(containsValue('say "hi"')).toBe('"%say \\"hi\\"%"')
    expect(unquote(containsValue('say "hi"'))).toBe('%say "hi"%')
  })

  it('applies the LIKE layer first, so its escapes survive transport intact', () => {
    // Order is the whole correctness argument: unquoting must yield a pattern that still has the
    // backslash in front of the percent, or "50%" goes back to matching every row.
    expect(unquote(containsValue('50%'))).toBe('%50\\%%')
    expect(unquote(containsValue('a\\b'))).toBe('%a\\\\b%')
  })
})

describeDb('the escaped pattern, against a real server', () => {
  let client: pg.Client

  beforeAll(async () => {
    client = new pg.Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
  })

  afterAll(async () => {
    await client.end()
  })

  /** What the database is actually asked, once both layers have been unwound. */
  async function matches(subject: string, term: string): Promise<boolean> {
    const pattern = unquote(containsValue(term))
    const { rows } = await client.query<{ hit: boolean }>('select $1::text ilike $2::text as hit', [
      subject,
      pattern,
    ])
    return rows[0]?.hit ?? false
  }

  it('matches a substring, case-insensitively', async () => {
    expect(await matches('Aarohi Console', 'aarohi')).toBe(true)
    expect(await matches('Aarohi Console', 'sideboard')).toBe(false)
  })

  it('treats a percent sign as a literal, not as "anything"', async () => {
    expect(await matches('Reduced 50% this week', '50%')).toBe(true)
    // The bug: unescaped, `%50%%` matches a title with no percent sign in it at all.
    expect(await matches('Aarohi Console', '50%')).toBe(false)
  })

  it('treats an underscore as a literal, not as "any one character"', async () => {
    expect(await matches('model_a', 'model_a')).toBe(true)
    expect(await matches('modelXa', 'model_a')).toBe(false)
  })

  it('matches a literal backslash', async () => {
    expect(await matches('back\\slash', 'back\\slash')).toBe(true)
    expect(await matches('backXslash', 'back\\slash')).toBe(false)
  })

  it('matches a term containing the characters that broke the filter', async () => {
    expect(await matches('Chair, oak (small)', 'chair, oak (small)')).toBe(true)
    expect(await matches('Chair oak small', 'chair, oak (small)')).toBe(false)
  })
})
