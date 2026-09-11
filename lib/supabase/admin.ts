import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import type { Database } from './database.types'
import { publicEnv } from './env'
import { serverEnv } from './env'

/**
 * The service-role client. IT BYPASSES ROW LEVEL SECURITY ENTIRELY.
 *
 * `import 'server-only'` is the first line on purpose: it makes importing this module from a
 * Client Component a BUILD failure rather than a runtime leak of a key that can read and write
 * every row in the database. eslint's no-restricted-imports rule adds a second, earlier layer —
 * it names the small allowlist of files permitted to import this at all.
 *
 * RULE FOR EVERY CALLER: RLS is not the check here, so the check has to be yours. A server action
 * that reaches for this client runs `requirePermission()` FIRST (Phase 04) and only then touches
 * the database. Using this client to "make the query work" after RLS refused it is precisely the
 * bug the two-layer design exists to prevent.
 *
 * Legitimate uses are narrow: migrations and the seed runner, which have no user; and privileged
 * server actions that have already checked their own permission.
 */
/**
 * Phase 38: an injectable `fetch`, so the environment checks can be run against a stubbed
 * network in a unit test. Nothing else passes it; the default is the platform's own.
 */
export interface AdminClientOptions {
  readonly fetch?: typeof fetch
}

export function createAdminClient(options: AdminClientOptions = {}) {
  return createSupabaseClient<Database>(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    ...(options.fetch === undefined ? {} : { global: { fetch: options.fetch } }),
    auth: {
      // There is no user session on a service-role client, and persisting or refreshing one would
      // write the service-role key into storage.
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
