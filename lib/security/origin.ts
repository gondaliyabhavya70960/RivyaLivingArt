/**
 * Same-origin checking for the two unauthenticated POST endpoints — Phase 40.
 *
 * EXTRACTED RATHER THAN COPIED. Phase 20's `app/api/inquiries/upload-sign` wrote this predicate
 * first; Phase 40's `app/api/vitals` needs exactly the same one. A security check that exists twice
 * is a security check that will be improved once, so it lives here and both import it.
 *
 * WHAT IT DEFENDS AND WHAT IT DOES NOT. It defends against a BROWSER being used as a confused
 * deputy: a page on another origin making our endpoint do work with a visitor's network identity.
 * A browser always sends `Origin` on a cross-origin POST, so a mismatched one is refused.
 *
 * A REQUEST WITH NEITHER `Origin` NOR `Referer` IS ALLOWED, and that is not a hole left open by
 * accident. `curl` sends neither, and both phase documents' verification steps are curls. Origin
 * checking cannot defend against a script in the first place — a script sends whatever headers it
 * likes — so refusing the headerless case would break the operator's own tooling while stopping
 * nobody. The rate limit is what defends against a script, and it does not care what headers the
 * script sends.
 */

/** True when the request is same-origin, or when the question cannot be asked. */
export function isSameOrigin(request: Request, siteUrl = process.env['NEXT_PUBLIC_SITE_URL']) {
  const claimed = request.headers.get('origin') ?? request.headers.get('referer')
  if (claimed === null || claimed === '') return true
  if (siteUrl === undefined || siteUrl === '') return true

  try {
    return new URL(claimed).origin === new URL(siteUrl).origin
  } catch {
    // An unparseable Origin is a browser sending something malformed, or somebody probing. Neither
    // is a same-origin request.
    return false
  }
}
