import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

import type { Database } from './database.types'
import { publicEnv } from './env'

/**
 * The cookie-bound server client, for Server Components, Server Actions and Route Handlers.
 *
 * Anon key, so every read and write is still subject to RLS — this client is "the current user",
 * not "the server". Privileged work uses lib/supabase/admin.ts and a server-side permission check.
 *
 * `cookies()` is async in this version of Next.js, so this function is async too.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // A Server Component cannot set a cookie — only a Server Action or Route Handler can.
          // Swallowing this is the documented @supabase/ssr pattern and is safe *provided* session
          // refresh also happens in middleware, which is where the refreshed cookie actually gets
          // written. Phase 04 adds that middleware; until then no session exists to refresh.
        }
      },
    },
  })
}
