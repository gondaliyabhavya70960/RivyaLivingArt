/**
 * THE RESPONSE HEADER SET — Phase 41, FEAT §47.
 *
 * One place, as data, so that `proxy.ts` sets it, `tests/e2e/security-headers.spec.ts` asserts it
 * and `docs/ops/SECURITY.md` describes it without the three ever drifting apart.
 *
 * WHY IT IS IN `proxy.ts` AND NOT `next.config.ts`. The CSP carries a per-request nonce, and a
 * static header table cannot produce one. Everything else could live in the config, but splitting
 * the set across two files would mean two places to look when a header is missing, and the one
 * genuinely static header this phase adds — `X-Robots-Tag` — already lives in the config from
 * Phase 39 for a reason that still holds (A2·b keeps the proxy to its two jobs, and these headers
 * are a third job only in the sense that they are unconditional).
 *
 * A NOTE ON WHAT A CSP IS FOR HERE. This site loads no third-party script at all — Phase 40 made
 * that a gate rather than a habit — so the CSP is not defending a known integration. It defends
 * against injection: a stored XSS in a CMS field, a dependency that starts phoning home, a
 * reflected parameter that reaches the DOM. `strict-dynamic` with a nonce is the strongest
 * generally-deployable form, and it is only achievable BECAUSE there is no third party to
 * allowlist.
 */

/**
 * The two exceptions, both real, both documented in SECURITY.md §5 rather than buried.
 *
 * `style-src 'unsafe-inline'` — Next injects inline `<style>` elements for its own CSS handling and
 * Tailwind's runtime inserts one more. A nonce cannot be attached to a style element the framework
 * creates, and hashing them is not stable across builds. The residual risk is CSS injection, which
 * is real (it can exfiltrate through a background-image URL) and much narrower than script
 * injection.
 *
 * `worker-src blob:` — the Draco and meshopt decoders the Phase 21 viewer loads instantiate their
 * WASM workers from blob URLs. Without it the 3D viewer does not run at all.
 */
export const CSP_EXCEPTIONS = [
  {
    directive: "style-src 'unsafe-inline'",
    why: "Next's inline style injection and Tailwind's runtime style element; a framework-created <style> cannot carry our nonce and its hash is not build-stable.",
  },
  {
    directive: 'worker-src blob:',
    why: 'The Draco and meshopt decoders instantiate their WASM workers from blob URLs; the Phase 21 viewer does not run without it.',
  },
] as const

/** Cloudinary delivery and API, and Supabase REST plus realtime. Nothing else, ever. */
const CLOUDINARY_DELIVERY = 'https://res.cloudinary.com'
const CLOUDINARY_API = 'https://api.cloudinary.com'
const SUPABASE = 'https://*.supabase.co'
const SUPABASE_WS = 'wss://*.supabase.co'

/**
 * The policy, with the request's nonce spliced in.
 *
 * `'strict-dynamic'` IS THE LOAD-BEARING TOKEN. With it, a script the browser trusts (because it
 * carried our nonce) may load further scripts; without it, every dynamically-inserted chunk would
 * need its own nonce, which Next's client runtime cannot arrange. It also makes host allowlists
 * inert in modern browsers, which is the point: there is no host to allowlist and no way to add one
 * by accident.
 */
export function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${CLOUDINARY_DELIVERY}`,
    `media-src 'self' blob: ${CLOUDINARY_DELIVERY}`,
    "font-src 'self'",
    `connect-src 'self' ${SUPABASE} ${SUPABASE_WS} ${CLOUDINARY_API}`,
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}

/**
 * Everything that does not depend on the request.
 *
 * `Permissions-Policy` NAMES `payment=()` DELIBERATELY AND PERMANENTLY. D1 fixes that there is no
 * checkout and no payment surface; denying the capability outright means a future dependency cannot
 * quietly open a payment sheet, and it states the product decision in a place a browser enforces.
 *
 * `X-Frame-Options: DENY` is belt and braces beside `frame-ancestors 'none'` — the modern directive
 * supersedes it, and the old header is still what an older proxy or scanner reads.
 */
export const STATIC_SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  // Two years, subdomains included, preload-eligible. Only meaningful over HTTPS, which is every
  // deployed environment; on plain HTTP in development a browser ignores it.
  ['Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload'],
  ['X-Content-Type-Options', 'nosniff'],
  // The origin, never the path, to a different site. A path can carry a slug, a search term or a
  // reference number, and none of those is any third party's business.
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  [
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  ],
  ['Cross-Origin-Opener-Policy', 'same-origin'],
  ['X-Frame-Options', 'DENY'],
]

/**
 * Report-only or enforced.
 *
 * IT SHIPS REPORT-ONLY AND THE FLIP IS A DELIBERATE ACT. A CSP that breaks the 3D viewer or a
 * Cloudinary video breaks it in production only, on a device somebody is using, and the first
 * report of it is usually a person saying "the page is blank". So the policy is collected before it
 * is enforced: `CSP_ENFORCE=1` switches the header name, and `docs/ops/SECURITY.md` §5.3 carries the
 * soak procedure and the date it was flipped.
 *
 * The default is report-only, which is the safe direction: forgetting to set the variable costs
 * enforcement, not availability.
 */
export function cspHeaderName(enforce: boolean): string {
  return enforce ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only'
}

/** Where violations are posted. Same-origin, so it needs no `report-to` group registration. */
export const CSP_REPORT_PATH = '/api/csp-report'

export function cspWithReporting(nonce: string): string {
  return `${contentSecurityPolicy(nonce)}; report-uri ${CSP_REPORT_PATH}`
}
