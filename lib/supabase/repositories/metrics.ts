import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'

type Client = SupabaseClient<Database>

/**
 * Counts for the Studio dashboard.
 *
 * EVERY QUERY IS WRITTEN OUT. There is no `count(table: string)` here, and there must not be: a
 * function taking a relation name is an injection-shaped API even when today's only callers pass
 * constants, and it defeats the generated `Database` types — `from(someString)` is untyped, so a
 * renamed table would compile and fail at runtime in front of the owner.
 *
 * A count is `head: true`, so PostgREST returns the number in a header and no rows cross the wire.
 *
 * THESE RUN AS THE SIGNED-IN USER. RLS applies, so a role that cannot see draft products counts
 * none of them — which is the correct answer for that person rather than a leak of the total.
 */

/** A count that failed is `null`, never 0. The dashboard must be able to tell them apart. */
export type MetricCount = number | null

async function count(
  client: Client,
  build: (c: Client) => PromiseLike<{ count: number | null; error: unknown }>,
): Promise<MetricCount> {
  try {
    const { count: value, error } = await build(client)
    if (error) return null
    return value ?? null
  } catch {
    // Swallowed on purpose: one unreachable card must not take the dashboard down. The null is
    // what the renderer turns into "could not be read", which is different from a zero.
    return null
  }
}

export function countProducts(client: Client): Promise<MetricCount> {
  return count(client, (c) => c.from('products').select('*', { count: 'exact', head: true }))
}

export function countProductsByStatus(
  client: Client,
  status: Database['public']['Enums']['content_status'],
): Promise<MetricCount> {
  return count(client, (c) =>
    c.from('products').select('*', { count: 'exact', head: true }).eq('status', status),
  )
}

export function countCollections(client: Client): Promise<MetricCount> {
  return count(client, (c) => c.from('collections').select('*', { count: 'exact', head: true }))
}

export function countMediaAssets(client: Client): Promise<MetricCount> {
  return count(client, (c) => c.from('media_assets').select('*', { count: 'exact', head: true }))
}
