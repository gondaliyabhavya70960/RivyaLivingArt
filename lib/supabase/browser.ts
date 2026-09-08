'use client'

import { createBrowserClient } from '@supabase/ssr'

import type { Database } from './database.types'
import { publicEnv } from './env'

/**
 * The browser client. Anon key only — there is no code path that puts a service-role key in a
 * client bundle, and `lib/supabase/admin.ts` is import-banned from client code to keep it that way.
 *
 * Everything this client can read is decided by RLS. In Phase 03 that is nothing at all: every
 * table has RLS enabled with no policy, so this client sees an empty result set on every table
 * until Phase 04 grants access deliberately. That is the intended state, not a bug to work around.
 */
export function createClient() {
  return createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey)
}
