import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { logSearchQuery } from '@/lib/supabase/repositories/search'

import { normalizeQuery } from './query'

/**
 * Record that a search happened. The ONE module that holds the service role for search.
 *
 * WHY THE SEAM EXISTS AT ALL. `search_queries` has no write policy for any session role (0212): a
 * public search has no session, and an anon insert policy would be a public endpoint a stranger
 * could fill with arbitrary text attributed to searches nobody ran. So the write needs the service
 * role — and the service role must not be reachable from a page that renders.
 *
 * THIS IS THE `lib/flags/index.ts` PATTERN, DELIBERATELY. That module holds the service role for
 * exactly one SELECT and exports a boolean; this one holds it for exactly one INSERT and exports
 * nothing. Neither returns the client. The alternative — importing `createAdminClient` into
 * `app/(site)/search/page.tsx` — would put an RLS-bypassing client in scope on a public page, one
 * careless `.from()` away from reading anything in the database, which is the failure the eslint
 * allowlist's own comment describes.
 *
 * IT CANNOT THROW. A failure to log must not fail the search: the visitor came to find a table, not
 * to feed a row. The repository already swallows the database error; this catches everything else,
 * including a missing service-role key in an environment where nobody has configured one.
 */
export async function recordPublicSearch(query: string, resultCount: number): Promise<void> {
  try {
    await logSearchQuery(createAdminClient(), {
      queryText: query,
      normalizedQuery: normalizeQuery(query),
      scope: 'PUBLIC',
      resultCount,
    })
  } catch {
    // Deliberately silent. See the header.
  }
}

/** The same for a Studio search, which DOES have an actor and records it. */
export async function recordStudioSearch(
  query: string,
  resultCount: number,
  staffUserId: string | null,
): Promise<void> {
  try {
    await logSearchQuery(createAdminClient(), {
      queryText: query,
      normalizedQuery: normalizeQuery(query),
      scope: 'STUDIO',
      resultCount,
      staffUserId,
    })
  } catch {
    // Deliberately silent, for the same reason.
  }
}
