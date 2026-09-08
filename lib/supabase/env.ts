/**
 * Reading the D8 environment variables, with one rule: a missing variable fails loudly at the
 * point of use, and no error message ever contains a value, a prefix or a length (CLAUDE.md).
 *
 * The names here are fixed by CANONICAL-DECISIONS.md D8. Adding one requires a D8 amendment, not
 * an edit to this file.
 */

function required(name: string): string {
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

/** Public, browser-visible. Safe to embed in a client bundle. */
export const publicEnv = {
  get supabaseUrl(): string {
    return required('NEXT_PUBLIC_SUPABASE_URL')
  },
  get supabaseAnonKey(): string {
    return required('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  },
}

/** Server-only. Reading this from a Client Component is a build error via lib/supabase/admin.ts's
 *  `server-only` import, not merely a convention. */
export const serverEnv = {
  get supabaseServiceRoleKey(): string {
    return required('SUPABASE_SERVICE_ROLE_KEY')
  },
}
