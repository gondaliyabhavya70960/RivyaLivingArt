import { describe, expect, it } from 'vitest'

import { decideAdminSync } from '@/scripts/auth/admin-sync'
import { BOOTSTRAP_VARIABLES } from '@/lib/auth/bootstrap'

/**
 * The decision that runs inside `next build` (amendment A44).
 *
 * IT IS SEVERE IN BOTH DIRECTIONS, which is why it is a pure function with a test rather than four
 * conditions inside a script nobody can exercise. Running when it should not means a preview
 * deployment rewriting the live owner's password from a branch — there is one Supabase project
 * (A42), so there is nowhere for a preview's password to go but production. Declining when it
 * should run means the owner changes the variable in Vercel, redeploys, and nothing happens.
 *
 * The second property under test is that it NEVER throws. It is called on the first line of a
 * production build; an exception there is a site that does not deploy because an account setting
 * was wrong.
 */

const SUPABASE = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'aaa.bbb.ccc',
}

const ADMIN = {
  [BOOTSTRAP_VARIABLES.email]: 'owner@example.com',
  [BOOTSTRAP_VARIABLES.password]: 'a-password-that-must-never-be-printed',
}

const PRODUCTION = { VERCEL_ENV: 'production', ...SUPABASE, ...ADMIN }

describe('decideAdminSync', () => {
  it('runs on a complete production environment', () => {
    const decision = decideAdminSync(PRODUCTION)
    expect(decision.run).toBe(true)
    if (!decision.run) return
    expect(decision.config.email).toBe('owner@example.com')
    expect(decision.config.role).toBe('owner')
  })

  it('declines on preview — one Supabase project means a preview would rewrite production', () => {
    const decision = decideAdminSync({ ...PRODUCTION, VERCEL_ENV: 'preview' })
    expect(decision.run).toBe(false)
    if (decision.run) return
    expect(decision.reason).toContain('preview')
  })

  it('declines on a developer machine, where VERCEL_ENV is unset', () => {
    const { VERCEL_ENV: _ignored, ...noScope } = PRODUCTION
    const decision = decideAdminSync(noScope)
    expect(decision.run).toBe(false)
    if (decision.run) return
    expect(decision.reason).toContain('development')
  })

  it('declines on an unrecognised scope rather than treating it as production', () => {
    // The fail-safe direction: anything that is not literally 'production' declines.
    for (const scope of ['Production', 'prod', 'staging', '']) {
      const decision = decideAdminSync({ ...PRODUCTION, VERCEL_ENV: scope })
      expect(decision.run, scope).toBe(false)
    }
  })

  it('declines when nothing is configured, and says so without alarm', () => {
    const decision = decideAdminSync({ VERCEL_ENV: 'production', ...SUPABASE })
    expect(decision.run).toBe(false)
    if (decision.run) return
    expect(decision.reason).toContain('no STUDIO_ADMIN_')
  })

  it('declines on a half-set configuration', () => {
    const decision = decideAdminSync({
      VERCEL_ENV: 'production',
      ...SUPABASE,
      [BOOTSTRAP_VARIABLES.email]: 'owner@example.com',
    })
    expect(decision.run).toBe(false)
    if (decision.run) return
    expect(decision.reason).toContain(BOOTSTRAP_VARIABLES.password)
  })

  it('declines when the Supabase credentials are missing, naming which one', () => {
    for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
      const env: Record<string, string | undefined> = { ...PRODUCTION }
      delete env[name]
      const decision = decideAdminSync(env)
      expect(decision.run, name).toBe(false)
      if (decision.run) return
      expect(decision.reason).toContain(name)
    }
  })

  it('never puts the password into a reason, whatever is wrong', () => {
    // Every declining branch, checked against the one value that must never reach a build log.
    const cases = [
      { ...PRODUCTION, VERCEL_ENV: 'preview' },
      { ...PRODUCTION, VERCEL_ENV: undefined },
      {
        VERCEL_ENV: 'production',
        ...SUPABASE,
        [BOOTSTRAP_VARIABLES.email]: 'not-an-address',
        [BOOTSTRAP_VARIABLES.password]: ADMIN[BOOTSTRAP_VARIABLES.password],
      },
      { VERCEL_ENV: 'production', ...ADMIN },
    ]
    for (const env of cases) {
      const decision = decideAdminSync(env)
      if (decision.run) continue
      expect(decision.reason).not.toContain(ADMIN[BOOTSTRAP_VARIABLES.password])
      expect(decision.reason).not.toContain(String(ADMIN[BOOTSTRAP_VARIABLES.password].length))
    }
  })

  it('never throws, on any shape of environment', () => {
    for (const env of [{}, { VERCEL_ENV: 'production' }, { VERCEL_ENV: 'production', ...ADMIN }]) {
      expect(() => decideAdminSync(env)).not.toThrow()
    }
  })
})

describe('the build runs it', () => {
  it('package.json calls sync-admin before next build', async () => {
    // The wiring is the feature. A decision module nothing invokes changes nothing on a deploy.
    const pkg = (await import('../../package.json')) as unknown as {
      default: { scripts: Record<string, string> }
    }
    expect(pkg.default.scripts.build).toContain('scripts/auth/sync-admin.ts')
    expect(pkg.default.scripts.build).toContain('next build')
  })
})
