import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research change digest'

export type DigestRow = Database['public']['Tables']['research_change_digests']['Row']

const DIGEST_COLUMNS = 'id, digest_date, stats, generated_at'

/**
 * One row per day, and writing it twice updates rather than appends.
 *
 * IDEMPOTENCE IS THE ONLY REQUIREMENT THIS TABLE HAS, and it is not a nicety. The digest is
 * generated from the Phase 25 cron route, which drains in bounded slices and may be retried; a
 * second row for the same day would double every count on a screen somebody reads as a trend. The
 * unique key on `digest_date` plus this upsert is the whole mechanism — no read-then-write, which
 * would race with itself under exactly the retry it exists to survive.
 */
export async function writeDigest(
  admin: Client,
  input: { readonly digestDate: string; readonly stats: unknown },
): Promise<void> {
  const { error } = await admin.from('research_change_digests').upsert(
    {
      digest_date: input.digestDate,
      stats: input.stats as never,
      generated_at: new Date().toISOString(),
    },
    { onConflict: 'digest_date' },
  )
  if (error !== null) throw toRepositoryError(ENTITY, 'write', input.digestDate, error)
}

export async function getDigest(client: Client, digestDate: string): Promise<DigestRow | null> {
  const { data, error } = await client
    .from('research_change_digests')
    .select(DIGEST_COLUMNS)
    .eq('digest_date', digestDate)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'get', digestDate, error)
  return data ?? null
}

export async function latestDigest(client: Client): Promise<DigestRow | null> {
  const { data, error } = await client
    .from('research_change_digests')
    .select(DIGEST_COLUMNS)
    .order('digest_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'latest', 'digest', error)
  return data ?? null
}
