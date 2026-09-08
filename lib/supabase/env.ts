/**
 * The Supabase half of the D8 environment variables.
 *
 * The names here are fixed by CANONICAL-DECISIONS.md D8. Adding one requires a D8 amendment, not
 * an edit to this file. `requiredEnv` carries the rule that no error message may contain a value,
 * a prefix or a length; it moved to `lib/env.ts` in Phase 06 when Cloudinary needed it too.
 */

import { requiredEnv as required } from '../env'

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
