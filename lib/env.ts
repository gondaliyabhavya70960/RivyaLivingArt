/**
 * Reading a D8 environment variable, with one rule: a missing variable fails loudly at the point
 * of use, and no error message ever contains a value, a prefix or a length (CLAUDE.md).
 *
 * This lived inside `lib/supabase/env.ts` until Phase 06 needed the same three lines for the
 * Cloudinary credentials. It is shared rather than copied because the rule it enforces is the
 * thing worth having in one place: a second copy is a second chance for somebody to add
 * `value.slice(0, 4)` to a message "just for debugging", and only one of the two copies would be
 * caught in review.
 *
 * The variable NAMES are fixed by CANONICAL-DECISIONS.md D8. Adding one requires a D8 amendment,
 * not an edit to a caller.
 */
/**
 * A D8 variable that a surface can do without.
 *
 * NOT A SOFTENING OF `requiredEnv`, AND NOT FOR SECRETS. It exists for the one shape where
 * throwing is the wrong answer: a value that is FORWARDED by a component which does not use it,
 * to one that may not use it either. `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` is the case that produced
 * it — `app/(site)/layout.tsx` reads it only to hand to the header, the header hands it to the
 * category cards, and no category has a bound hero, so nothing built a URL with it. Reading it
 * with `requiredEnv` still made every public page unbuildable without it, which is how a site with
 * no images at all fails to deploy for want of an image setting.
 *
 * The rule about never revealing a value, a prefix or a length is unchanged: this returns the
 * value or null and says nothing about it either way. A caller that genuinely cannot proceed
 * without one still uses `requiredEnv` and still fails loudly — see `lib/whatsapp/link.ts`, which
 * cannot build a `wa.me` URL without a number and does not pretend otherwise.
 */
export function optionalEnv(name: string): string | null {
  const value = process.env[name]
  return value === undefined || value === '' ? null : value
}

export function requiredEnv(name: string): string {
  const value = process.env[name]
  if (value === undefined || value === '') {
    // The name only. Never `value.slice(0, 4)`, never `value.length` — both leak key material
    // into logs that are far less protected than the environment itself.
    throw new Error(
      `Missing required environment variable ${name}. See .env.example and docs/ops/ENVIRONMENT.md.`,
    )
  }
  return value
}
