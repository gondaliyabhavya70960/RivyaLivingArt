import { z } from 'zod'

/**
 * Where a visitor is sent after signing in — and why that is a security decision.
 *
 * Extracted from the login page so it can be attacked in a test. It was written inline, which made
 * it unreachable from a spec: an open-redirect guard nobody has attacked is a guard nobody has
 * checked, and this one is subtle enough that reading it is not the same as knowing it holds.
 */

/** Where an unusable `next` lands. Not an error: failing a sign-in over a malformed link helps nobody. */
export const STUDIO_HOME = '/studio'

/**
 * `next` is attacker-controlled: it arrives in a link anybody can compose and send. An unvalidated
 * value here turns the Studio's own login page into an open redirect — the phishing shape where the
 * URL a target inspects really is the real Studio, and the destination after sign-in is not.
 *
 * The allowed set is therefore an allowlist of one shape: a path, inside `/studio/`, and not the
 * login page itself. Rejecting `//host` and `/\host` falls out of requiring the `/studio/` prefix;
 * whitespace, control characters and backslashes are rejected outright rather than reasoned about,
 * because they are how a path is smuggled past a prefix check in a URL parser that disagrees with
 * this one about normalisation.
 *
 * This is a shape test, not a containment test — it is applied twice, to the raw value and to the
 * normalised one. `resolveNextPath()` says why neither pass is sufficient on its own.
 */
export function isStudioPath(path: string): boolean {
  if (!path.startsWith('/studio/')) return false
  if (/[\s\\]|[\u0000-\u001f\u007f]/.test(path)) return false
  return !/^\/studio\/login(?:$|[/?#])/.test(path)
}

export const nextPathSchema = z.string().max(512).refine(isStudioPath)

/** Only the path, query and fragment of `next` are ever used, so the origin resolved against is
 *  arbitrary. `.invalid` is reserved by RFC 2606 and can never be a real host. */
const NORMALISATION_BASE = 'https://studio.invalid'

/**
 * Normalise `next` the way the browser eventually will, so that `resolveNextPath()` judges THAT.
 *
 * `redirect()` puts the string into a Location header verbatim, so the browser is what resolves it,
 * and it removes dot segments before requesting anything — including the percent-encoded spellings
 * (`%2e%2e`, `.%2e`), which WHATWG treats as `..`. A prefix test on the raw string is therefore not
 * a containment test: `/studio/../../anything` passes it and arrives at `/anything`, and
 * `/studio/x/../login` passes it and arrives back here, which is the redirect loop the login
 * exclusion exists to prevent. Neither leaves the origin — an absolute-path reference cannot, and
 * that is what closes the open redirect — but neither is what the allowlist above claims to allow.
 *
 * Resolving against a constant base makes the parser do that normalisation here, where the result
 * can still be refused. Order matters: the raw value is checked first because the same parser
 * strips the whitespace and control characters that would otherwise launder a hostile prefix past
 * the check, and the normalised value second because only it is what will actually be requested.
 *
 * An unusable value is not an error — it is the Studio home, because failing the sign-in over a
 * malformed link helps nobody.
 */
export function normaliseStudioPath(path: string): string | null {
  try {
    const url = new URL(path, NORMALISATION_BASE)
    // Unreachable while the prefix check above holds, because an absolute-path reference keeps the
    // base's origin. Kept because it is the one assertion the whole allowlist rests on.
    if (url.origin !== NORMALISATION_BASE) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

/** Resolve a `next` from any untrusted source: the shape test on the raw value, the same test again
 *  on the normalised one, and the Studio home for everything that fails either. */
export function resolveNextPath(raw: unknown): string {
  const parsed = nextPathSchema.safeParse(raw)
  if (!parsed.success) return STUDIO_HOME

  const normalised = normaliseStudioPath(parsed.data)
  return normalised !== null && isStudioPath(normalised) ? normalised : STUDIO_HOME
}
