import type { SupabaseClient } from '@supabase/supabase-js'

import { ROBOTS_TTL_HOURS } from '@/lib/scraper/core/robots'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'robots cache'

export type RobotsCacheRow = Database['public']['Tables']['research_robots_cache']['Row']

export async function readRobotsCache(admin: Client, host: string): Promise<RobotsCacheRow | null> {
  const { data, error } = await admin
    .from('research_robots_cache')
    .select('*')
    .eq('host', host)
    .maybeSingle()
  if (error) throw toRepositoryError(ENTITY, 'read', host, error)
  return (data ?? null) as unknown as RobotsCacheRow | null
}

/**
 * Cache one host's robots.txt for 24 hours.
 *
 * A FAILED FETCH IS CACHED TOO, with a null body. That is not a bug being papered over — it is the
 * politeness rule applied to the politeness file: a host that cannot serve a forty-byte text file
 * must not then be asked for it again every three seconds for the rest of the run. The null body
 * is read back as "no rules we could obtain", and the caller decides what that means (it means
 * ERROR, and ERROR means do not fetch).
 */
export async function writeRobotsCache(
  admin: Client,
  input: {
    readonly host: string
    readonly body: string | null
    readonly crawlDelaySeconds: number | null
  },
): Promise<void> {
  const now = new Date()
  const expires = new Date(now.getTime() + ROBOTS_TTL_HOURS * 60 * 60 * 1000)

  const { error } = await admin.from('research_robots_cache').upsert(
    {
      host: input.host,
      body: input.body,
      fetched_at: now.toISOString(),
      expires_at: expires.toISOString(),
      crawl_delay_s: input.crawlDelaySeconds,
    },
    { onConflict: 'host' },
  )
  if (error !== null) throw toRepositoryError(ENTITY, 'write', input.host, error)
}
