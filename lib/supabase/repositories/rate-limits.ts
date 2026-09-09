import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import { toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'rate limit'

/**
 * `rate_limit_buckets` — the only module that touches it, and it touches it through one function.
 *
 * THERE IS NO SELECT AND NO INSERT HERE, deliberately. The table has exactly one write path,
 * `consume_rate_limit()`, and exactly one reason: the bucket key is derived from the caller's
 * address, so a session able to pass its own key could exhaust somebody else's window on their
 * behalf. A repository function that inserted a row would describe a path nothing uses and would
 * tell a later reader that a session can move a counter.
 *
 * THE RPC IS GRANTED TO `service_role` ALONE, so this is called with the admin client. That is the
 * one place in the repository layer where that is true, and it is why the module exports nothing
 * else: the seam is a boolean, not a client.
 *
 * IT DOES NOT DECIDE WHAT A FAILURE MEANS. `lib/security/rate-limit.ts` owns the fail-closed rule —
 * a database that cannot be reached is precisely when an endpoint is least able to absorb whatever
 * is hitting it — and this function's job is to raise so that rule has something to catch.
 */
export async function consumeRateLimit(
  client: Client,
  bucketKey: string,
  windowSeconds: number,
  limit: number,
): Promise<boolean> {
  const { data, error } = await client.rpc('consume_rate_limit', {
    p_bucket_key: bucketKey,
    p_window_seconds: windowSeconds,
    p_limit: limit,
  })

  if (error) throw toRepositoryError(ENTITY, 'consume', bucketKey, error)
  // The function returns a boolean. Anything else means the signature changed underneath us, and
  // "not allowed" is the safe reading of a limiter whose answer cannot be understood.
  return data === true
}
