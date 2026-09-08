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
