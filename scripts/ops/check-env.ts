#!/usr/bin/env tsx
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/**
 * `npx tsx scripts/ops/check-env.ts` — Phase 44, and gate 11 of `scripts/ops/preflight.ts`.
 *
 * WHAT IT CHECKS: that every variable this deployment needs is PRESENT and SHAPED like the thing it
 * claims to be. A Supabase URL that is not a URL, a service-role key that is not a JWT, a site URL
 * with a trailing slash, a preview carrying the owner's real WhatsApp number.
 *
 * WHAT IT NEVER PRINTS: a value, a prefix, a suffix, a length, or a hash of one (D8, SECURITY §5).
 * Every message names the VARIABLE and the RULE it broke. That constraint is what makes this safe to
 * run in a build log, which is the only place it is ever useful — and a build log is a place URLs
 * get pasted into issues.
 *
 * SHAPE, NOT VALIDITY. It cannot tell a live key from a revoked one; `/studio/system/environment`
 * answers reachability at runtime and says so on its face. What this catches is the class of
 * mistake that happens at 11pm: a variable pasted into the wrong environment, a name misspelled, a
 * value truncated by a dashboard field, a placeholder left in.
 *
 * IT IS ENVIRONMENT-AWARE, because the rules differ. Production must carry every secret; preview
 * must NOT carry the owner's phone number; development is allowed to be missing almost everything
 * because a developer running `next dev` without Google Sheets configured is not a fault.
 */

const ENV_PATH = '.env.local'

export type Scope = 'production' | 'preview' | 'development'

export interface Rule {
  readonly name: string
  /** In which environments the variable must be present. */
  readonly requiredIn: readonly Scope[]
  /** What the value must look like. Returns a reason when it does not, naming no part of it. */
  readonly shape?: (value: string) => string | null
  /** Why it exists, printed beside a failure so the reader knows what breaks. */
  readonly why: string
}

const isHttpsUrl = (value: string): string | null => {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return 'is not a URL'
  }
  if (parsed.protocol !== 'https:') return 'is not https'
  return null
}

/**
 * A JWT has three dot-separated base64url segments.
 *
 * CHECKED BY STRUCTURE, NEVER DECODED. Decoding would put the payload — which names the project and
 * the role — into this process's memory and one careless `console.log` from a log line. Counting
 * dots catches every truncation and every placeholder, which is the whole job.
 */
const isJwt = (value: string): string | null =>
  value.split('.').length === 3 ? null : 'is not a three-segment JWT'

const noTrailingSlash = (value: string): string | null =>
  value.endsWith('/') ? 'has a trailing slash, which doubles every built URL' : null

const isE164 = (value: string): string | null =>
  /^\+[1-9]\d{7,14}$/.test(value) ? null : 'is not an E.164 number (a + and 8–15 digits)'

export const RULES: readonly Rule[] = [
  {
    name: 'NEXT_PUBLIC_SITE_URL',
    requiredIn: ['production'],
    shape: (value) => isHttpsUrl(value) ?? noTrailingSlash(value),
    why: 'canonical URLs, the sitemap and every absolute link are built from it',
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    requiredIn: ['production', 'preview', 'development'],
    shape: isHttpsUrl,
    why: 'every read and write goes through it',
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    requiredIn: ['production', 'preview', 'development'],
    shape: isJwt,
    why: 'the public client cannot be constructed without it',
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    requiredIn: ['production', 'preview'],
    shape: isJwt,
    why: 'the rate limiter, the audit log and every cron route write with it',
  },
  {
    name: 'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME',
    requiredIn: ['production', 'preview', 'development'],
    why: 'every image URL on the site starts with it',
  },
  {
    name: 'CLOUDINARY_API_KEY',
    requiredIn: ['production', 'preview'],
    why: 'uploads are signed with it',
  },
  {
    name: 'CLOUDINARY_API_SECRET',
    requiredIn: ['production', 'preview'],
    why: 'uploads are signed with it, and the browser must never see it',
  },
  {
    name: 'NEXT_PUBLIC_WHATSAPP_NUMBER',
    // NOT required in preview, and that is the point of the row below.
    requiredIn: ['production'],
    shape: isE164,
    why: 'the handoff every enquiry ends in',
  },
  {
    name: 'CRON_SECRET',
    requiredIn: ['production'],
    why: 'every scheduled job authenticates with it; without it each tick refuses itself',
  },
  {
    name: 'IP_HASH_SALT',
    requiredIn: ['production'],
    why: 'without it `salt()` falls back to a public literal and every stored ip_hash is guessable',
  },
  {
    name: 'RATE_LIMIT_SALT',
    requiredIn: ['production'],
    why: 'without it a rate-limit bucket key is predictable',
  },
  {
    name: 'SCRAPER_USER_AGENT',
    requiredIn: [],
    why: 'identifies Rivya to the sites the research fetcher reads; it has no fallback and throws',
  },
]

export interface Finding {
  readonly name: string
  readonly problem: string
  readonly why: string
  readonly level: 'ERROR' | 'WARNING'
}

/**
 * Every problem with this environment.
 *
 * TAKES A BAG OF VARIABLES RATHER THAN READING `process.env`, so the rules can be exercised against
 * a constructed environment without setting anything — which is what makes the preview-versus-
 * production assertions testable at all.
 */
export function checkEnvironment(
  scope: Scope,
  env: Readonly<Record<string, string | undefined>>,
): Finding[] {
  const findings: Finding[] = []

  for (const rule of RULES) {
    const value = env[rule.name]
    const present = value !== undefined && value !== ''

    if (!present) {
      if (rule.requiredIn.includes(scope)) {
        findings.push({ name: rule.name, problem: 'is not set', why: rule.why, level: 'ERROR' })
      }
      continue
    }

    const problem = rule.shape?.(value) ?? null
    if (problem !== null) {
      findings.push({ name: rule.name, problem, why: rule.why, level: 'ERROR' })
    }
  }

  /*
   * THE ONE CROSS-VARIABLE RULE, and the reason it exists is a person's phone.
   *
   * `NEXT_PUBLIC_WHATSAPP_NUMBER` in production is the owner's real business number. A reviewer
   * clicking through a preview deployment and reaching the handoff would message it — from a draft,
   * about a product that may not exist, with no way for the owner to know it was a test. So preview
   * must carry a DIFFERENT number, and this is the check that says so.
   *
   * IT COMPARES, IT DOES NOT PRINT. The message names the two variables and the fact that they
   * match; neither number appears.
   */
  if (scope === 'preview') {
    const preview = env['NEXT_PUBLIC_WHATSAPP_NUMBER']
    const production = env['PRODUCTION_WHATSAPP_NUMBER']
    if (
      preview !== undefined &&
      preview !== '' &&
      production !== undefined &&
      production !== '' &&
      preview === production
    ) {
      findings.push({
        name: 'NEXT_PUBLIC_WHATSAPP_NUMBER',
        problem: 'is the same number production uses, on a PREVIEW deployment',
        why: "a reviewer reaching the handoff would message the owner's real phone from a draft",
        level: 'ERROR',
      })
    }
  }

  /*
   * THE SINGLE-PROJECT POSTURE, REPORTED AS A WARNING RATHER THAN ENFORCED AS A RULE.
   *
   * The phase document asks this script to fail a preview whose Supabase project ref equals
   * production's. This project has ONE Supabase project by the owner's decision (amendment A42), so
   * that comparison would fail every preview build — and a gate that always fails is a gate that
   * gets deleted. It reports the posture instead, once, so nobody reads a green preview as evidence
   * of isolation that does not exist.
   */
  if (scope === 'preview') {
    findings.push({
      name: 'NEXT_PUBLIC_SUPABASE_URL',
      problem: 'points at the same Supabase project as production',
      why: "one project, by the owner's decision (amendment A42). A preview writes to real data — see DEPLOYMENT.md §2",
      level: 'WARNING',
    })
  }

  return findings
}

/** `VERCEL_ENV` when the platform sets it, otherwise development. */
export function scopeOf(env: Readonly<Record<string, string | undefined>>): Scope {
  const value = env['VERCEL_ENV']
  if (value === 'production' || value === 'preview') return value
  return 'development'
}

function main(): void {
  if (existsSync(ENV_PATH)) process.loadEnvFile(ENV_PATH)

  const scope = scopeOf(process.env)
  const findings = checkEnvironment(scope, process.env)
  const errors = findings.filter((finding) => finding.level === 'ERROR')
  const warnings = findings.filter((finding) => finding.level === 'WARNING')

  for (const finding of warnings) {
    console.warn(`  ! ${finding.name} ${finding.problem}\n      ${finding.why}`)
  }

  if (errors.length > 0) {
    console.error(`\n✗ environment (${scope}): ${String(errors.length)} problem(s):\n`)
    for (const finding of errors) {
      console.error(`    ${finding.name} ${finding.problem}`)
      console.error(`      ${finding.why}`)
    }
    console.error(
      '\n  No value, prefix or length is printed above, and none ever will be (D8). Set each\n' +
        '  variable in the Vercel dashboard for this environment; see docs/ops/ENVIRONMENT.md §5.2.',
    )
    process.exit(1)
  }

  console.log(
    `✓ environment (${scope}): ${String(RULES.length)} variable(s) checked, ` +
      `${String(RULES.filter((r) => r.requiredIn.includes(scope)).length)} required here, all present and well-formed` +
      (warnings.length > 0 ? `; ${String(warnings.length)} posture note(s) above` : ''),
  )
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
