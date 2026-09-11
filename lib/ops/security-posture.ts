import 'server-only'

import { CSP_EXCEPTIONS, STATIC_SECURITY_HEADERS, cspHeaderName } from '@/lib/security/headers'
import {
  INQUIRY_SUBMIT_WINDOWS,
  INQUIRY_UPLOAD_WINDOWS,
  MEDIA_SIGN_WINDOWS,
  REVALIDATE_WINDOWS,
  SIGN_IN_WINDOWS,
  SUGGEST_WINDOWS,
  VITALS_WINDOWS,
  type RateWindow,
} from '@/lib/security/rate-limit'

/**
 * WHAT THE RUNNING DEPLOYMENT'S SECURITY POSTURE IS — Phase 41, the Security section of
 * `/studio/system/environment`.
 *
 * STATE, NEVER VALUES. The same rule that governs the eight Phase 38 checks governs this: a
 * variable appears as a boolean derived from whether a name is set, and nothing else. No value, no
 * prefix, no length, no hash. Two of the three variables here ARE secrets — the salts — and a page
 * that showed four characters of one would be handing an attacker the thing that makes the IP
 * hashes guessable.
 *
 * IT IS NOT A TEST, AND SAYS SO ON THE PAGE. It reads the configuration this process was started
 * with. It cannot tell you a browser honoured the policy, that the salt is the same one yesterday's
 * hashes were made with, or that a proxy in front of this app is not stripping a header. What it
 * answers is the question somebody actually asks after a deploy: "is CSP enforced here yet, and did
 * the salts get set in this environment".
 *
 * WHY IT LIVES IN `lib/ops/` RATHER THAN THE PAGE. `scripts/security/check-secret-exposure.mjs`
 * refuses `process.env` reads in client files; keeping the reads in one server-only module behind a
 * fixed shape is what lets the Studio render the answer without a route learning how to ask.
 */

export type PostureState = 'ENFORCED' | 'REPORT_ONLY' | 'CONFIGURED' | 'NOT_CONFIGURED'

export interface PostureRow {
  /** Stable key; the Studio maps it to seeded copy rather than rendering a sentence from here. */
  readonly key: string
  readonly state: PostureState
  /** A number the row is about, when it has one — a count of rules, never a value. */
  readonly count?: number
}

export interface SecurityPosture {
  readonly cspHeader: string
  readonly rows: readonly PostureRow[]
  readonly headerNames: readonly string[]
  readonly exceptions: readonly string[]
  readonly rateLimitedSurfaces: number
  /** The shortest window in force anywhere, in seconds — the tightest promise the product makes. */
  readonly tightestWindowSeconds: number
}

/**
 * `configured` IS PRESENCE COLLAPSED TO A BOOLEAN, and the collapse happens in this line rather
 * than anywhere a value could escape it. An empty string counts as absent: a variable set to ""
 * in a dashboard is a variable somebody meant to set and did not.
 */
function configured(name: string): PostureState {
  const value = process.env[name]
  return value !== undefined && value !== '' ? 'CONFIGURED' : 'NOT_CONFIGURED'
}

const SURFACES: readonly (readonly RateWindow[])[] = [
  INQUIRY_SUBMIT_WINDOWS,
  INQUIRY_UPLOAD_WINDOWS,
  MEDIA_SIGN_WINDOWS,
  SUGGEST_WINDOWS,
  VITALS_WINDOWS,
  REVALIDATE_WINDOWS,
  SIGN_IN_WINDOWS,
]

export function readSecurityPosture(): SecurityPosture {
  const enforced = process.env['CSP_ENFORCE'] === '1'

  return {
    cspHeader: cspHeaderName(enforced),
    rows: [
      { key: 'csp', state: enforced ? 'ENFORCED' : 'REPORT_ONLY', count: CSP_EXCEPTIONS.length },
      /*
       * BOTH SALTS, SEPARATELY. They are different variables protecting different things — one
       * keys the IP hashes on inquiries, the other the rate-limit bucket keys — and an environment
       * with one set and not the other is a real and easily-made mistake that a single combined
       * row would hide.
       */
      { key: 'ipHashSalt', state: configured('IP_HASH_SALT') },
      { key: 'rateLimitSalt', state: configured('RATE_LIMIT_SALT') },
      { key: 'cronSecret', state: configured('CRON_SECRET') },
    ],
    headerNames: STATIC_SECURITY_HEADERS.map(([name]) => name),
    exceptions: CSP_EXCEPTIONS.map((exception) => exception.directive),
    rateLimitedSurfaces: SURFACES.length,
    tightestWindowSeconds: Math.min(
      ...SURFACES.flatMap((windows) => windows.map((window) => window.seconds)),
    ),
  }
}
