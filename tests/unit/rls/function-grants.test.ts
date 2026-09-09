import { afterAll, describe, expect, it } from 'vitest'

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
 *
 * PHASE 20 INTRODUCED THE FIRST FUNCTIONS THAT ARE MEANT TO BE anon-CALLABLE, and the assertion
 * changed from "none" to "these four, and nothing else". It had to: the public submit path has no
 * session at all — D1 forbids customer accounts — so the visitor's own database work is done by
 * SECURITY DEFINER functions granted to `anon`. An allowlist is weaker than an empty list and
 * stronger than nothing, and it is the honest shape: each entry is named here with why it is
 * published, so adding a fifth is a decision somebody has to write down rather than a grant that
 * slips in behind a `create function`.
 *
 * The second Phase 20 assertion is what makes the allowlist safe: every published function must be
 * SECURITY DEFINER with a pinned `search_path`. A definer function without one is the classic
 * privilege-escalation shape — the caller sets `search_path`, the function resolves a table name to
 * something the caller wrote, and it runs as the owner.
 */

const REQUIRE_DB = process.env.CI === 'true' || process.env.RLS_TESTS_REQUIRED === '1'
const HAVE_DB = Boolean(process.env.DATABASE_URL)

if (REQUIRE_DB && !HAVE_DB) {
  throw new Error(
    'DATABASE_URL is not set and this environment requires the database suite to run. ' +
      'Refusing to skip: a skipped guard suite reports success while proving nothing.',
  )
}

/**
 * Every function in `public` that `anon` may EXECUTE, and why each one is published.
 *
 * ALPHABETICAL, BECAUSE THE QUERY ORDERS BY SIGNATURE and a hand-kept order would drift. Adding an
 * entry here is the moment to ask whether an anonymous caller should be able to do that thing at
 * all — the answer for all four below is yes, and for `consume_rate_limit` it was no, which is why
 * that one is granted to `service_role` alone and is not on this list.
 */
const ANON_CALLABLE = [
  // Creates USER_UPLOAD/DRAFT asset rows for a fresh enquiry's references and links them. anon
  // cannot insert into media_assets and must not be able to, so the work is done here — bounded to
  // five, refusing any public_id outside the folder upload-sign signs.
  'attach_inquiry_references(p_inquiry_id uuid, p_references jsonb)',
  // A boolean: was an enquiry with this id created in the last ten minutes and not yet triaged.
  // The two functions around it need to know, and this leaks nothing to a caller who must already
  // hold the uuid.
  'inquiry_is_fresh(p_inquiry_id uuid)',
  // The reference code of an enquiry just created. It exists because anon has no SELECT policy and
  // PostgreSQL applies the SELECT policy to INSERT ... RETURNING — see amendment A20.
  'inquiry_reference_code(p_inquiry_id uuid)',
  // Writes whatsapp_state and the shorten level on a fresh, untouched enquiry, and appends the
  // event. Two columns only: an anon UPDATE policy wide enough to do this by hand would be wide
  // enough to edit somebody else's phone number.
  'record_inquiry_handoff(p_inquiry_id uuid, p_state whatsapp_state, p_level integer)',
]

const describeDb = HAVE_DB ? describe : describe.skip
const asOwner = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', '00000000-0000-4000-8000-0000000000a1', fn)

describeDb('EXECUTE grants on public functions', () => {
  afterAll(disconnect)

  it('publishes to anon exactly the four functions the public submit path needs', async () => {
    // The whole point of the rule: an anon-executable function is a PostgREST RPC endpoint whether
    // or not anyone meant to publish one. These four were meant to be.
    const rows = await asOwner((sql) =>
      sql.rows<{ signature: string }>(
        `select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as signature
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and has_function_privilege('anon', p.oid, 'execute')
          order by 1`,
      ),
    )
    expect(rows.map((r) => r.signature)).toEqual(ANON_CALLABLE)
  })

  /**
   * The allowlist is only as safe as the functions on it, and this is the property that makes them
   * safe to publish. A SECURITY DEFINER function without a pinned `search_path` is the textbook
   * escalation: the caller sets the path, the function resolves an unqualified name to a table the
   * caller controls, and it executes as the owner.
   */
  it('grants anon nothing that is not a definer function with a pinned search_path', async () => {
    const rows = await asOwner((sql) =>
      sql.rows<{ signature: string; secdef: boolean; config: string | null }>(
        `select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as signature,
                p.prosecdef as secdef,
                array_to_string(p.proconfig, ',') as config
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and has_function_privilege('anon', p.oid, 'execute')
          order by 1`,
      ),
    )

    for (const row of rows) {
      expect(row.secdef, `${row.signature} is callable by anon and is not SECURITY DEFINER`).toBe(
        true,
      )
      expect(row.config ?? '', `${row.signature} does not pin search_path`).toContain(
        'search_path=',
      )
    }
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
