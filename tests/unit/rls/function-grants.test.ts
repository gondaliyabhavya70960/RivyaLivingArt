import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { asSession, disconnect } from './harness'

/**
 * Who may EXECUTE the functions in `public`, asserted in both directions.
 *
 * `0022_function_grants.sql` records the rule and the reason: PostgreSQL grants EXECUTE on every
 * new function to PUBLIC, and Supabase turns anything callable into a PostgREST RPC endpoint. Every
 * migration since is meant to revoke it. `0143` closed five that had not.
 *
 * THIS FILE EXISTS BECAUSE THE OBVIOUS FIX BREAKS THE SITE, and it did — the first draft of `0143`
 * revoked all three grants from all five functions and turned twenty tests red with
 * `permission denied for function is_valid_dimensions`.
 *
 * The distinction it missed is the whole subject here:
 *
 *   * A TRIGGER FUNCTION is invoked by the executor when the trigger fires, on a path that does not
 *     test the writing user's EXECUTE privilege. Revoke everything; nothing needs it.
 *   * A CONSTRAINT FUNCTION is evaluated AS THE WRITING USER. `products_dimensions_shape` calls
 *     `is_valid_dimensions` on every write to `products`, so revoking EXECUTE from `authenticated`
 *     does not harden anything — it makes the table unwritable by staff, with an error naming a
 *     function no editor has heard of.
 *
 * So the first test below is the security assertion and the second is the availability one. A
 * future blanket revoke satisfies the first and fails the second, which is the correct way round:
 * the failure arrives in CI rather than in the Studio.
 */

const REQUIRE_DB = process.env.CI === 'true' || process.env.RLS_TESTS_REQUIRED === '1'
const HAVE_DB = Boolean(process.env.DATABASE_URL)

if (REQUIRE_DB && !HAVE_DB) {
  throw new Error(
    'DATABASE_URL is not set and this environment requires the database suite to run. ' +
      'Refusing to skip: a skipped guard suite reports success while proving nothing.',
  )
}

const describeDb = HAVE_DB ? describe : describe.skip
const asOwner = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', '00000000-0000-4000-8000-0000000000a1', fn)

describeDb('EXECUTE grants on public functions', () => {
  afterAll(disconnect)

  it('leaves no function in public callable by anon', async () => {
    // The whole point of the rule: an anon-executable function is a PostgREST RPC endpoint whether
    // or not anyone meant to publish one.
    const rows = await asOwner((sql) =>
      sql.rows<{ signature: string }>(
        `select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as signature
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and has_function_privilege('anon', p.oid, 'execute')
          order by 1`,
      ),
    )
    expect(rows.map((r) => r.signature)).toEqual([])
  })

  it('keeps is_valid_dimensions executable by the roles that write products', async () => {
    // Not a redundant inverse of the test above. `products_dimensions_shape` is a CHECK constraint,
    // and a CHECK is evaluated as the writing user — so this grant is what makes `products`
    // writable at all. Revoking it is the mistake this file was written to stop repeating.
    const [row] = await asOwner((sql) =>
      sql.rows<{ authenticated: boolean; service_role: boolean }>(
        `select has_function_privilege('authenticated', 'public.is_valid_dimensions(jsonb)', 'execute') as authenticated,
                has_function_privilege('service_role',  'public.is_valid_dimensions(jsonb)', 'execute') as service_role`,
      ),
    )
    expect(row?.authenticated).toBe(true)
    expect(row?.service_role).toBe(true)
  })

  it('proves the grant is load-bearing: a staff write to products still succeeds', async () => {
    // The end-to-end version of the assertion above. If the grant is ever revoked, this fails with
    // `permission denied for function is_valid_dimensions` rather than with anything about
    // dimensions — which is exactly how confusing the original breakage was.
    const result = await asOwner((sql) =>
      sql.attempt(
        `insert into products (slug, title, price_state, dimensions)
         values ('grant-probe', 'Grant probe', 'REQUEST_QUOTE', '{"length_mm": 1800}'::jsonb)`,
      ),
    )
    expect(result.ok).toBe(true)
  })
})
