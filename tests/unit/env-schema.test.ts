import { describe, expect, it } from 'vitest'

import { RULES, checkEnvironment, scopeOf } from '@/scripts/ops/check-env'

/**
 * THE ENVIRONMENT RULES — Phase 44, tested in Phase 42.
 *
 * `check-env.ts` runs in `prebuild` and as preflight gate 11, which means it runs where nobody is
 * watching and its output lands in a build log. Two properties matter more than any individual rule:
 *
 *   1. IT NEVER PRINTS A VALUE, prefix, suffix or length (D8, SECURITY §5). A leak here is a leak
 *      into a log that gets pasted into an issue.
 *   2. IT IS ENVIRONMENT-AWARE. Production must carry every secret; a preview must NOT carry the
 *      owner's phone number; development is allowed to be missing almost everything.
 *
 * The second is asserted by construction — `checkEnvironment` takes a bag of variables rather than
 * reading `process.env`, precisely so a preview can be exercised without one existing.
 */

/** A well-formed production environment. Every value here is a shape, not a secret. */
const COMPLETE: Record<string, string> = {
  NEXT_PUBLIC_SITE_URL: 'https://rivyalivingart.com',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'header.payload.signature',
  SUPABASE_SERVICE_ROLE_KEY: 'header.payload.signature',
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: 'example-cloud',
  CLOUDINARY_API_KEY: '000000000000000',
  CLOUDINARY_API_SECRET: 'not-a-real-secret',
  NEXT_PUBLIC_WHATSAPP_NUMBER: '+919999999999',
  CRON_SECRET: 'not-a-real-secret',
  IP_HASH_SALT: 'not-a-real-salt',
  RATE_LIMIT_SALT: 'not-a-real-salt',
}

const errorsOf = (scope: Parameters<typeof checkEnvironment>[0], env: Record<string, string>) =>
  checkEnvironment(scope, env).filter((finding) => finding.level === 'ERROR')

describe('which environment this is', () => {
  it('reads the platform variable and defaults to development', () => {
    expect(scopeOf({ VERCEL_ENV: 'production' })).toBe('production')
    expect(scopeOf({ VERCEL_ENV: 'preview' })).toBe('preview')
    expect(scopeOf({})).toBe('development')
    // Vercel's own third value. It is a development environment by every rule that matters here.
    expect(scopeOf({ VERCEL_ENV: 'development' })).toBe('development')
    expect(scopeOf({ VERCEL_ENV: 'staging' })).toBe('development')
  })
})

describe('presence', () => {
  it('passes a complete production environment', () => {
    expect(errorsOf('production', COMPLETE)).toEqual([])
  })

  it('names every missing production variable', () => {
    const findings = errorsOf('production', {})
    const missing = findings.map((finding) => finding.name)
    for (const rule of RULES.filter((r) => r.requiredIn.includes('production'))) {
      expect(missing, `${rule.name} is required in production`).toContain(rule.name)
    }
    for (const finding of findings) expect(finding.problem).toBe('is not set')
  })

  it('treats an empty string as absent', () => {
    /*
     * A DASHBOARD FIELD SAVED EMPTY IS THE COMMON CASE. `process.env` reports it as `''`, which is
     * present by `in` and useless by every other measure — so the rule is presence AND non-empty.
     */
    const errors = errorsOf('production', { ...COMPLETE, CRON_SECRET: '' })
    expect(errors.map((finding) => finding.name)).toEqual(['CRON_SECRET'])
    expect(errors[0]?.problem).toBe('is not set')
  })

  it('lets a developer run without the secrets a deployment needs', () => {
    // `next dev` with no Cloudinary secret and no cron secret is a developer, not a fault.
    const development = {
      NEXT_PUBLIC_SUPABASE_URL: COMPLETE['NEXT_PUBLIC_SUPABASE_URL']!,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: COMPLETE['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
      NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: COMPLETE['NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME']!,
    }
    expect(errorsOf('development', development)).toEqual([])
  })
})

describe('shape', () => {
  it('refuses a Supabase URL that is not https', () => {
    const errors = errorsOf('production', {
      ...COMPLETE,
      NEXT_PUBLIC_SUPABASE_URL: 'http://example.supabase.co',
    })
    expect(errors.map((finding) => finding.name)).toEqual(['NEXT_PUBLIC_SUPABASE_URL'])
    expect(errors[0]?.problem).toBe('is not https')
  })

  it('refuses a site URL with a trailing slash', () => {
    // It doubles every built URL — `${site}/products` becomes `https://…com//products`.
    const errors = errorsOf('production', {
      ...COMPLETE,
      NEXT_PUBLIC_SITE_URL: 'https://rivyalivingart.com/',
    })
    expect(errors[0]?.problem).toContain('trailing slash')
  })

  it('refuses a key that is not a three-segment JWT', () => {
    /*
     * THE TRUNCATION CASE. A dashboard field with a length limit silently cuts a service-role key,
     * and the failure it produces at runtime is an opaque 401 hours later.
     */
    const errors = errorsOf('production', {
      ...COMPLETE,
      SUPABASE_SERVICE_ROLE_KEY: 'header.payload',
    })
    expect(errors.map((finding) => finding.name)).toEqual(['SUPABASE_SERVICE_ROLE_KEY'])
    expect(errors[0]?.problem).toContain('three-segment')
  })

  it('refuses a WhatsApp number that is not E.164', () => {
    for (const bad of ['919999999999', '+0999999999', '+91 99999 99999', '+9199']) {
      const errors = errorsOf('production', { ...COMPLETE, NEXT_PUBLIC_WHATSAPP_NUMBER: bad })
      expect(
        errors.map((finding) => finding.name),
        bad,
      ).toEqual(['NEXT_PUBLIC_WHATSAPP_NUMBER'])
    }
    expect(
      errorsOf('production', { ...COMPLETE, NEXT_PUBLIC_WHATSAPP_NUMBER: '+14155550123' }),
    ).toEqual([])
  })

  it('checks the shape of a variable that is set even where it is not required', () => {
    /*
     * A MALFORMED OPTIONAL IS STILL A DEFECT. `SCRAPER_USER_AGENT` is required nowhere, but a
     * `NEXT_PUBLIC_SITE_URL` set in development and wrong will be wrong in production next week.
     */
    const errors = errorsOf('development', {
      NEXT_PUBLIC_SUPABASE_URL: 'not-a-url',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: COMPLETE['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
      NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: 'example-cloud',
    })
    expect(errors.map((finding) => finding.name)).toEqual(['NEXT_PUBLIC_SUPABASE_URL'])
    expect(errors[0]?.problem).toBe('is not a URL')
  })
})

describe("the preview rules — a person's phone and a shared database", () => {
  const preview = {
    NEXT_PUBLIC_SUPABASE_URL: COMPLETE['NEXT_PUBLIC_SUPABASE_URL']!,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: COMPLETE['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    SUPABASE_SERVICE_ROLE_KEY: COMPLETE['SUPABASE_SERVICE_ROLE_KEY']!,
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: COMPLETE['NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME']!,
    CLOUDINARY_API_KEY: COMPLETE['CLOUDINARY_API_KEY']!,
    CLOUDINARY_API_SECRET: COMPLETE['CLOUDINARY_API_SECRET']!,
  }

  it('does not require the WhatsApp number in a preview', () => {
    expect(errorsOf('preview', preview)).toEqual([])
  })

  it("refuses a preview carrying production's number", () => {
    /*
     * THE RULE THIS FILE EXISTS FOR. A reviewer clicking through a preview and reaching the handoff
     * would message the owner's real business phone — from a draft, about a product that may not
     * exist, with no way for the owner to know it was a test.
     */
    const errors = errorsOf('preview', {
      ...preview,
      NEXT_PUBLIC_WHATSAPP_NUMBER: '+919999999999',
      PRODUCTION_WHATSAPP_NUMBER: '+919999999999',
    })
    expect(errors.map((finding) => finding.name)).toEqual(['NEXT_PUBLIC_WHATSAPP_NUMBER'])
    expect(errors[0]?.problem).toContain('PREVIEW')
  })

  it('allows a preview carrying a different number', () => {
    expect(
      errorsOf('preview', {
        ...preview,
        NEXT_PUBLIC_WHATSAPP_NUMBER: '+14155550123',
        PRODUCTION_WHATSAPP_NUMBER: '+919999999999',
      }),
    ).toEqual([])
  })

  it('reports the single-project posture as a warning on every preview', () => {
    /*
     * AMENDMENT A42. The phase document asks this script to FAIL a preview whose Supabase project
     * equals production's; this project has one, so that gate would fail every preview build and be
     * deleted within a week. It warns instead — so nobody reads a green preview as evidence of an
     * isolation that does not exist. This test is what stops the warning being quietly dropped.
     */
    const warnings = checkEnvironment('preview', preview).filter(
      (finding) => finding.level === 'WARNING',
    )
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.name).toBe('NEXT_PUBLIC_SUPABASE_URL')
    expect(warnings[0]?.why).toContain('A42')
    // And it is a preview-only note: production is the project it points at.
    expect(checkEnvironment('production', COMPLETE)).toEqual([])
  })
})

describe('no finding ever carries a value', () => {
  it('names the variable and the rule, never the input', () => {
    /*
     * LOAD-BEARING. Every other assertion in this file survives a refactor that starts printing
     * "NEXT_PUBLIC_SUPABASE_URL (https://real-project.supabase.co) is not https" — this one does
     * not. The sentinels are distinctive enough that a substring match is conclusive.
     */
    const sentinels = {
      NEXT_PUBLIC_SITE_URL: 'https://sentinel-site-value.example/',
      NEXT_PUBLIC_SUPABASE_URL: 'http://sentinel-supabase-value.example',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sentinel-anon-value',
      SUPABASE_SERVICE_ROLE_KEY: 'sentinel-service-value',
      NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: 'sentinel-cloud-value',
      CLOUDINARY_API_KEY: 'sentinel-api-key-value',
      CLOUDINARY_API_SECRET: 'sentinel-api-secret-value',
      NEXT_PUBLIC_WHATSAPP_NUMBER: 'sentinel-number-value',
      CRON_SECRET: 'sentinel-cron-value',
      IP_HASH_SALT: 'sentinel-ip-salt-value',
      RATE_LIMIT_SALT: 'sentinel-rate-salt-value',
      PRODUCTION_WHATSAPP_NUMBER: 'sentinel-number-value',
    }

    for (const scope of ['production', 'preview', 'development'] as const) {
      const printed = JSON.stringify(checkEnvironment(scope, sentinels))
      expect(printed, `${scope} printed a value`).not.toContain('sentinel')
      // A four-character fragment catches a prefix or a truncation as well as a whole value.
      for (const value of Object.values(sentinels)) {
        expect(printed.includes(value.slice(0, 8)), `${scope} printed part of a value`).toBe(false)
      }
    }
  })
})

describe('the rule table', () => {
  it('names each variable once', () => {
    const names = RULES.map((rule) => rule.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('gives every rule a reason a reader can act on', () => {
    for (const rule of RULES) {
      expect(rule.why.length, `${rule.name} has no reason`).toBeGreaterThan(20)
      // The reason is printed beside the failure, so it must say what breaks, not restate the name.
      expect(rule.why).not.toContain(rule.name)
    }
  })

  it('requires nothing in development that development cannot have', () => {
    /*
     * A DEVELOPER CLONING THIS REPOSITORY GETS THE PUBLIC HALF AND NOTHING ELSE. If a secret ever
     * lands in `requiredIn: ['development']`, `npm run build` stops working for a new contributor
     * and the fix is usually to paste a production secret into a local file.
     */
    for (const rule of RULES.filter((r) => r.requiredIn.includes('development'))) {
      expect(rule.name.startsWith('NEXT_PUBLIC_'), `${rule.name} is a secret`).toBe(true)
    }
  })
})
