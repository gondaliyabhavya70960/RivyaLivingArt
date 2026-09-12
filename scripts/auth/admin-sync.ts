import { readBootstrapConfig, type BootstrapConfig } from '../../lib/auth/bootstrap'
import { scopeOf, type Scope } from '../ops/check-env'

/**
 * Should this build apply the Vercel environment to the Studio's owner account?
 *
 * AMENDMENT A44 MOVED THESE VARIABLES FROM "bootstrap input" TO "source of truth". Until it,
 * `STUDIO_ADMIN_*` described an account to create once; now, on a production deployment, they
 * describe what the owner account IS — address, role, display name, and above all the password —
 * and every production build reconciles the account to match. Put a new password into the Vercel
 * dashboard, redeploy, and that is the Studio password.
 *
 * THE COST, STATED PLAINLY BECAUSE IT IS EASY TO MEET BY ACCIDENT: a password set any other way
 * does not survive the next production deploy. `/studio/forgot-password` still works end to end and
 * still leaves a usable session — but for THIS account the new password lasts until the next
 * deployment overwrites it. Changing the owner's password now means changing the Vercel variable
 * and redeploying. That is the trade the owner chose in full knowledge of it; `auth:bootstrap`
 * keeps the opposite, safer default, and every other account is unaffected.
 *
 * WHY THIS LIVES UNDER `scripts/` AND NOT `lib/`. It reads `scopeOf` from the environment checker,
 * and a module under `lib/` importing one under `scripts/` is a layering inversion that would drag
 * `node:fs` toward anything in `app/` that ever touched it. The decision is operations tooling, so
 * it sits with the tooling; its test is `tests/unit/admin-sync.test.ts`.
 *
 * WHY IT IS A PURE FUNCTION AT ALL. "Should this run" is a decision over an environment, and it is
 * severe in both directions: run it on a preview and two deployments fight over one account on the
 * single Supabase project (amendment A42); fail to run it on production and the owner's dashboard
 * edit silently does nothing. A decision that consequential is worth attacking in a test without a
 * network, a build or a database.
 */

export type SyncDecision =
  | { readonly run: true; readonly config: BootstrapConfig }
  | { readonly run: false; readonly reason: string }

/** The two Supabase credentials this sync needs, beyond the four it is configured by. */
const SUPABASE_VARIABLES = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const

/**
 * Decide, from an environment alone.
 *
 * PRODUCTION ONLY, and the reason is arithmetic rather than caution: this deployment has ONE
 * Supabase project, so a preview build applying its own `STUDIO_ADMIN_PASSWORD` would be rewriting
 * the live owner's password from a branch. Every other scope declines.
 *
 * A MISSING OR HALF-SET CONFIGURATION IS A DECLINE, NEVER A FAILURE. This runs inside `next build`,
 * and the worst thing it could do is take a deployment down over an account nobody configured.
 * The caller reports the reason and exits 0.
 */
export function decideAdminSync(env: Readonly<Record<string, string | undefined>>): SyncDecision {
  const scope: Scope = scopeOf(env)
  if (scope !== 'production') {
    return {
      run: false,
      reason: `the build scope is ${scope}, and only production syncs the owner account`,
    }
  }

  const result = readBootstrapConfig(env)
  if (result.state === 'ABSENT') {
    return {
      run: false,
      reason: 'no STUDIO_ADMIN_* variable is set, so there is no account to apply',
    }
  }
  if (result.state === 'INVALID') {
    return {
      run: false,
      reason: `the bootstrap environment is incomplete: ${result.problems.join('; ')}`,
    }
  }

  /*
   * The Supabase credentials are checked here rather than left to `requiredEnv`, because that
   * throws and this function must only ever decline. Their absence is also a different mistake with
   * a different fix from a missing STUDIO_ADMIN_*, so it earns its own sentence.
   */
  for (const name of SUPABASE_VARIABLES) {
    const value = env[name]
    if (value === undefined || value.trim() === '') {
      return { run: false, reason: `${name} is not set, so the auth service cannot be reached` }
    }
  }

  return { run: true, config: result.config }
}
