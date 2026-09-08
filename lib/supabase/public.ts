import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import type { Database } from './database.types'
import { publicEnv } from './env'

/**
 * The anonymous read client for the public website.
 *
 * WHY THIS EXISTS ALONGSIDE `server.ts`. That client is cookie-bound: it calls `cookies()`, which
 * is what makes it "the current visitor" and what lets Studio read rows only staff can see. On a
 * public route that same call is a liability rather than a feature, for two independent reasons.
 *
 *   1. IT MAKES THE ROUTE DYNAMIC. Reading a cookie opts a Server Component out of static
 *      rendering, so every visitor to `/about` would pay for a fresh render and a fresh round trip
 *      to PostgREST. The public site's content changes when an editor publishes, not when a
 *      visitor arrives, so the correct model is a cached render invalidated by
 *      `app/api/revalidate` — and that model is unavailable to a route that reads cookies.
 *   2. `server.ts` CANNOT REFRESH A SESSION OUTSIDE THE STUDIO MATCHER. Its `setAll` swallows the
 *      write, which its own comment says is safe only because `proxy.ts` performs the refresh —
 *      and `proxy.ts` matches `/studio` and nothing else. A public Server Component using it would
 *      silently hold an expired token for any visitor who happens to be signed in.
 *
 * IT IS STILL SUBJECT TO RLS. The anon key is not a bypass: `pages_select_public` and its five
 * siblings admit `status = 'PUBLISHED'` inside the schedule window and nothing else. That is the
 * point — the public site's visibility rules are enforced by the database, not by remembering to
 * add `.eq('status', 'PUBLISHED')` at each call site. `lib/supabase/admin.ts`, which does bypass
 * RLS, is import-banned from everything but its short allowlist.
 *
 * DRAFT MODE DOES NOT USE THIS CLIENT. `renderCmsPage` switches to the cookie-bound client when
 * `draftMode()` is enabled, because previewing an unpublished page is exactly the case where the
 * staff session has to travel with the query. That switch is also what keeps a previewed route
 * dynamic and out of the cache, which is the behaviour a preview needs.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: {
      // No session to persist and none to refresh: this client is nobody. Leaving these on makes
      // supabase-js reach for storage that does not exist on the server.
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
